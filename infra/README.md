# infra — AWS CDK (TypeScript)

Defines the AWS side of the deployment: Lambda (FastAPI backend via Mangum),
API Gateway HTTP API, Secrets Manager references, and a billing budget alarm.
Stack definitions live in `lib/`, wired together in `bin/infra.ts`.

## Prerequisites

- An AWS account, with an IAM user/role that has enough permissions to create
  Lambda functions, API Gateway APIs, IAM roles, Secrets Manager resources,
  and Budgets (`AdministratorAccess` is the simplest starting point for a
  personal/portfolio account).
- AWS CLI configured (`aws configure`) with that user's credentials.
- Docker running locally — `PythonFunction` (in `lib/lambda-stack.ts`) bundles
  `backend/`'s dependencies via a Docker-based `pip install`, so `cdk synth`
  and `cdk deploy` both need a working Docker daemon.
- `npm install` in this directory.

## One-time setup: bootstrap CDK

Only needed once per AWS account/region:

```bash
npx cdk bootstrap
```

## One-time setup: create the secrets

**Secret values are set via CLI, never stored in this repo.** `lib/secrets-stack.ts`
only *references* these by name — the stack will fail to deploy if they don't
exist yet.

```bash
aws secretsmanager create-secret \
  --name roadtrip-planner/database-url \
  --secret-string "postgresql+asyncpg://<supabase-pooler-connection-string>"

aws secretsmanager create-secret \
  --name roadtrip-planner/google-places-api-key \
  --secret-string "<your-google-places-api-key>"
```

Use the **transaction-mode pooler** connection string for `database-url`
(see `backend/app/db/session.py` — the app is already configured for
`statement_cache_size=0` to work with pgbouncer's transaction mode). Use a
Places API key that's **separate from the frontend's browser-exposed Google
Maps key** — this one runs server-side only and should be restricted by IP
or usage quota, not HTTP referrer (Lambda has no stable referrer).

## Deploy

Set the two required env vars, then deploy:

```bash
export ALLOWED_ORIGIN="https://your-frontend.vercel.app"
export BUDGET_ALERT_EMAIL="you@example.com"

npx cdk deploy --all
```

This deploys four stacks in dependency order: `RoadtripSecretsStack` →
`RoadtripLambdaStack` → `RoadtripApiGatewayStack`, plus the independent
`RoadtripBudgetStack`. The API Gateway stack prints the deployed API's base
URL as a CloudFormation output (`ApiUrl`) — set that as
`NEXT_PUBLIC_API_BASE_URL` in the frontend's Vercel project settings.

## After deploying

- Run the backend's Alembic migrations against the live Supabase database if
  you haven't already (see `backend/README` / the project plan) — CDK does
  not run migrations, that's a separate manual step.
- Confirm `GET <ApiUrl>/api/healthz` returns `{"status": "ok"}`.
- Confirm neither secret's plaintext value appears anywhere in the AWS
  Console for the Lambda function — the env vars should show as
  `{{resolve:secretsmanager:...}}` dynamic references, not literal values.

## Useful commands

- `npm run build` — type-check the project
- `npm run watch` — watch for changes and type-check
- `npm test` — run the Jest unit tests (no AWS credentials or Docker needed —
  `LambdaStack`/`PythonFunction` bundling is exercised by `cdk synth`
  directly, not by the test suite, since Docker-based bundling doesn't belong
  in a fast unit test loop)
- `npx cdk diff` — compare deployed stacks with current local state
- `npx cdk synth` — emit the synthesized CloudFormation templates (needs
  Docker, since it bundles the Lambda)
- `npx cdk destroy --all` — tear down everything this app created
