# Adding TLS To Auth Service ALB Plan

## Goal

Implement the TLS changes from `_docs/specs/0003-Adding-TLS.md` so the auth-service backend is reachable at:

```text
https://api.auth.phablovilasboas.tech
```

This plan now uses `api.auth.phablovilasboas.tech` because the earlier `api.labs.phablovilasboas.tech` ACM request failed with `CAA_ERROR` through the Vercel-managed `labs` DNS chain.

The implementation should terminate TLS at the AWS Application Load Balancer, keep DNS hosted in Hostinger, and keep the ECS task receiving HTTP traffic from the ALB on the application port.

## Source Spec

- `_docs/specs/0003-Adding-TLS.md`

## Decisions

- Use `api.auth.phablovilasboas.tech` as the backend API domain.
- Keep `phablovilasboas.tech` DNS management in Hostinger.
- Create and validate the ACM certificate manually in AWS.
- Pass only `acm_certificate_arn` into Terraform.
- Keep `acm_certificate_arn` optional so the first Terraform apply can create the ALB before the certificate exists.
- Keep `allowed_cidr_blocks = ["0.0.0.0/0"]` because this is a public API.
- Keep `desired_count = 1` for now.
- Keep ALB-to-ECS traffic as HTTP on the app port.
- Use `OAUTH_FRONTEND_REDIRECT_ALLOWLIST = "https://labs.phablovilasboas.tech"`.

## Implementation Steps

### 1. Update Networking Module For HTTPS Ingress

Files:

- `infra/terraform/modules/networking/main.tf`
- `infra/terraform/modules/networking/variables.tf`

Tasks:

- Keep ALB inbound HTTP `80/tcp` from `var.allowed_cidr_blocks`.
- Add ALB inbound HTTPS `443/tcp` from `var.allowed_cidr_blocks`.
- Update the ALB security group description from HTTP-only wording to HTTP/HTTPS wording.
- Do not change the ECS security group rule; ECS should still accept app-port traffic only from the ALB security group.
- Do not change the RDS security group.

Expected result:

```text
Internet -> ALB :80
Internet -> ALB :443
ALB -> ECS :3001
ECS -> RDS :5432
```

### 2. Add Optional Certificate Input To Service Module

Files:

- `infra/terraform/modules/service/variables.tf`
- `infra/terraform/modules/service/main.tf`

Tasks:

- Add an optional `acm_certificate_arn` variable:

```hcl
variable "acm_certificate_arn" {
  description = "Optional ACM certificate ARN used to enable HTTPS on the ALB."
  type        = string
  default     = null
}
```

- Add a local boolean for readability, for example:

```hcl
tls_enabled = var.acm_certificate_arn != null
```

### 3. Make ALB Listener Behavior Conditional

Files:

- `infra/terraform/modules/service/main.tf`

Tasks:

- Keep a listener on port `80`.
- When `acm_certificate_arn` is not provided, port `80` should keep forwarding to the ECS target group.
- When `acm_certificate_arn` is provided, port `80` should redirect to HTTPS `443` with `HTTP_301`.
- Add an HTTPS listener on port `443` only when `acm_certificate_arn` is provided.
- Configure the HTTPS listener with:

```text
protocol        = HTTPS
certificate_arn = var.acm_certificate_arn
default_action  = forward to aws_lb_target_group.main
```

- Keep the target group protocol as HTTP.
- Update `aws_ecs_service.main.depends_on` so service creation waits for the correct listener resources.

Important implementation note:

- Terraform cannot conditionally change only a nested `default_action` block with a plain `if`.
- Use dynamic blocks or split listener resources with `count` so only one HTTP listener definition owns port `80` at a time.

### 4. Wire TLS Inputs Through The Prod Environment

Files:

- `infra/terraform/environments/prod/variables.tf`
- `infra/terraform/environments/prod/main.tf`
- `infra/terraform/environments/prod/terraform.tfvars.example`

Tasks:

- Add optional `acm_certificate_arn` to prod variables with `default = null`.
- Pass `acm_certificate_arn = var.acm_certificate_arn` into `module "service"`.
- Add the example value to `terraform.tfvars.example`:

```hcl
acm_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/example"
```

- Update example application environment variables:

```hcl
APP_BASE_URL                    = "https://api.auth.phablovilasboas.tech"
OAUTH_PUBLIC_BASE_URL           = "https://api.auth.phablovilasboas.tech"
OAUTH_FRONTEND_REDIRECT_ALLOWLIST = "https://labs.phablovilasboas.tech"
```

### 5. Add API Domain Outputs

Files:

- `infra/terraform/environments/prod/main.tf`
- `infra/terraform/environments/prod/outputs.tf`

Tasks:

- Add a local value or variable for:

```hcl
api_domain_name = "api.auth.phablovilasboas.tech"
```

- Keep outputting the raw `alb_dns_name`; it is required for Hostinger CNAME setup.
- Add outputs for:

```text
api_domain_name = api.auth.phablovilasboas.tech
api_url         = https://api.auth.phablovilasboas.tech
alb_url         = https://api.auth.phablovilasboas.tech
```

- If `alb_url` currently returns the raw HTTP ALB URL, update its description and value to the final HTTPS API URL.

### 6. Update Terraform README

Files:

- `infra/terraform/README.md`

Tasks:

- Replace HTTP-only architecture wording with HTTPS-at-ALB wording.
- Remove or revise statements saying ACM/HTTPS/custom domains are intentionally excluded.
- Document the two-apply rollout:
  - First apply without `acm_certificate_arn` if the ALB does not exist yet.
  - Manually create and validate ACM certificate.
  - Add Hostinger DNS records.
  - Second apply with `acm_certificate_arn`.
- Document the required ACM certificate:

