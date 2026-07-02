# Update Backend DNS From api.labs To api.auth

## Objective

Move the backend API public domain from:

```text
https://api.labs.phablovilasboas.tech
```

to:

```text
https://api.auth.phablovilasboas.tech
```

The goal is to unblock ACM certificate issuance and keep the frontend/backend split clear:

```text
Frontend: https://labs.phablovilasboas.tech
Backend:  https://api.auth.phablovilasboas.tech
```

## Background

The TLS implementation in `_docs/specs/0003-Adding-TLS.md` originally selected:

```text
api.labs.phablovilasboas.tech
```

During ACM validation, the certificate request failed with:

```text
FailureReason: CAA_ERROR
```

The DNS investigation showed:

- `labs.phablovilasboas.tech` is already a CNAME to `cname.vercel-dns.com`.
- Vercel's DNS target publishes CAA records that allow issuers such as Let's Encrypt, Google, GlobalSign, and Sectigo.
- Those inherited CAA records do not allow Amazon/ACM to issue a certificate for `api.labs.phablovilasboas.tech`.
- The ACM validation CNAME and API CNAME were otherwise visible publicly.

Using a sibling branch under `phablovilasboas.tech` avoids the `labs` CNAME/CAA inheritance problem:

```text
api.auth.phablovilasboas.tech
```

This requires updating IaC because Terraform currently emits outputs and ECS environment variables for the old API domain.

Current infrastructure state:

- ALB exists and is reachable at:

```text
auth-service-prod-alb-1829541798.us-east-1.elb.amazonaws.com
```

- ECS service is running with desired count `1`.
- TLS remains optional through `acm_certificate_arn`.
- Hostinger remains the DNS provider.
- ACM certificate creation remains manual.

## Scope

### In Scope

- Replace backend API domain references from `api.labs.phablovilasboas.tech` to `api.auth.phablovilasboas.tech`.
- Keep frontend domain as `https://labs.phablovilasboas.tech`.
- Keep `OAUTH_FRONTEND_REDIRECT_ALLOWLIST = "https://labs.phablovilasboas.tech"`.
- Request a new ACM certificate for `api.auth.phablovilasboas.tech`.
- Add new Hostinger DNS records:
  - ACM validation CNAME for the new certificate.
  - API CNAME from `api.auth` to the ALB DNS name.
- Update Terraform environment locals, variables, tfvars example, outputs, and README.
- Update the TLS plan/spec references where they are used as implementation guidance.
- Delete or ignore the failed ACM certificate for `api.labs.phablovilasboas.tech`.
- Apply Terraform with the new issued ACM certificate ARN.

### Out of Scope

- Moving DNS from Hostinger to Route 53.
- Automating Hostinger DNS record creation.
- Changing frontend hosting on `labs.phablovilasboas.tech`.
- Changing the frontend OAuth redirect allowlist away from `https://labs.phablovilasboas.tech`.
- Changing ECS desired count.
- Changing ALB-to-ECS traffic from HTTP to HTTPS.
- Adding CloudFront, WAF, or Route 53.
- Reworking VPC, subnets, ECS placement, NAT, or RDS.

## Proposed Approach

Use `api.auth.phablovilasboas.tech` as the final backend API domain.

Final request flow:

```text
Client
  -> https://api.auth.phablovilasboas.tech
  -> Hostinger DNS CNAME
  -> auth-service-prod-alb-1829541798.us-east-1.elb.amazonaws.com
  -> ALB HTTPS listener :443 using ACM certificate
  -> ECS target group over HTTP
  -> auth-service container on port 3001
```

### Terraform Updates

Update `infra/terraform/environments/prod/main.tf`:

```hcl
api_domain_name = "api.auth.phablovilasboas.tech"
```

Update `infra/terraform/environments/prod/variables.tf` defaults:

```hcl
OAUTH_PUBLIC_BASE_URL             = "https://api.auth.phablovilasboas.tech"
OAUTH_FRONTEND_REDIRECT_ALLOWLIST = "https://labs.phablovilasboas.tech"
APP_BASE_URL                      = "https://api.auth.phablovilasboas.tech"
```

