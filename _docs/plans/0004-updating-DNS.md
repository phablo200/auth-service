# Updating Backend DNS To api.auth Plan

## Goal

Implement `_docs/specs/0004-updating-DNS.md` by moving the backend API domain from:

```text
api.labs.phablovilasboas.tech
```

to:

```text
api.auth.phablovilasboas.tech
```

This avoids the `CAA_ERROR` caused by the existing `labs -> cname.vercel-dns.com` DNS chain and lets AWS ACM issue a certificate for the backend API.

## Source Spec

- `_docs/specs/0004-updating-DNS.md`

## Current State

- Frontend remains:

```text
https://labs.phablovilasboas.tech
```

- Backend should move to:

```text
https://api.auth.phablovilasboas.tech
```

- Current ALB DNS name:

```text
auth-service-prod-alb-1829541798.us-east-1.elb.amazonaws.com
```

- The existing `api.labs.phablovilasboas.tech` ACM certificate failed with:

```text
CAA_ERROR
```

- Hostinger DNS check shows no existing `auth` or `api.auth` record, and no visible CAA record in the provided DNS list.
- Keep `OAUTH_FRONTEND_REDIRECT_ALLOWLIST = "https://labs.phablovilasboas.tech"`.

## Implementation Steps

### 1. Update Terraform API Domain

Files:

- `infra/terraform/environments/prod/main.tf`

Tasks:

- Change:

```hcl
api_domain_name = "api.labs.phablovilasboas.tech"
```

- To:

```hcl
api_domain_name = "api.auth.phablovilasboas.tech"
```

Expected outputs after apply:

```text
api_domain_name = api.auth.phablovilasboas.tech
api_url         = https://api.auth.phablovilasboas.tech
alb_url         = https://api.auth.phablovilasboas.tech
```

### 2. Update Terraform Runtime Environment Defaults

Files:

- `infra/terraform/environments/prod/variables.tf`
- `infra/terraform/environments/prod/terraform.tfvars.example`

Tasks:

- Replace backend API env values:

```hcl
OAUTH_PUBLIC_BASE_URL = "https://api.auth.phablovilasboas.tech"
APP_BASE_URL          = "https://api.auth.phablovilasboas.tech"
```

- Keep frontend redirect allowlist unchanged:

```hcl
OAUTH_FRONTEND_REDIRECT_ALLOWLIST = "https://labs.phablovilasboas.tech"
```

- Update the `acm_certificate_arn` description/comment from `api.labs...` to `api.auth...`.

### 3. Update Terraform README

Files:

- `infra/terraform/README.md`

Tasks:

- Replace backend API references:

```text
api.labs.phablovilasboas.tech
```

with:

```text
api.auth.phablovilasboas.tech
```

- Keep frontend references as:

```text
https://labs.phablovilasboas.tech
```

- Update ACM certificate instructions:

```text
Domain: api.auth.phablovilasboas.tech
Region: us-east-1
Validation: DNS
```

- Update Hostinger DNS instructions:

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

### 4. Update TLS Follow-Up Docs

Files:

- `_docs/specs/0003-Adding-TLS.md`
- `_docs/plans/0003-Adding-TLS.md`

Tasks:

- Mark `api.labs.phablovilasboas.tech` as superseded by `api.auth.phablovilasboas.tech`.
- Update references that would otherwise guide future work toward the failed `api.labs` domain.
- Preserve historical context that `api.labs` failed because of `CAA_ERROR`.

### 5. Validate Terraform Locally

Commands:

```bash
terraform fmt -recursive infra/terraform
terraform -chdir=infra/terraform/environments/prod validate
terraform -chdir=infra/terraform/environments/prod plan
```

Expected:

- Formatting succeeds.
- Validation succeeds.
- Plan shows only expected updates to ECS task definition/environment/outputs unless `acm_certificate_arn` is also changed.

### 6. Request New ACM Certificate

AWS Console:

- Service: AWS Certificate Manager.
- Region: `us-east-1`.
- Certificate type: public certificate.
- Domain:

```text
api.auth.phablovilasboas.tech
```

- Validation method: DNS validation.
- Export option: disabled.
- Key algorithm: default RSA 2048.

Expected:

- ACM creates a new certificate request.
- ACM shows one validation CNAME name/value pair.

### 7. Add New Hostinger DNS Records

Hostinger DNS zone:

```text
phablovilasboas.tech
```

Add ACM validation CNAME exactly as AWS provides it.

Shape:

```text
Type:  CNAME
Name:  <relative ACM validation name for api.auth>
Value: <ACM validation value ending in acm-validations.aws>
TTL:   default
```

Add the API CNAME:

```text
Type:  CNAME
Name:  api.auth
Value: auth-service-prod-alb-1829541798.us-east-1.elb.amazonaws.com
TTL:   default
```

Do not modify:

