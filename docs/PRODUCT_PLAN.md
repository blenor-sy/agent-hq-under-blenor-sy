# Agent HQ — Product Plan

## Product vision

Agent HQ is a reliable, cross-device control room for every agent the user creates.

The product must show **real agent state**, not simulated progress. An agent reports what it is doing through authenticated events and heartbeats. Agent HQ stores that state, shows it in real time, and later becomes capable of assigning, cancelling, retrying, scheduling, and coordinating work.

The goal is a product that is useful every day, not just a demo dashboard.

---

## Core product principles

1. **Truthful status only** — no fake progress bars or guessed activity.
2. **Durable history** — tasks, failures, events, timings, and artifacts survive refreshes and device changes.
3. **Cross-device by default** — phone, tablet, laptop, and desktop all see the same state.
4. **Secure by default** — private agent logs and tokens are never exposed publicly.
5. **Agent-runtime independent** — agents may run in different environments, but all report into one HQ.
6. **Observable** — every important action has timestamps, status, logs, and errors.
7. **Recoverable** — failures should be visible, retryable, and diagnosable.
8. **Incremental delivery** — every phase has an acceptance gate before the next phase begins.

---

## Definition of the finished product

A production-ready Agent HQ should eventually let the user:

- sign in securely from any device;
- see every registered agent;
- see whether each agent is online, idle, working, paused, failed, or offline;
- see the current task and current step;
- see how long the task has been running;
- see task progress when the agent can report meaningful progress;
- inspect real-time logs and task history;
- inspect errors and failure reasons;
- assign work to an agent from HQ;
- cancel, pause, resume, and retry supported work;
- schedule work;
- view completed outputs and files;
- see runtime, token, and cost metrics when available;
- receive alerts for failures, missed heartbeats, or important completions;
- use multiple agents without one agent being able to impersonate another;
- use the dashboard on iPhone/iPad/desktop without losing functionality;
- keep working even when the dashboard itself is not open.

---

# Phases

## Phase 0 — Product design and architecture

### Goal

Freeze the product rules before adding infrastructure.

### Deliverables

- product plan;
- acceptance criteria;
- architecture document;
- Codex continuation instructions;
- GitHub issues for each implementation phase;
- clear distinction between the dashboard, control plane, database, and agent runtimes.

### Exit gate

No implementation phase starts until the architecture and security model are documented.

---

## Phase 1 — Local application quality

### Goal

Make the existing starter application clean, testable, and reliable locally before any production deployment.

### Work

- install dependencies and lock versions;
- run TypeScript checks;
- add linting/formatting;
- add unit tests for timing/status helpers;
- add API validation;
- improve error handling;
- create development seed data;
- ensure dashboard behaves correctly with no data, stale data, failed tasks, and multiple agents;
- verify mobile layout;
- document local setup.

### Exit gate

- clean install succeeds;
- production build succeeds;
- tests pass;
- no hard-coded fake status is presented as real;
- dashboard is usable at phone, tablet, and desktop widths.

---

## Phase 2 — Secure persistent backend

### Goal

Turn Supabase into the real source of truth.

### Work

- create/configure Supabase project;
- apply schema through migrations;
- add user authentication;
- add owner/workspace model;
- add proper Row Level Security;
- remove public read policies;
- keep secret/service credentials server-only;
- add indexes and constraints;
- test unauthorized access;
- configure Realtime only for tables that require it.

### Exit gate

- user can sign in;
- anonymous users cannot read private agent data;
- authenticated user can only read their workspace data;
- agent tokens cannot be retrieved through browser APIs;
- database migration can be reproduced from scratch.

---

## Phase 3 — Real agent telemetry

### Goal

Connect real agents and prove that HQ reflects genuine runtime activity.

### Work

- per-agent registration and credentials;
- task_started, heartbeat, progress, log, completed, failed events;
- idempotency for repeated events;
- stale/offline detection;
- server-side health checks;
- task detail screen;
- event/log stream;
- robust elapsed-time calculations;
- connect School Assistant as first test agent;
- connect Spanish Assistant as second test agent.

### Exit gate

Run a real task from each connected agent and verify that two separate devices see:

- task start;
- current step;
- elapsed time;
- heartbeat changes;
- completion/failure;
- persistent task history after refresh.

---

## Phase 4 — Bidirectional control plane

### Goal

Make HQ able to control agents, not just observe them.

### Work

- durable command queue;
- assign task from HQ;
- agent lease/claim mechanism;
- command acknowledgement;
- cancellation;
- retry;
- pause/resume where runtime supports it;
- priorities;
- concurrency limits;
- duplicate-execution protection;
- command audit trail.

### Exit gate

A task created on the dashboard can be claimed by the correct agent, executed once, monitored live, and cancelled/retried safely.

---

## Phase 5 — Deployment and multi-device access

### Goal

Make HQ continuously reachable from the user’s devices.

### Work

- deploy dashboard/API;
- configure production environment variables;
- secure production domain;
- verify HTTPS;
- verify realtime connections after sleep/reconnect;
- add production database backups/restore plan;
- add health endpoint;
- add basic application monitoring.

### Exit gate

The user can open the same HQ from phone, iPad, and computer and see the same live state without running a local development server.

---

## Phase 6 — Always-on agent runtimes

### Goal

Make supported agents capable of running independently from the dashboard and reporting continuously.

### Work

- choose persistent runtime model for each type of agent;
- worker registration;
- heartbeat watchdog;
- worker restart/recovery strategy;
- scheduled tasks;
- background queue processing;
- offline alerts;
- safe secret storage;
- runtime version reporting.

### Important limitation

Agent HQ can stay online 24/7, but a chat or temporary Codex session does not automatically become a permanent worker. Each always-on agent needs an actual persistent runtime.

### Exit gate

At least one agent runtime survives dashboard closure and continues processing/reporting work independently.

---

## Phase 7 — Product polish

### Goal

Turn the technically working system into something pleasant and useful every day.

### Work

- polished responsive UI;
- agent detail views;
- task filters/search;
- timeline view;
- files/artifacts;
- notifications;
- PWA/mobile improvements;
- token/runtime/cost analytics;
- agent configuration/version history;
- accessibility pass;
- onboarding for new agents.

### Exit gate

The product is understandable without reading developer documentation and common workflows require only a few taps/clicks.

---

## Phase 8 — Multi-agent orchestration

### Goal

Allow agents to cooperate safely on larger projects.

### Work

- dependencies between tasks;
- agent-to-agent messages;
- shared project workspaces;
- human approval gates;
- orchestrator agent;
- delegation history;
- resource/concurrency controls;
- audit log.

### Exit gate

A multi-agent workflow can be reproduced, audited, interrupted, and resumed without losing state.

---

# Build discipline

For every phase:

1. Create/confirm acceptance tests first.
2. Implement the minimum needed to satisfy those tests.
3. Test failure cases, not only happy paths.
4. Review security implications.
5. Update documentation.
6. Only then mark the phase complete and start the next one.

We should prefer a smaller feature that is fully reliable over a larger feature that only looks complete.
