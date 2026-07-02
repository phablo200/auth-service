output "alb_dns_name" {
  description = "Public ALB DNS name used as the Hostinger api.auth CNAME target."
  value       = module.networking.alb_dns_name
}

output "api_domain_name" {
  description = "Public API domain name."
  value       = local.api_domain_name
}

output "api_url" {
  description = "Public HTTPS API URL."
  value       = "https://${local.api_domain_name}"
}

output "alb_url" {
  description = "Public HTTPS URL for the lab service."
  value       = "https://${local.api_domain_name}"
}

output "ecr_repository_url" {
  description = "ECR repository URL for manually pushed images."
  value       = module.service.ecr_repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = module.service.ecs_cluster_name
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = module.service.ecs_service_name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint."
  value       = module.database.db_endpoint
}

output "rds_secret_arn" {
  description = "Secrets Manager ARN for the generated RDS password."
  value       = module.database.db_password_secret_arn
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group used by the ECS task."
  value       = module.service.cloudwatch_log_group_name
}

output "budget_name" {
  description = "AWS Budget name."
  value       = aws_budgets_budget.monthly_lab.name
}
