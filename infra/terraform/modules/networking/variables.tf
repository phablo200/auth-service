variable "name_prefix" {
  description = "Prefix used for AWS resource names."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets."
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets."
  type        = list(string)
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to reach the public ALB."
  type        = list(string)
}

variable "app_port" {
  description = "Application container port."
  type        = number
}

variable "tags" {
  description = "Tags applied to resources."
  type        = map(string)
  default     = {}
}
