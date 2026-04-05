terraform {
  required_version = ">= 1.7.0"
}

variable "domain_name" {
  type    = string
  default = "loomapos.com"
}

variable "release_channel" {
  type    = string
  default = "stable"
}

variable "enable_dr_validation" {
  type    = bool
  default = false
}

variable "secret_reference_map" {
  type = map(string)
  default = {
    ConnectionStrings__Postgres = "aws-sm://loomapos/production/runtime?key=ConnectionStrings__Postgres"
    ConnectionStrings__Redis    = "aws-sm://loomapos/production/runtime?key=ConnectionStrings__Redis"
    Auth__Authority             = "aws-sm://loomapos/production/runtime?key=Auth__Authority"
    Auth__Audience              = "aws-sm://loomapos/production/runtime?key=Auth__Audience"
  }
}

variable "retention_policy" {
  type = object({
    audit_logs_days       = number
    integration_logs_days = number
    webhook_payload_days  = number
    backup_keep_days      = number
  })
  default = {
    audit_logs_days       = 365
    integration_logs_days = 90
    webhook_payload_days  = 30
    backup_keep_days      = 30
  }
}

variable "rate_limit_policy" {
  type = object({
    public_api_per_minute      = number
    auth_per_minute            = number
    sync_per_tenant_per_minute = number
  })
  default = {
    public_api_per_minute      = 240
    auth_per_minute            = 30
    sync_per_tenant_per_minute = 480
  }
}

variable "slo_targets" {
  type = map(number)
  default = {
    api_availability = 99.95
    portal_uptime    = 99.95
    sync_delay_mins  = 5
  }
}

module "loomapos_stack" {
  source               = "../../modules/loomapos-stack"
  environment          = "production"
  domain_name          = var.domain_name
  enable_dr_validation = var.enable_dr_validation
  release_channel      = var.release_channel
  secret_reference_map = var.secret_reference_map
  retention_policy     = var.retention_policy
  rate_limit_policy    = var.rate_limit_policy
  slo_targets          = var.slo_targets
}
