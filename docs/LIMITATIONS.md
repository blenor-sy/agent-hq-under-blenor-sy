# Known limitations

- The production dashboard is live on Vercel Hobby, but the server-only `SUPABASE_SECRET_KEY`, Supabase Auth production callback, owner account, and persistent worker still require owner-side activation. Until the secret is configured and Vercel is redeployed, privileged agent API routes are unavailable.
- The pgTAP file was not run through a local Supabase stack because Docker/Supabase CLI is unavailable here. Equivalent authorization, idempotency, ordering, and lease assertions passed against the remote database inside a rolled-back transaction.
- School Assistant and Spanish Assistant are prepared integration identities/adapters, not connected runtimes until persistent handlers are deployed with their tokens.
- A custom ChatGPT/Codex conversation is not an always-on process. Closing it stops that runtime unless work was handed to a separate worker service.
- Pause/resume is visible only when an agent declares `pause` and acknowledges the protocol. The supplied webhook adapter supports cancellation but not pause.
- Notifications are currently in-app persisted records; push, email, and SMS delivery require an explicit provider and user preference.
- Schedules use safe fixed intervals (minimum five minutes), not arbitrary user-provided cron expressions. The trusted database maintenance job runs every minute.
- Artifact URLs are metadata. Private binary upload/download needs a configured private Supabase Storage bucket and signed download endpoint.
- Reported token/API/cost numbers are trusted telemetry from the runtime. Agent HQ does not infer missing prices or usage.
- Database per-credential rate limits reduce accidental floods and token abuse but do not replace host/WAF DDoS controls.
- Supabase Free is $0 but may pause after one week without activity and does not include paid backup/support guarantees. Vercel Hobby is also $0 but is limited to personal, non-commercial use.