Update `infra/terraform/environments/prod/terraform.tfvars.example` with the same values.

Update the `acm_certificate_arn` variable description from `api.labs...` to `api.auth...`.

Keep `infra/terraform/environments/prod/outputs.tf` behavior the same, but ensure outputs now resolve to:

```text
api_domain_name = api.auth.phablovilasboas.tech
api_url         = https://api.auth.phablovilasboas.tech
alb_url         = https://api.auth.phablovilasboas.tech
```

Keep `alb_dns_name` output because Hostinger needs it as the CNAME target.

### Documentation Updates

Update `infra/terraform/README.md`:

- Replace `api.labs.phablovilasboas.tech` with `api.auth.phablovilasboas.tech` for backend API references.
- Keep frontend references as `https://labs.phablovilasboas.tech`.
- Document the failed `api.labs` certificate as superseded by `api.auth`.
- Document Hostinger DNS records:

```text
<new ACM validation CNAME name>  CNAME  <new ACM validation CNAME value>
api.auth                        CNAME  auth-service-prod-alb-1829541798.us-east-1.elb.amazonaws.com
```

- Update OAuth callback URLs:

```text
https://api.auth.phablovilasboas.tech/api/auth/oauth/google/callback
https://api.auth.phablovilasboas.tech/api/auth/oauth/github/callback
```

- Update validation commands:

```bash
curl -I http://api.auth.phablovilasboas.tech/health
curl https://api.auth.phablovilasboas.tech/health
```

### DNS And Certificate Steps

In Hostinger, before requesting or while validating the new certificate, ensure there is no conflicting record at:

```text
auth.phablovilasboas.tech
```

If `auth.phablovilasboas.tech` is a CNAME to a service with restrictive CAA records, choose another sibling subdomain such as `api.phablovilasboas.tech`.

Request a new ACM public certificate:

```text
Domain: api.auth.phablovilasboas.tech
Region: us-east-1
Validation: DNS
Export: disabled
```

Add the ACM validation CNAME in Hostinger exactly as AWS provides it.

Add the API CNAME in Hostinger:

```text
Type:  CNAME
Name:  api.auth
Value: auth-service-prod-alb-1829541798.us-east-1.elb.amazonaws.com
TTL:   default
```

Wait until ACM status becomes:

```text
Issued
```

Then update local `terraform.tfvars`:

```hcl
acm_certificate_arn = "arn:aws:acm:us-east-1:407490667905:certificate/<new-certificate-id>"
```

Apply Terraform:

```bash
terraform -chdir=infra/terraform/environments/prod apply
```

## Milestones

1. Update IaC domain references.
   - Change `api_domain_name`.
   - Update app environment defaults.
   - Update `terraform.tfvars.example`.
   - Keep frontend allowlist unchanged.

2. Update documentation.
   - Update README backend API domain.
   - Update Hostinger DNS instructions.
   - Update ACM certificate instructions.
   - Update OAuth callback URLs.
   - Update validation commands.

3. Create new DNS/certificate records manually.
   - Confirm `auth.phablovilasboas.tech` has no restrictive parent CNAME/CAA issue.
   - Request ACM certificate for `api.auth.phablovilasboas.tech`.
   - Add ACM validation CNAME in Hostinger.
   - Add `api.auth` CNAME pointing to the ALB.
   - Wait for ACM status `Issued`.

4. Enable HTTPS through Terraform.
   - Set `acm_certificate_arn` to the new issued certificate ARN.
   - Run Terraform plan/apply.
   - Confirm HTTPS listener is active and HTTP redirects to HTTPS.

5. Clean up superseded DNS/cert artifacts.
   - Remove the failed ACM certificate request for `api.labs.phablovilasboas.tech`.
   - Remove the old `api.labs` CNAME if it is no longer needed.
   - Remove the old ACM validation CNAME for `api.labs` after confirming it is not used.

## Edge Cases

- `auth.phablovilasboas.tech` already has a CNAME to another service.
  - This can recreate the same CAA inheritance problem. Use `api.phablovilasboas.tech` instead or remove the conflicting parent record.

