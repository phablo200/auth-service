locals {
  name_prefix     = "${var.project_name}-${var.environment}"
  api_domain_name = "api.auth.phablovilasboas.tech"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  app_secret_names = {
    API_KEY                    = "${local.name_prefix}/api-key"
    JWT_SECRET                 = "${local.name_prefix}/jwt-secret"
    GOOGLE_OAUTH_CLIENT_ID     = "${local.name_prefix}/google-oauth-client-id"
    GOOGLE_OAUTH_CLIENT_SECRET = "${local.name_prefix}/google-oauth-client-secret"
    GITHUB_OAUTH_CLIENT_ID     = "${local.name_prefix}/github-oauth-client-id"
    GITHUB_OAUTH_CLIENT_SECRET = "${local.name_prefix}/github-oauth-client-secret"
    MAIL_USER                  = "${local.name_prefix}/mail-user"
    MAIL_PASSWORD              = "${local.name_prefix}/mail-password"
  }

  ecs_environment_variables = merge(
    var.app_environment_variables,
    {
      NODE_ENV = "production"
      PORT     = tostring(var.app_port)
    }
  )
}

module "networking" {
  source = "../../modules/networking"

  name_prefix          = local.name_prefix
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  allowed_cidr_blocks  = var.allowed_cidr_blocks
  app_port             = var.app_port
  tags                 = local.common_tags
}

module "database" {
  source = "../../modules/database"

  name_prefix              = local.name_prefix
  private_subnet_ids       = module.networking.private_subnet_ids
  rds_security_group_id    = module.networking.rds_security_group_id
  db_name                  = var.db_name
  db_username              = var.db_username
  db_instance_class        = var.db_instance_class
  db_allocated_storage     = var.db_allocated_storage
  db_engine_version        = var.db_engine_version
  db_backup_retention_days = var.db_backup_retention_days
  tags                     = local.common_tags
}

module "service" {
  source = "../../modules/service"

  name_prefix             = local.name_prefix
  aws_region              = var.aws_region
  vpc_id                  = module.networking.vpc_id
  public_subnet_ids       = module.networking.public_subnet_ids
  alb_arn                 = module.networking.alb_arn
  alb_security_group_id   = module.networking.alb_security_group_id
  acm_certificate_arn     = var.acm_certificate_arn
  ecs_security_group_id   = module.networking.ecs_security_group_id
  container_image         = var.container_image
  app_port                = var.app_port
  cpu                     = 256
  memory                  = 512
  desired_count           = 1
  environment_variables   = local.ecs_environment_variables
  database_url_secret_arn = module.database.database_url_secret_arn
  app_secret_names        = local.app_secret_names
  log_retention_days      = var.log_retention_days
  tags                    = local.common_tags
}

resource "aws_budgets_budget" "monthly_lab" {
  name         = "${local.name_prefix}-monthly-budget"
  budget_type  = "COST"
  limit_amount = tostring(var.budget_limit_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}
