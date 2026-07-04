# Structured Infrastructure Layout Plan

## Goal

Implement `_docs/specs/0006-structured_infra.md` by restructuring `infra/` into provider-owned folders.

The immediate implementation should move the existing AWS Terraform lab from:

```text
infra/terraform/
```

to:

```text
infra/aws/terraform/
```

without changing AWS Terraform behavior. The plan should also reserve clear folders for the lower-cost Render + Neon evolution.

## Source Spec

- `_docs/specs/0006-structured_infra.md`

## Decisions

- Keep the AWS stack fully documented and supported.
- Treat Render + Neon as a lower-cost evolution, not as a replacement that invalidates the working AWS stack.
- Keep this implementation as a mechanical folder move plus documentation update.
- Do not implement Render deployment config in this change.
- Do not implement Neon project/database setup in this change.
- Do not change application code, database schema, migrations, or runtime behavior.
- Do not commit Terraform state, `.tfvars`, `.terraform/`, or plan files.
- Preserve existing AWS Terraform module boundaries:
  - `networking`
  - `database`
  - `service`
- Use Render-native config in the future, expected at `infra/render/render.yaml`.
- Use documented manual Neon setup for the first Neon version.
- Keep the first Render + Neon deployment schema-compatible with the current app.

## Current State

Current infrastructure tree:

```text
infra/
  terraform/
    README.md
    environments/
      prod/
        main.tf
        outputs.tf
        providers.tf
        terraform.tfvars.example
        variables.tf
        versions.tf
    modules/
      database/
      networking/
      service/
```

The current AWS Terraform stack provisions:

- VPC networking
- Application Load Balancer
- ECS Fargate service
- ECR repository
- RDS PostgreSQL
- Secrets Manager secrets
- CloudWatch log group
- IAM roles and policies
- AWS Budget

The desired provider-owned layout is:

```text
infra/
  README.md
  aws/
    README.md
    terraform/
      README.md
      environments/
        prod/
      modules/
        database/
        networking/
        service/
  render/
    README.md
  neon/
    README.md
```

Terraform state and local variable files may exist under `infra/terraform/environments/prod/`, but they are ignored by `.gitignore` and must not be staged.

## Implementation Steps

### 1. Create Provider Folders

Files/directories:

- `infra/aws/`
- `infra/render/`
- `infra/neon/`

Tasks:

- Create provider-owned folders under `infra/`.
- Keep folder names lowercase and provider-specific.
- Do not add Render or Neon implementation files yet beyond placeholder documentation.

Expected result:

```text
infra/aws/
infra/render/
infra/neon/
```

### 2. Move AWS Terraform Source

Files/directories:

- `infra/terraform/README.md`
- `infra/terraform/environments/`
- `infra/terraform/modules/`

Target:

- `infra/aws/terraform/README.md`
- `infra/aws/terraform/environments/`
- `infra/aws/terraform/modules/`

Tasks:

- Move the AWS Terraform tree into `infra/aws/terraform/`.
- Preserve all tracked Terraform source files.
- Do not intentionally stage ignored local files:
  - `.terraform/`
  - `.terraform.lock.hcl` if policy decides not to track it
  - `*.tfstate`
  - `*.tfstate.*`
  - `*.tfvars`
  - `*.tfplan`
- If ignored local state is needed for future AWS operations, move it locally but keep it untracked.

Expected result:

```text
infra/aws/terraform/environments/prod/main.tf
infra/aws/terraform/modules/networking/main.tf
infra/aws/terraform/modules/database/main.tf
infra/aws/terraform/modules/service/main.tf
```

### 3. Verify Terraform Module Paths

Files:

- `infra/aws/terraform/environments/prod/main.tf`

Tasks:

- Confirm these relative module paths still point to the moved modules:

```hcl
source = "../../modules/networking"
source = "../../modules/database"
source = "../../modules/service"
```

- Do not change module internals unless path validation proves a move broke them.

Expected result:

- The environment composition still resolves `networking`, `database`, and `service` modules from `infra/aws/terraform/modules/`.

### 4. Add Infrastructure Root README

Files:

- `infra/README.md`

Tasks:

- Document the provider-owned layout.
- State that AWS remains supported and fully documented.
- State that Render + Neon is the next lower-cost evolution.
- Make clear that Render and Neon work must not be mixed into the AWS Terraform stack.

Suggested content:

```text
infra/aws      Supported AWS lab infrastructure.
infra/render   Future Render web service deployment config.
infra/neon     Future Neon Postgres setup docs.
```

Expected result:

- A reader can understand provider ownership from `infra/README.md` without opening every subfolder.

### 5. Add AWS Provider README

Files:

- `infra/aws/README.md`

Tasks:

- Point readers to `infra/aws/terraform/README.md`.
- State that the AWS stack is supported but has higher always-on operating cost than the planned Render + Neon path.
- Mention that cost-sensitive lab usage should destroy or stop AWS resources when not in use.