- Hostinger accepts full DNS names instead of relative names.
  - Prefer relative names in Hostinger: `api.auth` and the relative ACM validation name. If Hostinger displays the full final name correctly, the record is acceptable.

- ACM remains pending.
  - Verify the ACM validation CNAME is public and exactly matches AWS's generated name/value.

- ACM fails again with `CAA_ERROR`.
  - Check CAA records for `api.auth.phablovilasboas.tech`, `auth.phablovilasboas.tech`, and `phablovilasboas.tech`. Add an Amazon CAA allow record or choose a different subdomain without restrictive inheritance.

- OAuth providers still use old callback URLs.
  - Google/GitHub OAuth login can fail even if `/health` works.

- Frontend still calls the old API URL.
  - Browser requests will continue hitting `api.labs...` and may fail TLS or route incorrectly.

## Acceptance Criteria

- [ ] Terraform uses `api.auth.phablovilasboas.tech` as `api_domain_name`.
- [ ] Terraform environment defaults use `https://api.auth.phablovilasboas.tech` for `APP_BASE_URL`.
- [ ] Terraform environment defaults use `https://api.auth.phablovilasboas.tech` for `OAUTH_PUBLIC_BASE_URL`.
- [ ] `OAUTH_FRONTEND_REDIRECT_ALLOWLIST` remains `https://labs.phablovilasboas.tech`.
- [ ] `terraform.tfvars.example` references `api.auth.phablovilasboas.tech`.
- [ ] README references `api.auth.phablovilasboas.tech` for backend API instructions.
- [ ] Hostinger contains the new ACM validation CNAME for `api.auth`.
- [ ] Hostinger contains `api.auth` CNAME pointing to `auth-service-prod-alb-1829541798.us-east-1.elb.amazonaws.com`.
- [ ] ACM certificate for `api.auth.phablovilasboas.tech` is `Issued`.
- [ ] `acm_certificate_arn` in local `terraform.tfvars` uses the new issued certificate ARN.
- [ ] Terraform apply completes successfully.
- [ ] `http://api.auth.phablovilasboas.tech/health` redirects to HTTPS.
- [ ] `https://api.auth.phablovilasboas.tech/health` returns the auth-service health response.
- [ ] Browser certificate inspection shows a valid certificate for `api.auth.phablovilasboas.tech`.

## Test Plan

- Unit:
  - No application unit tests are required because this change is DNS/IaC configuration only.

- Terraform:
  - Run `terraform fmt -check -recursive infra/terraform`.
  - Run `terraform -chdir=infra/terraform/environments/prod validate`.
  - Run `terraform -chdir=infra/terraform/environments/prod plan`.

- DNS/ACM manual verification:
  - Confirm the new ACM validation CNAME resolves publicly.
  - Confirm `api.auth.phablovilasboas.tech` resolves to the ALB DNS name.
  - Confirm ACM status is `Issued`.

- Runtime manual verification:

```bash
curl -I http://api.auth.phablovilasboas.tech/health
curl https://api.auth.phablovilasboas.tech/health
```

Expected:

- HTTP returns a redirect to HTTPS.
- HTTPS returns the health payload.

## Risks and Mitigations

- Risk: `auth.phablovilasboas.tech` has a parent CNAME or CAA restriction.
  - Mitigation: Check Hostinger DNS before requesting the certificate. If there is a conflict, use `api.phablovilasboas.tech`.

- Risk: Old `api.labs` DNS records cause confusion.
  - Mitigation: Remove old `api.labs` and old ACM validation records after the new domain works.

- Risk: OAuth providers are not updated.
  - Mitigation: Update Google/GitHub callback URLs to `api.auth...` before testing OAuth login.

- Risk: Frontend environment still points at `api.labs...`.
  - Mitigation: Update frontend environment/config to use `https://api.auth.phablovilasboas.tech`.

- Risk: Terraform applies the old failed certificate ARN.
  - Mitigation: Ensure local `terraform.tfvars` contains only the new issued ACM certificate ARN.

## Open Questions

- None at this time.
