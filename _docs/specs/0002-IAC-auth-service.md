# IaC For Auth Service On AWS ECS Fargate

## Objective

Create Terraform infrastructure for deploying `auth-service` to AWS as a lab environment that still follows a production-style shape. The deployment should run the existing Dockerized Node.js/Express API behind an Application Load Balancer, connect it to RDS PostgreSQL, store sensitive runtime values in AWS Secrets Manager, and write application logs to CloudWatch.

The first implementation should live in this repository under `infra/terraform/` and use one environment folder named `prod`, even though this is currently a lab. The name keeps the layout close to a real deployment while avoiding an unnecessary `dev` environment.

## Background

The current project is a Node.js, Express, and TypeScript auth service with:

- A production `Dockerfile` based on `node:24.12.0-alpine`.
- A runtime entrypoint of `node dist/main.js`.
- A health endpoint at `GET /health`.
- A default local port of `3001`, controlled by `PORT`.
- PostgreSQL access through `pg` using `DATABASE_URL`, with optional `DATABASE_POOL_URL` for pooled runtime traffic.
- JWT, API key, OAuth, and SMTP settings supplied through environment variables.
- SQL migrations and seeds under `src/db/migrations/` and `src/db/seeds/`.

The research note in `.workspace/researchs/iac.md` recommends keeping service-owned IaC in this repository because the infrastructure is tightly coupled to this API's Docker image, runtime config, database, secrets, OAuth callback URLs, mail settings, and deployment lifecycle.

The target lab architecture is:

```text
Internet
  -> Application Load Balancer
  -> ECS Fargate task running auth-service
  -> RDS PostgreSQL
  -> Secrets Manager
  -> CloudWatch Logs
```

DNS and TLS are intentionally excluded for now. The service will be accessed through the AWS-provided ALB DNS name over HTTP. ACM public certificates are not needed until a real domain such as `api.example.com` is introduced.

## Scope

### In Scope

- Add Terraform code under:

```text
auth-service/
  infra/
    terraform/
      environments/
        prod/
      modules/
        service/
        database/
        networking/
```

- Use the official AWS Terraform provider.
- Provision a VPC with public and private subnets.
- Provision an internet-facing Application Load Balancer.
- Run `auth-service` as an ECS Fargate service.
- Provision an ECR repository for the application image.
- Provision RDS PostgreSQL for the application database.
- Store sensitive runtime values in AWS Secrets Manager.
- Store non-sensitive runtime config as plain ECS task environment variables.
- Send ECS container logs to CloudWatch Logs.
- Create an AWS Budget cost alert for the lab with a `30 USD` monthly limit and alerts at `50%`, `80%`, and `100%`.
- Expose the API through the ALB DNS name using HTTP.
- Configure ALB health checks against `GET /health`.
- Keep security groups narrow enough for the lab:
  - Internet to ALB on port `80`.
  - ALB to ECS service on the app port.
  - ECS service to RDS on port `5432`.
- Include Terraform outputs for the ALB DNS name, ECR repository URL, ECS cluster/service names, and RDS endpoint.

### Out of Scope

- Route 53 hosted zones or DNS records.
- ACM TLS certificates and HTTPS listeners.
- SSM Parameter Store, because plain ECS environment variables are enough for non-sensitive lab config.
- GitHub Actions, CI/CD, or automatic image deployment.
- Redis or ElastiCache, because the current codebase does not use a Redis client.
- Kubernetes, EKS, App Runner, or Elastic Beanstalk.
- Multi-environment Terraform folders beyond `prod`.
- Multi-AZ/high-availability RDS beyond what is required by the selected low-cost lab instance.
- Automatic database migration execution during ECS deploy.
- Production incident alarms beyond the lab AWS Budget alert and basic CloudWatch log retention.

## Proposed Approach

### Terraform Layout

Use `infra/terraform/environments/prod` as the composition layer. It should configure the AWS provider, call reusable modules, define environment-specific variables, and expose final outputs.

Recommended files:

```text
infra/terraform/environments/prod/
  main.tf
  variables.tf
  outputs.tf
  providers.tf
  terraform.tfvars.example
  versions.tf

infra/terraform/modules/networking/
  main.tf
  variables.tf
  outputs.tf

infra/terraform/modules/database/
  main.tf
  variables.tf
  outputs.tf

infra/terraform/modules/service/
  main.tf
  variables.tf
  outputs.tf
```

Keep module boundaries simple:

- `networking`: VPC, subnets, route tables, internet gateway, security groups, and ALB.
- `database`: RDS PostgreSQL subnet group, instance, generated/stored password, and database security group rules.
- `service`: ECR, ECS cluster, task definition, Fargate service, IAM roles, CloudWatch log group, target group, and ALB listener wiring.

Create the AWS Budget resource directly in `infra/terraform/environments/prod`, not as a separate module. The current module structure should stay limited to `networking`, `database`, and `service`.

### Resolved Decisions

