param(
    [Parameter(Mandatory = $true)]
    [string]$AwsRegion,
    [Parameter(Mandatory = $true)]
    [string]$GitHubOrg,
    [Parameter(Mandatory = $true)]
    [string]$GitHubRepo,
    [string]$StateBucket = "loomapos-terraform-state",
    [string]$LockTable = "loomapos-terraform-locks",
    [string]$OidcRoleName = "loomapos-gha-deploy-role",
    [string]$StagingSecretName = "loomapos/staging/runtime",
    [string]$ProductionSecretName = "loomapos/production/runtime",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Invoke-AwsCli {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    if ($DryRun) {
        Write-Host "[dry-run] aws $($Args -join ' ')"
        return ""
    }

    $output = & aws @Args 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "AWS CLI command failed: aws $($Args -join ' ')`n$output"
    }

    return $output
}

function Ensure-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        if ($DryRun) {
            Write-Host "[dry-run] command missing but skipped: $Name"
            return
        }
        throw "Required command not found: $Name"
    }
}

function Ensure-S3Bucket {
    $head = & aws s3api head-bucket --bucket $StateBucket --region $AwsRegion 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "S3 bucket exists: $StateBucket"
        return
    }

    if ($DryRun) {
        Write-Host "[dry-run] create S3 bucket $StateBucket in $AwsRegion"
        return
    }

    if ($AwsRegion -eq "us-east-1") {
        Invoke-AwsCli -Args @("s3api", "create-bucket", "--bucket", $StateBucket, "--region", $AwsRegion) | Out-Null
    }
    else {
        Invoke-AwsCli -Args @(
            "s3api", "create-bucket",
            "--bucket", $StateBucket,
            "--region", $AwsRegion,
            "--create-bucket-configuration", "LocationConstraint=$AwsRegion"
        ) | Out-Null
    }

    Invoke-AwsCli -Args @("s3api", "put-bucket-versioning", "--bucket", $StateBucket, "--versioning-configuration", "Status=Enabled") | Out-Null
    Invoke-AwsCli -Args @(
        "s3api", "put-bucket-encryption",
        "--bucket", $StateBucket,
        "--server-side-encryption-configuration",
        '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
    ) | Out-Null
    Write-Host "Created S3 bucket: $StateBucket"
}

function Ensure-DynamoTable {
    $describe = & aws dynamodb describe-table --table-name $LockTable --region $AwsRegion 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "DynamoDB table exists: $LockTable"
        return
    }

    Invoke-AwsCli -Args @(
        "dynamodb", "create-table",
        "--table-name", $LockTable,
        "--attribute-definitions", "AttributeName=LockID,AttributeType=S",
        "--key-schema", "AttributeName=LockID,KeyType=HASH",
        "--billing-mode", "PAY_PER_REQUEST",
        "--region", $AwsRegion
    ) | Out-Null
    Write-Host "Created DynamoDB table: $LockTable"
}

function Ensure-OidcProvider {
    $providerListJson = Invoke-AwsCli -Args @("iam", "list-open-id-connect-providers", "--output", "json")
    $providerList = $providerListJson | ConvertFrom-Json

    foreach ($provider in $providerList.OpenIDConnectProviderList) {
        $arn = $provider.Arn
        $detailsJson = Invoke-AwsCli -Args @("iam", "get-open-id-connect-provider", "--open-id-connect-provider-arn", $arn, "--output", "json")
        $details = $detailsJson | ConvertFrom-Json
        if ($details.Url -eq "token.actions.githubusercontent.com") {
            Write-Host "OIDC provider exists: $arn"
            return $arn
        }
    }

    $thumbprint = "6938fd4d98bab03faadb97b34396831e3780aea1"
    $resultJson = Invoke-AwsCli -Args @(
        "iam", "create-open-id-connect-provider",
        "--url", "https://token.actions.githubusercontent.com",
        "--client-id-list", "sts.amazonaws.com",
        "--thumbprint-list", $thumbprint,
        "--output", "json"
    )
    $result = $resultJson | ConvertFrom-Json
    Write-Host "Created OIDC provider: $($result.OpenIDConnectProviderArn)"
    return $result.OpenIDConnectProviderArn
}

