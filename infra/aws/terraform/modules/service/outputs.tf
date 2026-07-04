output "ecr_repository_url" {
  description = "ECR repository URL."
  value       = aws_ecr_repository.main.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = aws_ecs_service.main.name
}

output "target_group_arn" {
  description = "ALB target group ARN."
  value       = aws_lb_target_group.main.arn
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name."
  value       = aws_cloudwatch_log_group.main.name
}

output "app_secret_arns" {
  description = "App secret ARNs created for manual value population."
  value       = { for name, secret in aws_secretsmanager_secret.app : name => secret.arn }
}
