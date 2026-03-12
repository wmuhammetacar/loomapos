locals {
  stack_name = "loomapos-${var.environment}"

  ops_policy_bundle = {
    environment         = var.environment
    domain_name         = var.domain_name
    release_channel     = var.release_channel
    dr_validation       = var.enable_dr_validation
    secret_references   = var.secret_reference_map
    retention_policy    = var.retention_policy
    rate_limit_policy   = var.rate_limit_policy
    slo_targets         = var.slo_targets
    generated_at_utc    = timestamp()
  }
}

# This resource captures structured ops policy inputs so environments have
# a concrete IaC artifact instead of implicit defaults.
resource "terraform_data" "ops_policy_bundle" {
  input = local.ops_policy_bundle
}

output "stack_name" {
  value = local.stack_name
}

output "domain_name" {
  value = var.domain_name
}

output "release_channel" {
  value = var.release_channel
}

output "dr_validation_enabled" {
  value = var.enable_dr_validation
}

output "ops_policy_bundle" {
  value = terraform_data.ops_policy_bundle.output
}
