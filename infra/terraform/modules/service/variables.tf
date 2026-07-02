variable "name_prefix" {
  description = "Prefix used for AWS resource names."
  type        = string
}

variable "aws_region" {
  description = "AWS region."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs where lab ECS tasks run."
  type        = list(string)
}

variable "alb_arn" {
  description = "ALB ARN."
  type        = string
}

variable "alb_security_group_id" {
  description = "ALB security group ID."
  type        = string
}

variable "ecs_security_group_id" {
  description = "ECS task security group ID."
  type        = string
}

variable "container_image" {
  description = "Container image URI to deploy."
  type        = string
}

variable "app_port" {
  description = "Application container port."
  type        = number
}

variable "cpu" {
  description = "ECS task CPU units."
  type        = number
}

variable "memory" {
  description = "ECS task memory in MiB."
  type        = number
}

variable "desired_count" {
  description = "Desired ECS service task count."
  type        = number
}

variable "environment_variables" {
  description = "Non-sensitive environment variables passed to the container."
  type        = map(string)
}

variable "db_password_secret_arn" {
  description = "Secrets Manager ARN for the database password."
  type        = string
}

variable "app_secret_names" {
  description = "Map of ECS environment variable names to Secrets Manager secret names for app secrets."
  type        = map(string)
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days."
  type        = number
}

variable "tags" {
  description = "Tags applied to resources."
  type        = map(string)
  default     = {}
}
