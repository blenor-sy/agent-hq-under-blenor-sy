# Production deployment

Vercel Hobby is the reference free host for personal, non-commercial use because it supports the existing Next.js architecture. Minute-by-minute maintenance runs inside Supabase Postgres; it does not rely on Vercel Cron, whose free plan is limited to daily execution.

## 1. Supabase

1. Create a dedicated project in an EU region appropriate for the user’s German location.
2. Link the repository with the Supabase CLI.
3. Run `supabase db push` to apply all migrations through `0008` in order.
4. Run `supabase test db` against a local or isolated branch, then run Supabase security/performance advisors.
5. In **Authentication → URL Configuration**, set the production Site URL and add `https://<domain>/auth/callback` to redirect URLs. Keep `http://localhost:3000/auth/callback` for development.
6. Enable email/password or passwordless email. Configure production SMTP before relying on email delivery.

## 2. Hosting environment

Set these as encrypted production variables:

| Variable                               | Visibility                                                        |
| -------------------------------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Browser-safe project URL                                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable key                                      |
| `SUPABASE_SECRET_KEY`                  | Server only                                                       |
| `CRON_SECRET`                          | Optional server-only secret for the fallback maintenance endpoint |
| `NEXT_PUBLIC_SITE_URL`                 | Browser-safe HTTPS origin                                         |

Never expose a service/secret key through a `NEXT_PUBLIC_` name.

## 3. Deploy and verify

1. Import the GitHub repository into Vercel.
2. Confirm Node.js 22 and run `npm ci && npm run build`.
3. Attach the variables above and deploy.
4. Confirm HTTPS and `GET /api/health`.
5. Confirm `agent-hq-maintenance` is active in `cron.job` and inspect recent `cron.job_run_details` entries.
6. If `CRON_SECRET` is configured, verify `/api/cron/maintenance` rejects an absent/wrong bearer token and succeeds with the configured value.
7. Sign up, sign out, sign back in, and verify an unauthenticated private route redirects to `/login`.
8. Open the same account on iPhone/iPad and desktop. Register a test agent, send a heartbeat, refresh both devices, and confirm the same persisted state.

Supabase Free and Vercel Hobby are both $0 within their published limits. Supabase Free may pause an inactive project after one week; Vercel Hobby is restricted to personal, non-commercial use. No paid upgrade is required for the current architecture, and none should be enabled without owner approval.

## 4. Worker deployment

Deploy `worker/Dockerfile` to an always-on container service. Set `AGENT_HQ_URL`, `AGENT_HQ_TOKEN`, `AGENT_HANDLER_URL`, and `WORKER_NAME` as protected secrets/config. Enable platform restart-on-failure. The handler URL must use HTTPS except on localhost.

Do not describe an assistant as always-on until its container is actually running and its worker heartbeat appears in Agent HQ.