function Ensure-IamRole {
    param([string]$OidcProviderArn)

    $subject = "repo:${GitHubOrg}/${GitHubRepo}:*"
    $trustPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "$OidcProviderArn"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "$subject"
        }
      }
    }
  ]
}
"@

    $trustFile = Join-Path $env:TEMP "loomapos-trust-policy.json"
    Set-Content -Path $trustFile -Value $trustPolicy -Encoding ascii

    $role = & aws iam get-role --role-name $OidcRoleName --output json 2>$null
    if ($LASTEXITCODE -ne 0) {
        Invoke-AwsCli -Args @("iam", "create-role", "--role-name", $OidcRoleName, "--assume-role-policy-document", "file://$trustFile") | Out-Null
        Write-Host "Created IAM role: $OidcRoleName"
    }
    else {
        Invoke-AwsCli -Args @("iam", "update-assume-role-policy", "--role-name", $OidcRoleName, "--policy-document", "file://$trustFile") | Out-Null
        Write-Host "Updated trust policy for role: $OidcRoleName"
    }

    $policy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:${AwsRegion}:*:secret:loomapos/staging/runtime*",
        "arn:aws:secretsmanager:${AwsRegion}:*:secret:loomapos/production/runtime*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::$StateBucket"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::$StateBucket/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:DescribeTable",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:${AwsRegion}:*:table/${LockTable}"
      ]
    }
  ]
}
"@

    $policyFile = Join-Path $env:TEMP "loomapos-gha-inline-policy.json"
    Set-Content -Path $policyFile -Value $policy -Encoding ascii
    Invoke-AwsCli -Args @(
        "iam", "put-role-policy",
        "--role-name", $OidcRoleName,
        "--policy-name", "loomapos-gha-base",
        "--policy-document", "file://$policyFile"
    ) | Out-Null

    $roleArnJson = Invoke-AwsCli -Args @("iam", "get-role", "--role-name", $OidcRoleName, "--query", "Role.Arn", "--output", "text")
    return $roleArnJson.Trim()
}

function Ensure-SecretJson {
    param([string]$SecretName)

    $template = @'
{
  "ConnectionStrings__Postgres": "Host=example;Port=5432;Database=loomapos;Username=loomapos;Password=change-me",
  "ConnectionStrings__Redis": "redis:6379",
  "Auth__Authority": "https://auth.example/realms/loomapos",
  "Auth__Audience": "loomapos-api",
  "Payments__Stripe__ApiKey": "sk_live_change_me",
  "Messaging__Smtp__Password": "change-me"
}
'@

    $exists = & aws secretsmanager describe-secret --secret-id $SecretName --region $AwsRegion 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Secret exists: $SecretName"
        return
    }

    Invoke-AwsCli -Args @(
        "secretsmanager", "create-secret",
        "--name", $SecretName,
        "--description", "LoomaPOS runtime secrets",
        "--secret-string", $template,
        "--region", $AwsRegion
    ) | Out-Null
    Write-Host "Created secret template: $SecretName"
}

Ensure-Command -Name "aws"

Write-Host "Bootstrapping AWS foundation for $GitHubOrg/$GitHubRepo in $AwsRegion"
if ($DryRun) {
    Write-Host "[dry-run] would ensure S3 bucket: $StateBucket"
    Write-Host "[dry-run] would ensure DynamoDB lock table: $LockTable"
    Write-Host "[dry-run] would ensure GitHub OIDC provider"
    Write-Host "[dry-run] would ensure IAM role: $OidcRoleName"
    Write-Host "[dry-run] would ensure secrets: $StagingSecretName and $ProductionSecretName"
    Write-Host "Use these GitHub secret keys after real run:"
    Write-Host "AWS_OIDC_ROLE_ARN=arn:aws:iam::<account-id>:role/$OidcRoleName"
    Write-Host "AWS_REGION=$AwsRegion"
    Write-Host "TF_STATE_BUCKET=$StateBucket"
    Write-Host "TF_STATE_LOCK_TABLE=$LockTable"
    exit 0
}

Ensure-S3Bucket
Ensure-DynamoTable
$oidcArn = Ensure-OidcProvider
$roleArn = Ensure-IamRole -OidcProviderArn $oidcArn
Ensure-SecretJson -SecretName $StagingSecretName
Ensure-SecretJson -SecretName $ProductionSecretName

Write-Host ""
Write-Host "Done."
Write-Host "Use these values as GitHub Actions secrets:"
Write-Host "AWS_OIDC_ROLE_ARN=$roleArn"
Write-Host "AWS_REGION=$AwsRegion"
Write-Host "TF_STATE_BUCKET=$StateBucket"
Write-Host "TF_STATE_LOCK_TABLE=$LockTable"
