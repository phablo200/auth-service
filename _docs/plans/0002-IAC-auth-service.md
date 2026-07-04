# IaC For Auth Service On AWS ECS Fargate Plan

## Goal

Implement the Terraform code described in `docs/specs/0002-IAC-auth-service.md` so this repository can provision a lab AWS deployment for `auth-service`.

The lab deployment will expose the API through an AWS Application Load Balancer over HTTP, run one ECS Fargate task, connect to RDS PostgreSQL, inject sensitive values from Secrets Manager, and send container logs to CloudWatch.

Source spec: `docs/specs/0002-IAC-auth-service.md`.

## Decisions

- Use AWS as the cloud provider and Terraform as the IaC tool.
- Use `us-east-1` as the default AWS region.
- Keep IaC in this repository under `infra/terraform`.
- Use only one environment folder: `infra/terraform/environments/prod`.
- Do not create `dev`, because this is a lab and the `prod` folder is enough.
- Do not create Route 53, DNS records, ACM certificates, HTTPS listeners, or custom domains.
- Do not create SSM Parameter Store resources. Non-sensitive config goes into plain ECS environment variables.
- Use Secrets Manager only for sensitive runtime values.
- Do not create Redis/ElastiCache because the current service does not use Redis in code.
- Do not create GitHub Actions or any CI/CD automation in this plan.
- First networking version uses public subnets for both the ALB and ECS task, with ECS ingress restricted to the ALB security group. This avoids NAT Gateway and VPC endpoints for the lab.
- RDS stays in private subnets and is not publicly accessible.
- Use `db.t4g.micro` as the RDS PostgreSQL instance class.
- Create an AWS Budget through Terraform with a `30 USD` monthly limit.
- Configure AWS Budget alerts at `50%`, `80%`, and `100%`.
- Send AWS Budget notifications to `lokermia@gmail.com`.
- Use manual Docker image tags in the format `git-<short-commit-sha>`, for example `git-a1b2c3d`.
- Use local Terraform state for the first lab implementation. Remote S3 state is deferred.
- Use one ECS desired task count, small Fargate sizing, short log retention, and `db.t4g.micro` to control cost.

## Implementation Steps

### 1. Create Terraform Skeleton

Files:

- `infra/terraform/environments/prod/versions.tf`
- `infra/terraform/environments/prod/providers.tf`
- `infra/terraform/environments/prod/main.tf`
- `infra/terraform/environments/prod/variables.tf`
- `infra/terraform/environments/prod/outputs.tf`
- `infra/terraform/environments/prod/terraform.tfvars.example`
- `infra/terraform/modules/networking/main.tf`
- `infra/terraform/modules/networking/variables.tf`
- `infra/terraform/modules/networking/outputs.tf`
- `infra/terraform/modules/database/main.tf`
- `infra/terraform/modules/database/variables.tf`
- `infra/terraform/modules/database/outputs.tf`
- `infra/terraform/modules/service/main.tf`
- `infra/terraform/modules/service/variables.tf`
- `infra/terraform/modules/service/outputs.tf`

Tasks:

- Configure the official AWS provider.
- Define the minimum Terraform version and AWS provider version.
- Keep backend configuration local for now.
- Add a `terraform.tfvars.example` with placeholders only, no secrets.
- Add common variables such as `project_name`, `environment`, `aws_region`, `container_image`, `db_name`, `db_username`, `allowed_cidr_blocks`, and `budget_alert_email`.
- Default `aws_region` to `us-east-1`.
- Add consistent resource tags, for example `Project=auth-service` and `Environment=prod`.

### 2. Implement Networking Module

Files:

- `infra/terraform/modules/networking/main.tf`
- `infra/terraform/modules/networking/variables.tf`
- `infra/terraform/modules/networking/outputs.tf`

Tasks:

- Create one VPC.
- Create at least two public subnets for ALB and ECS tasks.
- Create at least two private subnets for RDS.
- Create an internet gateway.
- Create route tables for public subnet internet access.
- Create an ALB security group allowing inbound HTTP `80` from the configured allowed CIDR blocks, defaulting to `0.0.0.0/0` for the lab.
- Create an ECS security group allowing inbound app traffic only from the ALB security group.
- Create an RDS security group allowing inbound PostgreSQL `5432` only from the ECS security group.
- Create an internet-facing ALB in the public subnets.
- Output VPC ID, public subnet IDs, private subnet IDs, ALB ARN, ALB DNS name, and the security group IDs.

### 3. Implement Database Module

Files:

- `infra/terraform/modules/database/main.tf`
- `infra/terraform/modules/database/variables.tf`
- `infra/terraform/modules/database/outputs.tf`

Tasks:

