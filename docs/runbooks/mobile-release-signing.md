# Mobile Release Signing Runbook

## Scope

This runbook covers Android release signing materialization and iOS metadata secret validation for CI/CD.

## Required secrets

Android:
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_STORE_PASSWORD`

iOS metadata:
- `IOS_APP_STORE_CONNECT_ISSUER_ID`
- `IOS_APP_STORE_CONNECT_KEY_ID`
- `IOS_APP_STORE_CONNECT_PRIVATE_KEY_BASE64`

## GitHub Actions workflow

- Workflow: `.github/workflows/mobile-release.yml`
- Trigger: `workflow_dispatch`
- Jobs:
  - `android-release`: validates secrets, materializes `apps/mobile/android/key.properties` and `apps/mobile/android/keystore/loomapos-release.jks`, builds signed `aab` and `apk`, uploads artifacts.
  - `ios-metadata`: validates App Store Connect metadata secrets and performs `flutter build ios --no-codesign`.

## Local verification

1. Export required environment variables.
2. Run:
   - `pwsh ./scripts/ops/validate-mobile-release-secrets.ps1 -RequireAndroid`
   - `pwsh ./scripts/ops/bootstrap-mobile-signing.ps1`
3. Build:
   - `cd apps/mobile`
   - `flutter build appbundle --release`

## Safety notes

- Never commit `apps/mobile/android/key.properties`.
- Never commit `.jks` files.
- Rotate mobile signing secrets if leaked.
