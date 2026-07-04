# Structured Infrastructure Layout

## Objective

Restructure the current `infra` folder so provider-specific infrastructure is isolated by platform. The immediate outcome is to move the existing AWS Terraform lab into an AWS-owned folder without changing its behavior, creating a clean path for a later Render + Neon deployment structure.

The target repository shape should make it obvious which files manage AWS resources, which files will manage Render resources, and which files will manage Neon resources. This separation is required because the current AWS ECS/RDS/ALB architecture works, but it is too expensive for an always-on lab. Render + Neon should be treated as the next lower-cost evolution, not as proof that the AWS stack is invalid.

## Background

The current infrastructure lives under `infra/terraform/` and provisions an AWS lab deployment:

```text
infra/
  terraform/
    README.md
    environments/prod/
    modules/database/
    modules/networking/
    modules/service/
```

That layout worked when AWS was the only target, but it now hides the provider boundary. `infra/terraform` reads like the repository has one Terraform stack, not an AWS-specific Terraform stack. This will become confusing once Render and Neon configuration is added.

The current AWS stack includes VPC networking, an internet-facing ALB, ECS Fargate, ECR, RDS PostgreSQL, Secrets Manager, CloudWatch Logs, IAM, and an AWS Budget. The repo has also experienced real cost pressure from this shape, especially public serving resources and managed database/runtime infrastructure.

The desired future direction is:

```text
infra/
  aws/
    terraform/
      ...
  render/
    ...
  neon/
    ...
```

AWS should remain available as a supported lab stack because it has been validated and works. New low-cost deployment work should be added beside it under Render and Neon provider folders instead of being mixed into the AWS stack.

## Scope

### In Scope

- Move existing AWS Terraform files from `infra/terraform/` to `infra/aws/terraform/`.
- Preserve the existing AWS Terraform module boundaries and behavior during the move.
- Update local documentation and command examples that point at the old AWS Terraform path.
- Add placeholder directories or README files for future Render and Neon infrastructure ownership.
- Make the new layout explicit enough that future work can add Render and Neon without mixing those files into the AWS stack.
- Preserve existing `.gitignore` protection for Terraform state, local `.tfvars`, `.terraform/`, and plan files.
- Keep the migration reviewable as a folder move plus documentation updates, not a redesign of the AWS stack.

### Out of Scope

- Implementing Render deployment configuration.
- Implementing Neon project/database configuration.
- Migrating application runtime variables to Render.
- Migrating PostgreSQL data from AWS RDS to Neon.
- Changing the current application code.
- Refactoring Terraform modules beyond path relocation.
- Recreating or destroying cloud resources as part of the restructure.
- Introducing Terraform Cloud, remote state, or a new state backend.
- Committing local Terraform state, `.tfvars`, provider caches, or generated plan files.

## Proposed Approach

Use a provider-first infrastructure layout:

```text
infra/
  README.md
  aws/
    README.md
    terraform/
      README.md
      environments/
        prod/
          main.tf
          variables.tf
          outputs.tf
          providers.tf
          terraform.tfvars.example
          versions.tf
      modules/
        database/
        networking/
        service/
  render/
    README.md
  neon/
    README.md
```

The AWS move should be mechanical:

- Old path: `infra/terraform/environments/prod`
- New path: `infra/aws/terraform/environments/prod`
- Old modules path: `infra/terraform/modules/*`
- New modules path: `infra/aws/terraform/modules/*`

Relative Terraform module sources should continue to work after the move because `environments/prod/main.tf` can still reference:

```hcl
source = "../../modules/networking"
source = "../../modules/database"
source = "../../modules/service"
```

The root `infra/README.md` should describe infrastructure ownership:

- `infra/aws`: supported AWS lab stack.
- `infra/render`: future Render web service configuration managed with Render-native config.
- `infra/neon`: future Neon PostgreSQL setup documented as manual/dashboard setup for the first version.

Render and Neon should not use Terraform in the first lower-cost implementation. Render should use provider-native configuration because the application runtime can be described cleanly in a repo-owned Render config file. Neon should start with documented manual setup because the first version only needs one project/database and a connection string injected into Render secrets.

The next Render + Neon implementation should target this shape:

```text
infra/
  render/
    README.md
    render.yaml
  neon/
    README.md
```

