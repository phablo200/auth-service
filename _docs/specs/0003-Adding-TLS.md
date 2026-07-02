# Add TLS For Auth Service ALB

## Objective

Expose the production auth-service backend through HTTPS using the public domain:

```text
https://api.auth.phablovilasboas.tech
```

This supersedes the original `api.labs.phablovilasboas.tech` target. ACM validation for `api.labs` failed with `CAA_ERROR` because `labs.phablovilasboas.tech` is a CNAME to Vercel and inherits CAA records that do not allow Amazon certificate issuance.

The domain is managed in Hostinger under `phablovilasboas.tech`. AWS should terminate TLS at the existing Application Load Balancer using an AWS Certificate Manager certificate. The ECS task can continue receiving plain HTTP from the ALB on the application port because that traffic stays inside the AWS network boundary.

## Background

The current Terraform deployment is intentionally HTTP-only. The request path today is:

```text
Internet
  -> ALB listener on HTTP :80
  -> ECS Fargate task on app port 3001
```

Current relevant files:

- `infra/terraform/modules/networking/main.tf`
  - Creates the public ALB.
  - Allows inbound traffic to the ALB security group only on port `80`.
- `infra/terraform/modules/service/main.tf`
  - Creates an `aws_lb_listener` on port `80`.
  - Forwards HTTP traffic directly to the ECS target group.
- `infra/terraform/environments/prod/outputs.tf`
  - Outputs an `http://` ALB URL.
- `infra/terraform/README.md`
  - Documents the architecture as HTTP-only and explicitly says ACM/HTTPS are not created.

For a login/auth service, public HTTP is not acceptable because credentials, OAuth codes, tokens, and cookies may cross the public internet. The desired public path should be:

```text
Browser/frontend
  -> HTTPS :443
  -> Application Load Balancer
  -> HTTP :3001
  -> ECS Fargate auth-service task
```

The Hostinger SSL certificate for `phablovilasboas.tech` is not the certificate the ALB should use. The ALB should use an ACM certificate issued in the same AWS region as the ALB, currently `us-east-1`.

## Scope

### In Scope

- Add HTTPS support to the existing ALB.
- Use `api.auth.phablovilasboas.tech` as the backend API domain.
- Use an ACM public certificate for `api.auth.phablovilasboas.tech`.
- Keep DNS hosted in Hostinger.
- Document the required Hostinger DNS records:
  - ACM validation CNAME.
  - API CNAME pointing to the ALB DNS name.
- Add ALB security group ingress for port `443`.
- Keep port `80` open only to redirect HTTP traffic to HTTPS.
- Add an HTTPS listener on port `443` that forwards to the existing ECS target group.
- Change the HTTP listener on port `80` to return a permanent redirect to HTTPS.
- Keep the ECS target group protocol as HTTP.
- Update Terraform variables, outputs, tfvars example, and README documentation.
- Update application-facing environment values that need the public HTTPS API base URL.

### Out of Scope

- Moving DNS from Hostinger to Route 53.
- Creating a Route 53 hosted zone.
- Using Hostinger's SSL certificate directly on the AWS ALB.
- End-to-end TLS from ALB to ECS task.
- Mutual TLS.
- CloudFront.
- WAF.
- Automatic DNS record creation in Hostinger.
- Changing OAuth provider apps in Google or GitHub, except documenting the callback URL values that must be configured there.
- Reworking ECS task placement, NAT, VPC endpoints, or private subnet design.

## Proposed Approach

Use TLS termination at the Application Load Balancer.

The final request flow should be:

```text
Client
  -> https://api.auth.phablovilasboas.tech
  -> Hostinger DNS CNAME
  -> AWS ALB DNS name
  -> ALB HTTPS listener :443 using ACM certificate
  -> ECS target group over HTTP
  -> auth-service container on port 3001
```

### Certificate And DNS

Create or request an ACM public certificate for:

```text
api.auth.phablovilasboas.tech
```

The certificate must be in:

```text
us-east-1
```

because the current Terraform environment defaults `aws_region` to `us-east-1`.

Recommended implementation for this repo:

- Manage the ALB HTTPS listener in Terraform.
- Pass the issued ACM certificate ARN into Terraform as `acm_certificate_arn`.
- Keep ACM DNS validation as a documented manual step because DNS lives in Hostinger, not Route 53.
- Keep `acm_certificate_arn` optional so the first Terraform apply can create the HTTP-only ALB before the certificate exists.

This avoids Terraform needing a Hostinger DNS provider or blocking indefinitely while waiting for a DNS record it cannot create.

Required Hostinger DNS records:

