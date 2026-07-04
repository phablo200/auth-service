variable "project_name" {
  description = "Project name used in AWS resource names and tags."
  type        = string
  default     = "auth-service"
}

variable "environment" {
  description = "Environment name used in AWS resource names and tags."
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region used for the lab deployment."
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the lab VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets hosting the ALB and lab ECS tasks."
  type        = list(string)
  default     = ["10.20.0.0/24", "10.20.1.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets hosting RDS."
  type        = list(string)
  default     = ["10.20.10.0/24", "10.20.11.0/24"]
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to reach the public ALB over HTTP and HTTPS."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "acm_certificate_arn" {
  description = "Optional ACM certificate ARN for api.auth.phablovilasboas.tech."
  type        = string
  default     = null
}

variable "container_image" {
  description = "Full ECR image URI to deploy, using the git-<short-sha> tag convention."
  type        = string
}

variable "app_port" {
  description = "Container port used by the auth-service application."
  type        = number
  default     = 3001
}

variable "cpu" {
  description = "ECS task CPU units."
  type        = number
  default     = 256
}

variable "memory" {
  description = "ECS task memory in MiB."
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired number of ECS tasks."
  type        = number
  default     = 1
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "auth210"
}

variable "db_username" {
  description = "PostgreSQL master username."
  type        = string
  default     = "auth210"
}

variable "db_instance_class" {
  description = "RDS PostgreSQL instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GiB."
  type        = number
  default     = 20
}

variable "db_engine_version" {
  description = "Optional PostgreSQL engine version. Leave null to let AWS choose the default supported version."
  type        = string
  default     = null
}

variable "db_backup_retention_days" {
  description = "RDS backup retention in days."
  type        = number
  default     = 1
}

variable "budget_alert_email" {
  description = "Email address that receives AWS Budget notifications."
  type        = string
  default     = "lokermia@gmail.com"
}

variable "budget_limit_usd" {
  description = "Monthly AWS Budget limit in USD."
  type        = number
  default     = 30
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days."
  type        = number
  default     = 7
}

variable "app_environment_variables" {
  description = "Non-sensitive application environment variables passed directly to ECS."
  type        = map(string)
  default = {
    JWT_EXPIRES_IN                    = "15m"
    OAUTH_PUBLIC_BASE_URL             = "https://api.auth.phablovilasboas.tech"
    OAUTH_STATE_TTL_SECONDS           = "600"
    OAUTH_EXCHANGE_CODE_TTL_SECONDS   = "300"
    OAUTH_FRONTEND_REDIRECT_ALLOWLIST = "https://labs.phablovilasboas.tech"
    OAUTH_ENABLED_PROVIDERS           = "google,github"
    OAUTH_DEFAULT_PROFILE_ID          = ""
    GOOGLE_OAUTH_CALLBACK_PATH        = "/api/auth/oauth/google/callback"
    GITHUB_OAUTH_CALLBACK_PATH        = "/api/auth/oauth/github/callback"
    MAIL_PROVIDER                     = "smtp"
    MAIL_FROM_NAME                    = "Auth210"
    MAIL_FROM_EMAIL                   = "no-reply@example.com"
    MAIL_HOST                         = ""
    MAIL_PORT                         = "587"
    MAIL_SECURE                       = "false"
    APP_BASE_URL                      = "https://api.auth.phablovilasboas.tech"
  }
}
