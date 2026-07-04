output "db_host" {
  description = "RDS database host/address."
  value       = aws_db_instance.main.address
}

output "db_port" {
  description = "RDS database port."
  value       = aws_db_instance.main.port
}

output "db_endpoint" {
  description = "RDS database endpoint."
  value       = aws_db_instance.main.endpoint
}

output "db_name" {
  description = "RDS database name."
  value       = aws_db_instance.main.db_name
}

output "db_username" {
  description = "RDS database username."
  value       = aws_db_instance.main.username
}

output "db_password_secret_arn" {
  description = "Secrets Manager ARN for the generated RDS password."
  value       = aws_secretsmanager_secret.db_password.arn
}

output "database_url_secret_arn" {
  description = "Secrets Manager ARN for the generated PostgreSQL connection URL."
  value       = aws_secretsmanager_secret.database_url.arn
}
