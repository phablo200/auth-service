# Infrastructure

Infrastructure is organized by provider so each deployment target owns its own files and operational notes.

```text
infra/aws      Supported AWS lab infrastructure.
infra/render   Future Render web service deployment config.
infra/neon     Future Neon Postgres setup docs.
```

The AWS stack remains supported and fully documented. It works, but its always-on ALB, ECS, public IPv4, and RDS resources are too expensive for a low-cost lab if left running.

Render and Neon are the next lower-cost evolution. Keep their configuration and setup docs in their own provider folders instead of mixing them into the AWS Terraform stack.