Render secrets must not be committed. The Render config should declare required secret keys with provider-supported secret placeholders, while the actual values are configured in the Render dashboard. Neon connection details should be copied from Neon into Render as either a single `DATABASE_URL` or the existing split database variables used by the app: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`.

The first Render + Neon deployment should keep the current auth-service app behavior and database schema exactly as-is. The same application code should deploy, the same migrations should run, and Neon should be treated as PostgreSQL in a different provider. Any schema simplification, migration automation, or runtime configuration cleanup should happen after the app is working on the lower-cost infrastructure.

The AWS README should keep the existing operational notes, but all commands must use the new `-chdir` path:

```bash
terraform -chdir=infra/aws/terraform/environments/prod init
terraform -chdir=infra/aws/terraform/environments/prod plan
terraform -chdir=infra/aws/terraform/environments/prod apply
terraform -chdir=infra/aws/terraform/environments/prod destroy
```

Do not create Render or Neon implementation files in this milestone. Use short READMEs to reserve those folders and state that implementation will be defined in a follow-up spec.

## Milestones

1. Move AWS Terraform into provider-specific ownership.
   - Move `infra/terraform/README.md` to `infra/aws/terraform/README.md`.
   - Move `infra/terraform/environments` to `infra/aws/terraform/environments`.
   - Move `infra/terraform/modules` to `infra/aws/terraform/modules`.
   - Confirm module `source` paths still resolve from the new environment folder.

2. Update references to the old AWS path.
   - Search the repo for `infra/terraform`.
   - Update documentation and command examples to `infra/aws/terraform`.
   - Leave historical specs unchanged only if they intentionally describe past work; otherwise update references that are meant to be operational.

3. Add top-level infrastructure ownership docs.
   - Add `infra/README.md` explaining provider folder responsibilities.
   - Add `infra/aws/README.md` pointing to the AWS Terraform lab docs.
   - Add `infra/render/README.md` as a placeholder for Render web service deployment.
   - Add `infra/neon/README.md` as a placeholder for Neon Postgres deployment.

4. Validate the AWS move locally.
   - Run `terraform -chdir=infra/aws/terraform/environments/prod fmt -recursive`.
   - Run `terraform -chdir=infra/aws/terraform/environments/prod validate` if provider plugins are available locally.
   - Run `rg "infra/terraform"` and review any remaining matches.

5. Prepare the next infrastructure spec.
   - Create a follow-up plan for Render + Neon after this layout is merged.
   - That follow-up should implement Render through provider-native config and document Neon manual setup.

## Edge Cases

- Local Terraform state may exist under the old ignored path. Do not commit it. If the AWS stack is still active and state must be preserved, move local ignored state files manually with the Terraform folder or document that state must be restored from the operator's local copy.
- If `.terraform/` provider caches exist under the old path, they may be moved or deleted locally, but they must remain ignored.
- If the AWS resources have already been destroyed, the folder restructure still matters as a documentation and future-reference cleanup.
- Existing historical specs may mention `infra/terraform` because that was the original path. Only update them if they are used as current operational instructions.

## Acceptance Criteria

- [ ] Existing AWS Terraform source code lives under `infra/aws/terraform/`.
- [ ] No active AWS Terraform source files remain under `infra/terraform/`.
- [ ] Render and Neon have reserved provider folders under `infra/render/` and `infra/neon/`.
- [ ] Current operational AWS commands in docs use `infra/aws/terraform/environments/prod`.
- [ ] `.gitignore` still excludes Terraform state, local variables, provider caches, and plan files in the new folder structure.
- [ ] `rg "infra/terraform"` returns only intentionally historical references or no matches.
- [ ] Terraform formatting succeeds for the moved AWS stack.
- [ ] Terraform validation succeeds, or the validation failure is documented with the exact local dependency or credential issue.

## Test Plan

- Unit: Not applicable; this is a repository structure and documentation change.
- Integration:
  - Run `terraform -chdir=infra/aws/terraform/environments/prod fmt -recursive`.
  - Run `terraform -chdir=infra/aws/terraform/environments/prod validate` when provider plugins are available.
  - Run `rg "infra/terraform"` and review remaining references.
- Manual verification:
  - Inspect the final `infra/` tree and confirm provider ownership is clear.
  - Confirm the AWS README destroy/apply examples use the new path.
  - Confirm no `.tfstate`, `.tfvars`, `.terraform/`, or `.tfplan` files are staged.

## Risks and Mitigations

- Risk: Local Terraform state is left behind under the old ignored path, causing future AWS commands to appear as if no resources are managed.
  - Mitigation: Before applying or destroying AWS resources after the move, confirm state location and run `terraform state list` from the new path. If needed, move the local ignored state files intentionally outside the commit.

- Risk: Documentation references split between old and new paths.
  - Mitigation: Use `rg "infra/terraform"` after the move and update operational references in the same change.

- Risk: The restructure is combined with Render/Neon implementation and becomes hard to review.
  - Mitigation: Keep this milestone limited to ownership folders, path updates, and placeholders.

- Risk: Developers assume there is only one supported deployment path and mix Render/Neon work into the AWS stack.
  - Mitigation: State in `infra/README.md` that AWS remains supported, while Render + Neon is the next lower-cost evolution with separate provider ownership.

## Open Questions

- Resolved: The AWS stack should remain fully documented and supported. The cost issue came from operating-cost expectations, not from a broken architecture.
- Resolved: Render should be managed through provider-native config in the repo. Neon should be documented manual setup for the first version, with the Neon connection string stored as a Render secret.
- Resolved: The first Render + Neon deployment should keep the custom auth-service schema and app behavior exactly as-is. Deploy the same code, run the same migrations, and treat Neon as Postgres in a different place.