- Generate an RDS password with Terraform.
- Store the generated DB password in Secrets Manager.
- Create an RDS subnet group using the private subnets.
- Create one PostgreSQL RDS instance.
- Use `db.t4g.micro` as the default instance class.
- Set `publicly_accessible = false`.
- Set deletion protection to `false` for lab teardown.
- Keep backup retention minimal for lab usage.
- Output DB host, port, database name, username, and DB password secret ARN.
- Do not output the raw password.

### 4. Implement Service Module

Files:

- `infra/terraform/modules/service/main.tf`
- `infra/terraform/modules/service/variables.tf`
- `infra/terraform/modules/service/outputs.tf`

Tasks:

- Create an ECR repository for the application image.
- Create an ECS cluster.
- Create a CloudWatch log group with short retention, such as `7` days.
- Create the ECS task execution role.
- Grant the execution role permission to pull from ECR, write CloudWatch logs, and read required Secrets Manager secrets.
- Create the ECS task definition using Fargate compatibility.
- Configure one container named for the service.
- Set container port `3001`.
- Set `PORT=3001`.
- Configure `awslogs` logging.
- Create an ALB target group with target type `ip`.
- Configure health checks on `/health` with matcher `200`.
- Create an HTTP listener on ALB port `80`.
- Create the ECS service with desired count `1`.
- Enable `assign_public_ip = true` for the lab ECS task.
- Restrict ECS inbound traffic through the ECS security group created by the networking module.
- Output ECR repository URL, ECS cluster name, ECS service name, target group ARN, and log group name.

### 5. Wire Runtime Configuration

Files:

- `infra/terraform/environments/prod/main.tf`
- `infra/terraform/environments/prod/variables.tf`
- `infra/terraform/environments/prod/terraform.tfvars.example`
- `infra/terraform/modules/service/variables.tf`
- `infra/terraform/modules/service/main.tf`

Tasks:

- Pass non-sensitive app config as ECS environment variables:
  - `NODE_ENV=production`
  - `PORT=3001`
  - `JWT_EXPIRES_IN`
  - `OAUTH_PUBLIC_BASE_URL`
  - `OAUTH_STATE_TTL_SECONDS`
  - `OAUTH_EXCHANGE_CODE_TTL_SECONDS`
  - `OAUTH_FRONTEND_REDIRECT_ALLOWLIST`
  - `OAUTH_ENABLED_PROVIDERS`
  - `OAUTH_DEFAULT_PROFILE_ID`
  - `GOOGLE_OAUTH_CALLBACK_PATH`
  - `GITHUB_OAUTH_CALLBACK_PATH`
  - `MAIL_PROVIDER`
  - `MAIL_FROM_NAME`
  - `MAIL_FROM_EMAIL`
  - `MAIL_HOST`
  - `MAIL_PORT`
  - `MAIL_SECURE`
  - `APP_BASE_URL`
- Inject sensitive values from Secrets Manager:
  - `DATABASE_URL`
  - `DATABASE_POOL_URL`
  - `JWT_SECRET`
  - `API_KEY`
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
  - `GITHUB_OAUTH_CLIENT_ID`
  - `GITHUB_OAUTH_CLIENT_SECRET`
  - `MAIL_USER`
  - `MAIL_PASSWORD`
- Create placeholder Secrets Manager secrets for app secrets that Terraform cannot safely know yet.
- Document that secret values must be populated manually before the ECS service can run successfully.

### 6. Add AWS Budget

Files:

- `infra/terraform/environments/prod/main.tf`
- `infra/terraform/environments/prod/variables.tf`
- `infra/terraform/environments/prod/terraform.tfvars.example`

Tasks:

- Create a monthly AWS cost budget.
- Set the budget limit to `30 USD`.
- Add an actual-cost notification at `50%`.
- Add an actual-cost notification at `80%`.
- Add an actual-cost notification at `100%`.
- Use `budget_alert_email = "lokermia@gmail.com"` as the notification subscriber email for the lab.

### 7. Add Lab Usage Documentation

Files:

- `infra/terraform/README.md`

Tasks:

- Document required local tools: Terraform, AWS CLI, Docker.
- Document AWS credentials expectations.
- Document that AWS resources may create charges.
- Document how to initialize Terraform.
- Document how to apply Terraform.
- Document how to build and push the Docker image to ECR manually.
- Document how to update `container_image`.
- Document the manual image tag convention: `git-<short-commit-sha>`.
- Document how to populate Secrets Manager values.
- Document the `30 USD` monthly AWS Budget and alert thresholds.
- Document how to run migrations manually after the infrastructure is reachable.
- Document how to test `http://<alb-dns-name>/health`.
- Document how to destroy the lab resources.

### 8. Align Docker Runtime Port

Files:

- `Dockerfile`

Tasks:

- Update `EXPOSE 3000` to `EXPOSE 3001` so the Dockerfile documents the actual app port.
- Keep the runtime command unchanged: `node dist/main.js`.
- Do not change application behavior; `PORT` remains the source of truth at runtime.

### 9. Validate Terraform Locally

Commands:

```bash
terraform fmt -recursive infra/terraform
terraform -chdir=infra/terraform/environments/prod init
terraform -chdir=infra/terraform/environments/prod validate
terraform -chdir=infra/terraform/environments/prod plan
```

Tasks:

- Confirm formatting passes.
- Confirm provider initialization works.
- Confirm validation passes.
- Review the plan for only expected resources.
- Confirm no DNS, ACM, HTTPS, SSM, Redis, ElastiCache, or CI/CD resources are present.
- Confirm the plan includes one AWS Budget with a `30 USD` monthly limit and `50%`, `80%`, and `100%` alert thresholds.

## Validation Checklist

- `infra/terraform/environments/prod` exists and composes all modules.
- `infra/terraform/modules/networking` creates VPC, subnets, security groups, and ALB.
- `infra/terraform/modules/database` creates RDS PostgreSQL and Secrets Manager DB password storage.
- `infra/terraform/modules/service` creates ECR, ECS Fargate, IAM roles, CloudWatch logs, target group, and listener.
- Terraform outputs include ALB DNS name, ECR repository URL, ECS cluster/service names, RDS endpoint, and log group name.
- Default AWS region is `us-east-1`.
- RDS instance class is `db.t4g.micro`.
- RDS is not publicly accessible.
- ECS accepts inbound traffic only from the ALB security group.
- ALB accepts HTTP traffic on port `80`.
- ALB health check uses `/health`.
- ECS task definition uses container port `3001` and `PORT=3001`.
- Sensitive values are referenced from Secrets Manager and not committed.
- Non-sensitive config is plain ECS environment variables.
- AWS Budget exists with a `30 USD` monthly limit.
- AWS Budget alerts exist at `50%`, `80%`, and `100%`.
- `terraform fmt`, `terraform init`, `terraform validate`, and `terraform plan` pass.
- After apply and image push, `GET http://<alb-dns-name>/health` returns `{"status":"ok"}`.

## Manual Deployment Flow

1. Apply Terraform once to create ECR and base infrastructure.
2. Authenticate Docker to ECR with AWS CLI.
3. Build the production Docker image from `Dockerfile`.
4. Tag the image with the ECR repository URL using `git-<short-commit-sha>`.
5. Push the image to ECR.
6. Update `container_image` in the lab Terraform variables if the tag changed.
7. Apply Terraform again so the ECS task definition uses the pushed image.
8. Populate missing Secrets Manager values if not already populated.
9. Wait for the ECS service to reach steady state.
10. Open `http://<alb-dns-name>/health`.
11. Run database migrations manually from an approved environment that can reach RDS.

## Rollout Plan

1. Implement and validate Terraform skeleton.
2. Implement networking and confirm the ALB can be planned.
3. Implement RDS and Secrets Manager password handling.
4. Implement ECS, ECR, IAM, CloudWatch, target group, and listener resources.
5. Wire application environment variables and secrets.
6. Add AWS Budget resource and notifications.
7. Add Terraform README usage instructions.
8. Update Dockerfile exposed port metadata.
9. Run local Terraform validation.
10. Apply to AWS lab account.
11. Push image manually to ECR with a `git-<short-commit-sha>` tag.
12. Verify ALB health check and service response.
13. Run migrations manually.

## Risks

- AWS resources can create charges, especially ALB, RDS, Fargate, NAT Gateway, and VPC endpoints. The Terraform-managed `30 USD` monthly budget reduces surprise but does not prevent all charges in real time.
- Public-subnet ECS tasks are simpler and cheaper for the lab, but less production-like than private tasks behind NAT or VPC endpoints.
- HTTP-only ALB traffic is acceptable for this lab but not for real production credentials.
- ECS may fail to start until all required Secrets Manager values exist and are readable by the execution role.
- Terraform state may contain sensitive references and generated values; local state must not be committed.
- RDS deletion protection is disabled for lab teardown, so `terraform destroy` can remove the database.
- Migrations are manual in this plan, so a healthy container does not guarantee the database schema is ready.

## Deferred Work

- Route 53 DNS.
- ACM TLS certificate and HTTPS listener.
- S3 backend and DynamoDB state locking.
- GitHub Actions or another CI/CD pipeline.
- Private ECS tasks with NAT Gateway or VPC endpoints.
- CloudWatch alarms.
- Automated migration job.
- Redis/ElastiCache if the application starts using Redis.
