variable "name_prefix" {
  description = "Prefix used for AWS resource names."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the RDS subnet group."
  type        = list(string)
}

variable "rds_security_group_id" {
  description = "Security group ID attached to RDS."
  type        = string
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
}

variable "db_username" {
  description = "PostgreSQL master username."
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GiB."
  type        = number
}

variable "db_engine_version" {
  description = "Optional PostgreSQL engine version."
  type        = string
  default     = null
}

variable "db_backup_retention_days" {
  description = "RDS backup retention in days."
  type        = number
}

variable "tags" {
  description = "Tags applied to resources."
  type        = map(string)
  default     = {}
}