```text
Domain: api.auth.phablovilasboas.tech
Region: us-east-1
Validation: DNS
```

- Document Hostinger DNS records:

```text
<ACM validation CNAME name>  CNAME  <ACM validation CNAME value>
api.auth                    CNAME  <ALB DNS name>
```

- Document OAuth callback URLs:

```text
https://api.auth.phablovilasboas.tech/api/auth/oauth/google/callback
https://api.auth.phablovilasboas.tech/api/auth/oauth/github/callback
```

- Update validation commands:

```bash
curl -I http://api.auth.phablovilasboas.tech/health
curl https://api.auth.phablovilasboas.tech/health
```

### 7. Validate Terraform Locally

Commands:

```bash
terraform fmt -recursive infra/terraform
terraform -chdir=infra/terraform/environments/prod validate
```

If providers are not initialized yet, run:

```bash
terraform -chdir=infra/terraform/environments/prod init
```

Expected result:

- Formatting passes.
- Terraform validation passes.
- The configuration works with `acm_certificate_arn = null`.
- The configuration also plans successfully when a real ACM certificate ARN is provided.

### 8. First Apply Without TLS Certificate

Prerequisite:

- A valid `container_image` is configured.

Command:

```bash
terraform -chdir=infra/terraform/environments/prod apply
```

Purpose:

- Create the ALB if it does not already exist.
- Get the raw ALB DNS name from Terraform output.

Command:

```bash
terraform -chdir=infra/terraform/environments/prod output alb_dns_name
```

### 9. Create ACM Certificate Manually

AWS Console steps:

- Open AWS Certificate Manager in `us-east-1`.
- Request a public certificate.
- Use domain:

```text
api.auth.phablovilasboas.tech
```

- Choose DNS validation.
- Copy the generated ACM validation CNAME name and value.

Hostinger steps:

- Add the ACM validation CNAME to the `phablovilasboas.tech` DNS zone.
- Wait until ACM status becomes `Issued`.
- Copy the ACM certificate ARN.

### 10. Point API Domain To The ALB

Hostinger DNS:

```text
Type:  CNAME
Name:  api.auth
Value: <terraform alb_dns_name output>
TTL:   default
```

Purpose:

- Send requests for `api.auth.phablovilasboas.tech` to the AWS ALB.

### 11. Second Apply With TLS Certificate

Update `terraform.tfvars`:

```hcl
acm_certificate_arn = "arn:aws:acm:us-east-1:<account-id>:certificate/<certificate-id>"
```

Apply:

```bash
terraform -chdir=infra/terraform/environments/prod apply
```

Expected Terraform changes:

- Add HTTPS listener on ALB port `443`.
- Change HTTP listener on port `80` to redirect to HTTPS.
- Keep ECS target group HTTP on app port `3001`.

### 12. Manual Verification

DNS:

```bash
dig api.auth.phablovilasboas.tech
```

HTTP redirect:

```bash
curl -I http://api.auth.phablovilasboas.tech/health
```

Expected:

```text
HTTP 301 or 302 redirect to https://api.auth.phablovilasboas.tech/health
```

HTTPS health:

```bash
curl https://api.auth.phablovilasboas.tech/health
```

Expected:

```json
{"status":"ok"}
```

Certificate:

- Open `https://api.auth.phablovilasboas.tech/health` in a browser.
- Confirm the certificate is valid for `api.auth.phablovilasboas.tech`.

OAuth:

- Confirm Google/GitHub OAuth apps use HTTPS callback URLs.
- Confirm frontend config calls:

```text
https://api.auth.phablovilasboas.tech
```

## Acceptance Checklist

- [ ] ALB security group allows inbound `80/tcp` and `443/tcp`.
- [ ] Service module accepts optional `acm_certificate_arn`.
- [ ] First Terraform apply works with `acm_certificate_arn = null`.
- [ ] HTTP-only mode forwards port `80` traffic to ECS.
- [ ] TLS mode creates HTTPS listener on port `443`.
- [ ] TLS mode redirects HTTP port `80` to HTTPS.
- [ ] ECS target group remains HTTP on app port `3001`.
- [ ] Prod environment passes `acm_certificate_arn` to the service module.
- [ ] Outputs include raw ALB DNS name and final HTTPS API URL.
- [ ] `terraform.tfvars.example` includes `acm_certificate_arn`.
- [ ] README documents ACM and Hostinger manual steps.
- [ ] ACM certificate is issued in `us-east-1`.
- [ ] Hostinger has the ACM validation CNAME.
- [ ] Hostinger has `api.auth` CNAME pointing to the ALB DNS name.
- [ ] `http://api.auth.phablovilasboas.tech/health` redirects to HTTPS.
- [ ] `https://api.auth.phablovilasboas.tech/health` returns the health response.
- [ ] Browser shows a valid certificate for `api.auth.phablovilasboas.tech`.

## Rollback Plan

If HTTPS rollout fails:

1. Remove or comment out `acm_certificate_arn` from `terraform.tfvars`.
2. Run:

```bash
terraform -chdir=infra/terraform/environments/prod apply
```

3. Terraform should return the ALB to HTTP-forwarding mode.
4. Keep the ACM certificate and Hostinger validation record in place for a later retry unless they are known to be wrong.

If the Hostinger `api.auth` CNAME points to the wrong ALB:

1. Correct the CNAME value in Hostinger.
2. Wait for DNS propagation.
3. Re-run the manual verification commands.

## Notes

- The Hostinger SSL certificate is not used by the AWS ALB.
- The ACM certificate must be in the same AWS region as the ALB.
- Do not use the raw ALB DNS name as the frontend API URL for HTTPS. The certificate must match the hostname users call.
- This plan does not move DNS to Route 53 and does not automate Hostinger DNS records.
