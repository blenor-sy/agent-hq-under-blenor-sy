# Security model

## Trust boundaries

- Browser clients receive only the Supabase URL and publishable key.
- Supabase RLS authorizes reads by `workspace_members` and `auth.uid()`.
- Secret/service credentials exist only in protected server environment variables.
- Agent tokens are random 256-bit values. Only SHA-256 hashes and eight-character display prefixes are stored.
- Token lookup verifies revocation and expiry. Rotation creates a new independent credential; revocation is immediate.
- Public agent endpoints require a valid per-agent credential and use shared database rate limits.

## Tenant protection

The original anonymous policies are removed by migration `0002`. Anonymous roles receive no table or sequence grants. Authenticated reads require membership of the row’s workspace. Token, rate-limit, and private helper data have no browser grants. User-created tasks and schedules pass through `SECURITY DEFINER` functions that explicitly validate `auth.uid()` and membership; their `search_path` is empty.

## API protection

- JSON content type and a 1 MB body ceiling are enforced.
- Zod schemas bound strings, arrays, numeric values, event types, URLs, priorities, attempts, and leases.
- Error responses do not expose secret values or raw internal exceptions.
- Agent/task/worker relationships are checked server-side and again in database RPCs.
- Worker mutations require a live, matching lease.
- The maintenance endpoint compares a protected bearer secret with constant-time hashes.
- Security response headers disable framing, content sniffing, sensitive browser capabilities, and referrer leakage.

## Logging rules

Do not send tokens, passwords, authorization headers, personal secrets, or full private file contents as event messages/metadata. Agent HQ intentionally stores reported events. Production log drains should redact request headers and bodies.

## Pre-production checklist

1. Run all migrations on a dedicated project.
2. Run `supabase test db` and Supabase database/security advisors.
3. Confirm anonymous `select` on every tenant table returns no rows or permission denied.
4. Configure allowed Auth redirect URLs exactly.
5. Store server and worker secrets only in host secret managers.
6. Keep JWT expiry and email/SMTP settings appropriate for private use.
7. Enable Supabase backups and verify a restore in an isolated project.
8. Review hosting logs for accidental body/header capture.
9. Add platform/WAF IP throttling if the public ingest API receives hostile traffic; database limits are per credential, not a full DDoS service.
