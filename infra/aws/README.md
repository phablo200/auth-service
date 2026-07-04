# AWS Infrastructure

This folder contains the supported AWS lab infrastructure for `auth-service`.

The Terraform stack lives in:

```text
infra/aws/terraform/
```

Use this path for AWS operations:

```bash
terraform -chdir=infra/aws/terraform/environments/prod plan
terraform -chdir=infra/aws/terraform/environments/prod apply
terraform -chdir=infra/aws/terraform/environments/prod destroy
```

This architecture is valid and has been tested, but it has higher always-on cost than the planned Render + Neon path. Destroy or stop AWS lab resources when they are not being used.