- AWS region: `us-east-1`.
- Networking: use public ECS Fargate tasks for the first version, with inbound traffic restricted to the ALB security group.
- Budget: create a monthly AWS Budget in Terraform with a `30 USD` limit.
- Budget alerts: notify at `50%`, `80%`, and `100%` of the monthly budget.
- Budget notification email: `lokermia@gmail.com`.
- RDS instance class: `db.t4g.micro`.
- Manual Docker image tag convention: `git-<short-commit-sha>`, for example `git-a1b2c3d`.

### Networking

Create one VPC with at least two Availability Zones. Public subnets host the internet-facing ALB and the first-version ECS tasks. Private subnets host RDS.

For a low-cost lab, prefer avoiding NAT Gateway unless the service needs outbound internet access from private ECS tasks. If ECS tasks must pull from ECR while staying private, configure VPC endpoints for ECR, CloudWatch Logs, and Secrets Manager where practical, or accept a NAT Gateway with a clear cost warning.

If cost is the primary lab constraint, an acceptable first version is:

- ALB in public subnets.
- ECS tasks in public subnets with no public ingress and access restricted by security group to the ALB.
- RDS in private subnets.

Use this public ECS task version for the first lab implementation. The more production-like private ECS task shape is deferred.

### Service

Deploy one ECS Fargate service for `auth-service`.

Initial task settings:

- CPU: `256`.
- Memory: `512`.
- Desired count: `1`.
- Container port: `3001`.
- `PORT=3001`.
- Health check path: `/health`.

The existing Dockerfile exposes `3000`, while the app defaults to `3001`. Terraform should set `PORT=3001` and map the ECS container port to `3001`. A follow-up code cleanup may update the Dockerfile `EXPOSE` instruction to match, but the runtime port is controlled by the environment variable.

Use ECR as the image source. Because CI/CD is out of scope, the first deployment can use a manually built and pushed image tag supplied through Terraform, for example:

```text
container_image = "<account>.dkr.ecr.us-east-1.amazonaws.com/auth-service:git-a1b2c3d"
```

Manual deploys should use `git-<short-commit-sha>` tags and should avoid `latest` as the deployment tag.

### Runtime Configuration

Pass non-sensitive values directly as ECS environment variables when appropriate:

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

Store sensitive values in Secrets Manager and inject them into the ECS task definition as secrets:

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

The RDS password should be generated by Terraform and stored in Secrets Manager unless a password is explicitly supplied through a secure process.

### Database

Provision one RDS PostgreSQL instance for the lab:

- Engine: PostgreSQL.
- Version: compatible with local PostgreSQL 16 where available.
- Instance class: `db.t4g.micro`.
- Storage: low-cost default with autoscaling disabled unless needed.
- Public accessibility: `false`.
- Security group: only allow `5432` from the ECS service security group.
- Backups: minimal retention suitable for a lab.
- Deletion protection: `false` for lab teardown, with documentation that production should enable it.

Migrations are out of scope for Terraform. After the first deploy, migrations can be run manually from a trusted environment that can reach the database, or handled later by a deployment job.

### Load Balancing

Create an internet-facing ALB with:

- HTTP listener on port `80`.
- Target group pointing to ECS Fargate tasks.
- Target type `ip`.
- Health check path `/health`.
- Matcher `200`.

Terraform should output the ALB DNS name. For this lab, users will access:

```text
http://<alb-dns-name>
```

### Logging

Create a CloudWatch log group for the ECS task. Use a short retention period for lab cost control, for example `7` or `14` days.

Application logs should use the `awslogs` ECS log driver with stream names that include the service/container name.

### State Management

For a solo lab, local Terraform state is acceptable for the first implementation if it is documented and not committed.

Recommended next step after the first working deployment:

- S3 backend with bucket versioning.
- DynamoDB state locking if multiple machines or collaborators will apply infrastructure.

Do not store Terraform state files, tfvars containing secrets, or generated plans with secrets in git.

### Budget

Create an AWS Budget in `infra/terraform/environments/prod` with:

- Monthly cost budget.
- Limit: `30 USD`.
- Actual cost alerts at:
  - `50%` / `15 USD`.
  - `80%` / `24 USD`.
  - `100%` / `30 USD`.

Use a Terraform variable such as `budget_alert_email` for the notification subscriber email. For this lab, set the default/example value to `lokermia@gmail.com`.

## Milestones

1. Create Terraform skeleton
   - Add `infra/terraform/environments/prod`.
   - Add `networking`, `database`, and `service` module folders.
   - Configure AWS provider and required Terraform version.
   - Add `terraform.tfvars.example` with placeholders and no secrets.

2. Implement networking
   - Create VPC, subnets, route tables, and internet gateway.
   - Create security groups for ALB, ECS, and RDS.
   - Create the internet-facing ALB.

3. Implement database
   - Create RDS subnet group.
   - Create RDS PostgreSQL instance.
   - Generate/store database credentials through Secrets Manager.
   - Output the RDS endpoint and database connection metadata.