```text
labs -> cname.vercel-dns.com
```

That record is the frontend.

### 8. Wait For ACM Issued Status

Check with AWS CLI:

```bash
aws acm describe-certificate \
  --region us-east-1 \
  --certificate-arn "<new-certificate-arn>" \
  --query 'Certificate.Status'
```

Expected:

```text
"ISSUED"
```

If status becomes `FAILED`, inspect:

```bash
aws acm describe-certificate \
  --region us-east-1 \
  --certificate-arn "<new-certificate-arn>" \
  --query 'Certificate.{Status:Status,FailureReason:FailureReason,DomainValidationOptions:DomainValidationOptions}'
```

### 9. Enable HTTPS With New Certificate ARN

File:

- `infra/terraform/environments/prod/terraform.tfvars`

Set:

```hcl
acm_certificate_arn = "arn:aws:acm:us-east-1:407490667905:certificate/<new-certificate-id>"
```

Apply:

```bash
terraform -chdir=infra/terraform/environments/prod apply
```

Expected Terraform behavior:

- HTTPS listener exists on ALB port `443`.
- HTTP listener on port `80` redirects to HTTPS.
- ECS target group remains HTTP on app port `3001`.

### 10. Verify Runtime Behavior

Check ECS service:

```bash
aws ecs describe-services \
  --region us-east-1 \
  --cluster auth-service-prod-cluster \
  --services auth-service-prod-service \
  --query 'services[0].{desired:desiredCount,running:runningCount,pending:pendingCount,status:status}'
```

Expected:

```json
{
  "desired": 1,
  "running": 1,
  "pending": 0,
  "status": "ACTIVE"
}
```

Check HTTP redirect:

```bash
curl -I http://api.auth.phablovilasboas.tech/health
```

Expected:

```text
HTTP 301
location: https://api.auth.phablovilasboas.tech/health
```

Check HTTPS health:

```bash
curl https://api.auth.phablovilasboas.tech/health
```

Expected:

```json
{"status":"ok"}
```

### 11. Clean Up Superseded api.labs Artifacts

After `api.auth` is working:

- Delete the failed ACM certificate request for `api.labs.phablovilasboas.tech`.
- Remove the old Hostinger ACM validation CNAME for `api.labs`.
- Remove the old Hostinger `api.labs` CNAME if no client uses it.
- Keep `labs -> cname.vercel-dns.com`.

## Acceptance Checklist

- [ ] `api_domain_name` is `api.auth.phablovilasboas.tech`.
- [ ] `OAUTH_PUBLIC_BASE_URL` uses `https://api.auth.phablovilasboas.tech`.
- [ ] `APP_BASE_URL` uses `https://api.auth.phablovilasboas.tech`.
- [ ] `OAUTH_FRONTEND_REDIRECT_ALLOWLIST` remains `https://labs.phablovilasboas.tech`.
- [ ] README references `api.auth.phablovilasboas.tech` for backend API instructions.
- [ ] `terraform fmt -check -recursive infra/terraform` passes.
- [ ] `terraform -chdir=infra/terraform/environments/prod validate` passes.
- [ ] New ACM certificate for `api.auth.phablovilasboas.tech` is `ISSUED`.
- [ ] Hostinger has the new ACM validation CNAME.
- [ ] Hostinger has `api.auth` CNAME pointing to the ALB.
- [ ] Terraform apply with the new `acm_certificate_arn` succeeds.
- [ ] HTTP requests to `api.auth` redirect to HTTPS.
- [ ] HTTPS `/health` returns the auth-service health response.
- [ ] Old failed `api.labs` DNS/certificate artifacts are cleaned up after successful rollout.

## Rollback Plan

If the new ACM certificate fails:

1. Leave `acm_certificate_arn = null` or restore the previous working value.
2. Keep the ALB HTTP endpoint available while debugging:

```text
http://auth-service-prod-alb-1829541798.us-east-1.elb.amazonaws.com/health
```

3. Inspect ACM failure reason before changing DNS again.

If Terraform apply with the new ARN fails:

1. Set:

```hcl
acm_certificate_arn = null
```

2. Run:

```bash
terraform -chdir=infra/terraform/environments/prod apply
```

3. Fix the certificate/DNS issue and retry.

If `api.auth` DNS points to the wrong target:

1. Correct the Hostinger CNAME to:

```text
auth-service-prod-alb-1829541798.us-east-1.elb.amazonaws.com
```

2. Wait for DNS propagation.
3. Re-run verification.

## Notes

- The provided Hostinger DNS list shows no `auth` or `api.auth` record, so the selected domain is clear to use.
- Do not delete the `labs` CNAME because it serves the frontend.
- The failed `api.labs` certificate cannot be reused for `api.auth`.
- The backend API hostname, ACM certificate hostname, and frontend API URL must all match `api.auth.phablovilasboas.tech`.
