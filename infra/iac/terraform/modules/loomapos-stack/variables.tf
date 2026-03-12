variable "environment" {
  type = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "domain_name" {
  type = string
}

variable "enable_dr_validation" {
  type = bool
}

variable "release_channel" {
  type = string

  validation {
    condition     = contains(["stable", "beta"], var.release_channel)
    error_message = "release_channel must be stable or beta."
  }
}

variable "secret_reference_map" {
  type = map(string)
}

variable "retention_policy" {
  type = object({
    audit_logs_days       = number
    integration_logs_days = number
    webhook_payload_days  = number
    backup_keep_days      = number
  })
}

variable "rate_limit_policy" {
  type = object({
    public_api_per_minute       = number
    auth_per_minute             = number
    sync_per_tenant_per_minute  = number
  })
}

variable "slo_targets" {
  type = map(number)
}