```text
<ACM validation CNAME name>  CNAME  <ACM validation CNAME value>
api.auth                    CNAME  <ALB DNS name>
```

The ACM validation CNAME name and value come from AWS ACM after requesting the certificate. The ALB DNS name comes from Terraform output `alb_dns_name`.

### Terraform Changes

#### `infra/terraform/modules/networking`

Update the ALB security group to allow both HTTP and HTTPS from `var.allowed_cidr_blocks`:

```text
80/tcp   -> redirect to HTTPS
443/tcp  -> serve HTTPS traffic
```

The ECS security group remains unchanged. It should continue allowing only app-port traffic from the ALB security group.

#### `infra/terraform/modules/service`

Add a new variable:

```hcl
variable "acm_certificate_arn" {
  description = "Optional ACM certificate ARN used to enable HTTPS on the ALB."
  type        = string
  default     = null
}
```

Make the listener behavior conditional:

- When `acm_certificate_arn` is `null`, keep the HTTP listener forwarding to the ECS target group.
- When `acm_certificate_arn` is provided, change the HTTP listener to redirect to protocol `HTTPS`, port `443`, status code `HTTP_301`.

Add the HTTPS listener only when `acm_certificate_arn` is provided:

```text
aws_lb_listener.https
  port            = 443
  protocol        = HTTPS
  certificate_arn = var.acm_certificate_arn
  default_action  = forward to aws_lb_target_group.main
```

Update the ECS service `depends_on` to depend on the HTTPS listener instead of relying only on the HTTP listener.

Keep the target group as:

```text
protocol = HTTP
port     = var.app_port
```

This is intentional. TLS terminates at the ALB; the application container does not need to serve HTTPS directly.

#### `infra/terraform/environments/prod`

Add a production variable:

```hcl
variable "acm_certificate_arn" {
  description = "Optional ACM certificate ARN for api.auth.phablovilasboas.tech."
  type        = string
  default     = null
}
```

Pass it into `module "service"`:

```hcl
acm_certificate_arn = var.acm_certificate_arn
```

Add a local or variable for the API domain:

```hcl
api_domain_name = "api.auth.phablovilasboas.tech"
```

Use it in outputs:

```text
api_domain_name = api.auth.phablovilasboas.tech
api_url         = https://api.auth.phablovilasboas.tech
alb_url         = https://api.auth.phablovilasboas.tech
```

Keep `alb_dns_name` output because it is needed for the Hostinger CNAME.

Update `terraform.tfvars.example`:

```hcl
acm_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/example"
```

Update relevant app environment defaults or example values:

```hcl
APP_BASE_URL          = "https://api.auth.phablovilasboas.tech"
OAUTH_PUBLIC_BASE_URL = "https://api.auth.phablovilasboas.tech"
OAUTH_FRONTEND_REDIRECT_ALLOWLIST = "https://labs.phablovilasboas.tech"
```

The OAuth callback paths can remain path-only:

```text
/api/auth/oauth/google/callback
/api/auth/oauth/github/callback
```

The full provider callback URLs become:

```text
https://api.auth.phablovilasboas.tech/api/auth/oauth/google/callback
https://api.auth.phablovilasboas.tech/api/auth/oauth/github/callback
```

### Documentation Changes

Update `infra/terraform/README.md`:

- Replace HTTP-only architecture text with HTTPS-at-ALB architecture.
- Add ACM prerequisite steps.
- Add Hostinger DNS setup steps.
- Change validation from:

```bash
curl http://<alb-dns-name>/health
```

to:

```bash
curl -I http://api.auth.phablovilasboas.tech/health
curl https://api.auth.phablovilasboas.tech/health
```

Expected behavior:

- HTTP returns a redirect to HTTPS.
- HTTPS returns the health response.

## Milestones

1. Add Terraform inputs and security group changes.
   - Add `acm_certificate_arn` to the prod environment and service module.
   - Add HTTPS ingress to the ALB security group.
   - Keep HTTP ingress for redirect support.

2. Add ALB listener changes.
   - Convert the HTTP listener from forward to HTTPS redirect.
   - Add a new HTTPS listener forwarding to the existing target group.
   - Update service dependencies.

3. Update outputs and environment examples.
   - Add API domain/URL outputs.
   - Keep the raw ALB DNS output for DNS setup.
   - Update `terraform.tfvars.example` with `acm_certificate_arn`.
   - Set API base URL examples to `https://api.auth.phablovilasboas.tech`.