Expected result:

- AWS remains easy to find and is not marked as archived or broken.

### 6. Update AWS Terraform README Paths

Files:

- `infra/aws/terraform/README.md`

Tasks:

- Replace old commands:

```bash
terraform -chdir=infra/terraform/environments/prod ...
```

- With new commands:

```bash
terraform -chdir=infra/aws/terraform/environments/prod ...
```

- Update all examples for:
  - `init`
  - `plan`
  - `apply`
  - `destroy`
  - `output`
- Update the `cp terraform.tfvars.example` command to use the new path.
- Keep AWS architecture, TLS, DNS, image push, secrets, validation, and destroy guidance intact.

Expected result:

- Operational AWS docs work from the new provider-owned path.

### 7. Add Render Placeholder README

Files:

- `infra/render/README.md`

Tasks:

- State that Render is the planned lower-cost web service runtime.
- State that the future implementation should use Render-native config in the repo.
- Reserve the expected config path:

```text
infra/render/render.yaml
```

- State that actual secrets must be configured in Render, not committed.
- Mention expected secret/config values at a high level:
  - `DATABASE_URL` or split DB variables
  - `JWT_SECRET`
  - `API_KEY`
  - OAuth secrets
  - mail secrets

Expected result:

- Render has a clear folder owner without introducing deployment config prematurely.

### 8. Add Neon Placeholder README

Files:

- `infra/neon/README.md`

Tasks:

- State that Neon is the planned lower-cost PostgreSQL provider.
- State that first Neon setup will be documented/manual.
- State that the current auth-service schema and migrations should remain unchanged.
- State that Neon should be treated as PostgreSQL in a different provider.
- Mention that the Neon connection string should be stored in Render secrets.

Expected result:

- Neon has a clear folder owner without introducing Terraform or provider tokens.

### 9. Update Repository References

Search command:

```bash
rg "infra/terraform"
```

Files likely to update:

- `infra/aws/terraform/README.md`
- Current operational docs that tell developers how to run Terraform.
- Any README section that describes the current infra path.

Rules:

- Update operational references to `infra/aws/terraform`.
- Leave historical specs unchanged only if they intentionally describe past work.
- If a historical spec would mislead current operations, add a short note that the path moved.

Expected result:

- `rg "infra/terraform"` returns only intentionally historical references or no matches.

### 10. Validate Formatting And Structure

Commands:

```bash
terraform -chdir=infra/aws/terraform/environments/prod fmt -recursive
terraform -chdir=infra/aws/terraform/environments/prod validate
rg "infra/terraform"
git status --short
```

Expected results:

- Terraform formatting succeeds.
- Terraform validation succeeds if provider plugins are available locally.
- If Terraform validation fails because of local provider/plugin/credential issues, capture the exact failure in the implementation summary.
- No ignored Terraform state, `.tfvars`, provider cache, or plan files are staged.
- Remaining `infra/terraform` references are either removed or intentionally historical.

## Validation Checklist

- [ ] `infra/aws/terraform/` contains the moved AWS Terraform source.
- [ ] `infra/terraform/` no longer contains active AWS Terraform source.
- [ ] `infra/README.md` explains provider ownership.
- [ ] `infra/aws/README.md` states AWS is supported and points to the Terraform docs.
- [ ] `infra/render/README.md` reserves Render-native config for future work.
- [ ] `infra/neon/README.md` documents the manual Neon-first direction.
- [ ] AWS Terraform README commands use `infra/aws/terraform/environments/prod`.
- [ ] Terraform module source paths still resolve from the moved environment folder.
- [ ] `terraform fmt` succeeds for the moved AWS stack.
- [ ] `terraform validate` succeeds, or the local blocker is documented.
- [ ] `rg "infra/terraform"` has no misleading operational references.
- [ ] `git status --short` does not show tracked Terraform state, `.tfvars`, `.terraform/`, or plan files.

## Rollback Plan

If the folder move causes unexpected issues before merge:

1. Move `infra/aws/terraform/` back to `infra/terraform/`.
2. Remove placeholder provider READMEs under `infra/aws/`, `infra/render/`, and `infra/neon/`.
3. Revert documentation path updates from `infra/aws/terraform` back to `infra/terraform`.
4. Rerun `rg "infra/aws/terraform"` to confirm no new-path references remain.

Do not use destructive git commands for rollback if there are unrelated user changes in the worktree. Move or patch only the files changed for this plan.

## Follow-Up Work

After this plan is implemented and merged, create a separate Render + Neon implementation plan that:

- Adds Render-native deployment config.
- Documents manual Neon project/database setup.
- Keeps the current auth-service schema and migrations unchanged.
- Stores Neon connection details and app secrets in Render secrets.
- Defines deployment and migration validation for the lower-cost infrastructure path.