4. Implement service infrastructure
   - Create ECR repository.
   - Create ECS cluster.
   - Create CloudWatch log group.
   - Create task execution/task IAM roles.
   - Create ECS task definition and service.
   - Wire ECS service to the ALB target group.

5. Wire configuration and secrets
   - Map current `.env.example` values into ECS environment variables or secrets.
   - Ensure database env vars point to the Terraform-created RDS instance.
   - Ensure OAuth public base URL and app base URL can be set to the ALB HTTP URL for the lab.

6. Add budget guardrail
   - Create the monthly AWS Budget in the `prod` environment layer.
   - Add alert thresholds at `50%`, `80%`, and `100%`.
   - Use `budget_alert_email = "lokermia@gmail.com"` as the lab notification target.

7. Validate deployment manually
   - Build and push the Docker image to ECR manually.
   - Apply Terraform from `infra/terraform/environments/prod`.
   - Confirm the ECS service reaches steady state.
   - Confirm `GET /health` returns `200` through the ALB DNS name.

## Acceptance Criteria

- [ ] `infra/terraform/environments/prod` exists and composes the Terraform modules.
- [ ] `infra/terraform/modules/networking`, `database`, and `service` exist with clear variables and outputs.
- [ ] Terraform uses the official AWS provider.
- [ ] Terraform provisions an internet-facing ALB reachable over HTTP.
- [ ] Terraform provisions ECS Fargate running one `auth-service` task.
- [ ] Terraform provisions an ECR repository for the service image.
- [ ] Terraform provisions RDS PostgreSQL and keeps it inaccessible from the public internet.
- [ ] ECS receives required app config from environment variables and AWS-managed secrets.
- [ ] Terraform creates a monthly AWS Budget with a `30 USD` limit.
- [ ] Budget alerts exist at `50%`, `80%`, and `100%`.
- [ ] Sensitive values are not committed to the repository.
- [ ] ECS logs are visible in CloudWatch Logs.
- [ ] The ALB target group health check uses `/health`.
- [ ] Terraform outputs include the ALB DNS name.
- [ ] Visiting `http://<alb-dns-name>/health` returns `{"status":"ok"}` after deployment.
- [ ] No Route 53, ACM, custom domain, or HTTPS resources are created in this lab version.
- [ ] No Redis/ElastiCache resources are created.

## Test Plan

### Static Validation

- Run `terraform fmt -recursive` under `infra/terraform`.
- Run `terraform init` from `infra/terraform/environments/prod`.
- Run `terraform validate` from `infra/terraform/environments/prod`.
- Run `terraform plan` and confirm it creates only the intended AWS resources.

### Deployment Validation

- Build the Docker image from the repository `Dockerfile`.
- Push the image to the Terraform-created ECR repository.
- Apply Terraform.
- Confirm the ECS service reaches steady state.
- Confirm the ALB target group reports the task as healthy.
- Call `GET http://<alb-dns-name>/health` and verify a `200` response.
- Call `GET http://<alb-dns-name>/` and verify the service metadata response.

### Database Validation

- Confirm the ECS task can connect to RDS using the injected `DB_*` variables.
- Run migrations manually from an approved environment and verify tables are created.
- Run seeds manually if test application data is required.

### Security Validation

- Confirm RDS has `publicly_accessible = false`.
- Confirm RDS security group only accepts inbound PostgreSQL traffic from the ECS service security group.
- Confirm ECS service inbound traffic only comes from the ALB security group.
- Confirm secrets are referenced from Secrets Manager and are not present in `.tfvars`, outputs, logs, or committed files.
- Confirm the AWS Budget uses a `30 USD` monthly limit and sends alerts to the configured subscriber email.

## Risks and Mitigations

- Risk: Running ALB, ECS Fargate, RDS, NAT Gateway, and VPC endpoints can create billable AWS usage.
  - Mitigation: Keep desired count at `1`, use `db.t4g.micro`, short log retention, avoid NAT Gateway for the first lab version, and create the `30 USD` AWS Budget through Terraform.

- Risk: The lab has no HTTPS because DNS and ACM are out of scope.
  - Mitigation: Use HTTP only for non-production testing. Add Route 53 and ACM later when a real domain is available.

- Risk: ECS tasks in private subnets may not pull ECR images or write logs without outbound access.
  - Mitigation: Use public-subnet ECS tasks restricted by security groups for the first lab. Defer private ECS tasks with NAT Gateway or VPC endpoints.

- Risk: Terraform can destroy lab data if RDS deletion protection is disabled.
  - Mitigation: Keep this acceptable for lab teardown, but document that real production should enable deletion protection and stronger backups.

- Risk: OAuth callback URLs will change when using the ALB DNS name.
  - Mitigation: Configure `OAUTH_PUBLIC_BASE_URL`, provider callback paths, and provider console callback URLs to match the current ALB HTTP URL during the lab.

- Risk: Database migrations are not part of Terraform.
  - Mitigation: Run migrations manually after initial deploy and define a separate deployment process later.

## Implementation Input

- No unresolved implementation inputs remain for the first lab version.