4. Update deployment documentation.
   - Document ACM certificate creation in `us-east-1`.
   - Document Hostinger DNS validation CNAME.
   - Document Hostinger API CNAME to the ALB DNS name.
   - Document HTTPS validation commands.

5. Apply and verify manually.
   - Apply Terraform once without `acm_certificate_arn` if the ALB does not exist yet.
   - Request and validate the ACM certificate manually.
   - Apply Terraform again with the certificate ARN.
   - Add/update Hostinger API CNAME.
   - Verify redirect and HTTPS health endpoint.

## Resolved Decisions

- ACM certificate creation remains manual. Terraform receives only `acm_certificate_arn`.
- `acm_certificate_arn` should be optional so the first apply can create the ALB before the certificate exists.
- `allowed_cidr_blocks` remains public as `["0.0.0.0/0"]`.
- `desired_count` remains `1` for now.
- The frontend production domain for OAuth redirects is:

```hcl
OAUTH_FRONTEND_REDIRECT_ALLOWLIST = "https://labs.phablovilasboas.tech"
```

## Edge Cases

- ACM certificate is created in the wrong AWS region.
  - The ALB listener will not be able to use it.
- Hostinger DNS validation record is missing or incorrect.
  - ACM certificate remains pending and cannot be used.
- `api.auth.phablovilasboas.tech` already points somewhere else.
  - Updating the CNAME will move that subdomain to the ALB.
- DNS propagation is delayed.
  - HTTPS may work through the ALB DNS but not through the final domain until propagation completes.
- OAuth providers still use old HTTP callback URLs.
  - OAuth login can fail even if `/health` works.
- Frontend still calls `http://` backend URL.
  - Browser may block requests from an HTTPS frontend due to mixed content.
- Existing clients may call the raw ALB DNS name.
  - They should move to the stable API domain.

## Acceptance Criteria

- [ ] Terraform defines an HTTPS ALB listener on port `443`.
- [ ] Terraform uses an ACM certificate ARN for `api.auth.phablovilasboas.tech`.
- [ ] Terraform keeps an HTTP listener on port `80` that redirects to HTTPS.
- [ ] ALB security group allows inbound `80/tcp` and `443/tcp` from `allowed_cidr_blocks`.
- [ ] ECS target group remains HTTP on the app port.
- [ ] Terraform outputs the raw ALB DNS name and the final API URL.
- [ ] `terraform.tfvars.example` includes `acm_certificate_arn`.
- [ ] README documents ACM creation, Hostinger DNS validation, and the `api.auth` CNAME.
- [ ] `http://api.auth.phablovilasboas.tech/health` returns an HTTP redirect to HTTPS.
- [ ] `https://api.auth.phablovilasboas.tech/health` returns the auth-service health response.
- [ ] Browser certificate inspection shows a valid certificate for `api.auth.phablovilasboas.tech`.

## Test Plan

- Unit:
  - No application unit tests are required because this change is infrastructure-only.

- Terraform:
  - Run `terraform fmt -check` for changed Terraform files.
  - Run `terraform -chdir=infra/terraform/environments/prod validate`.
  - Run `terraform -chdir=infra/terraform/environments/prod plan` with a real `acm_certificate_arn`.

- Manual verification:
  - Confirm ACM certificate status is `Issued`.
  - Confirm Hostinger has the ACM validation CNAME.
  - Confirm Hostinger has `api.auth` CNAME pointing to the ALB DNS name.
  - Run:

```bash
curl -I http://api.auth.phablovilasboas.tech/health
curl https://api.auth.phablovilasboas.tech/health
```

  - Confirm HTTP redirects to HTTPS.
  - Confirm HTTPS returns the expected health payload.
  - Confirm frontend `.env` uses:

```text
https://api.auth.phablovilasboas.tech
```

## Risks and Mitigations

- Risk: Certificate is requested in the wrong AWS region.
  - Mitigation: Document and validate that the certificate ARN starts with `arn:aws:acm:us-east-1:`.

- Risk: Terraform cannot manage Hostinger DNS records.
  - Mitigation: Treat Hostinger DNS as a manual prerequisite and document the exact CNAME records.

- Risk: OAuth callbacks break after switching to HTTPS.
  - Mitigation: Document final callback URLs and update Google/GitHub OAuth app settings before production use.

- Risk: Existing HTTP clients fail after redirect.
  - Mitigation: Use permanent HTTP-to-HTTPS redirect and update frontend/backend config to use HTTPS directly.

- Risk: DNS propagation delays cause temporary access failures.
  - Mitigation: Validate first with ACM and ALB DNS, then wait for public DNS propagation before declaring rollout complete.

## Open Questions

- None at this time.
