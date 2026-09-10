# GitHub Plan→Implement→Review→Merge Workflow Plan
## 2026-09-09 — ShapeKeeper repo + TeacherEvan/* repos

### Executive Summary
Transform cron fleet from monitoring-only to full plan→implement→review→merge automation across TeacherEvan/* repos. All 10 reliable Tier 2 cronjobs push plans → implementation cronjobs pull → implement → create PR → user reviews in GitHub UI → cron merges on approval.

---

### Current State (Post Tier 3/4 Removal)
- **13 cronjobs remaining** (10 Tier 2 reliable + 3 Tier 1 infrastructure)
- All `no_agent: true` (zero LLM inference cost)
- Zero LLM-driven implementation capability currently

### Target Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ 10 Tier 2 Jobs  │────▶│  TeacherEvan/*   │◀─── │  Impl Workers   │
│ (Plan Generators)│    │  Repos (plans/)  │     │ (Impl + PR)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
       │                        │                       │
       │  Push plans            │  Pull plans           │  Create PR
       │  to plans/             │  Implement code       │  User reviews
       ▼                        ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GITHUB REVIEW GATE                            │
│  User approves via GitHub UI → Cron merges on approval          │
└─────────────────────────────────────────────────────────────────┘
```

---

### Phase 1: Plan Generation (Tier 2 Cronjobs → GitHub)

**10 Tier 2 Jobs** (all `no_agent: true`, 100% success, high output):
1. `cronfleet-liveness-NEW` — Fleet health → plans/fleet-health/
2. `telegram-heartbeat-NEW` — Infra heartbeat → plans/infra-heartbeat/
3. `git-dirty-scan-NEW` — Git hygiene → plans/git-hygiene/
4. `839728831db7` — Core monitor → plans/core-monitor/
5. `86496ef63c90` — Core monitor → plans/core-monitor/
6. `665983b43e85` — Core monitor → plans/core-monitor/
7. `4bd2e30f38b5` — Core monitor → plans/core-monitor/
8. `13618816d726` — Core monitor → plans/core-monitor/
9. `746a42cb2762` — Core monitor (has monitor) → plans/core-monitor/
10. `c8a0e9cefe8c` — Core monitor → plans/core-monitor/

**Each job modification:**
- Add plan generation logic to existing script
- Push to `TeacherEvan/<repo>/plans/<job-name>/<timestamp>.md`
- Plan format: standardized markdown with metadata (timestamp, job_id, findings, recommendations)

**GitHub integration:**
- Use `gh` CLI (already available in cron environment)
- Auth: `GH_TOKEN` from `.env.local` or GitHub CLI auth
- Repo target: `TeacherEvan/<repo-name>` per job's domain

---

### Phase 2: Implementation Workers (New Cronjobs)

**New cronjobs (LLM-driven, with monitors):**

| Worker | Schedule | Purpose | Monitor |
|--------|----------|---------|---------|
| `impl-git-hygiene` | 30 min | Pull git-hygiene plans, implement fixes | `impl-git-hygiene-monitor` |
| `impl-core-monitor` | 15 min | Pull core-monitor plans, implement fixes | `impl-core-monitor-monitor` |
| `impl-fleet-health` | 60 min | Pull fleet-health plans, implement | `impl-fleet-health-monitor` |
| `impl-infra-heartbeat` | 60 min | Pull infra-heartbeat plans, implement | `impl-infra-heartbeat-monitor` |

**Each worker:**
- `no_agent: false` (LLM-driven for code changes)
- Pulls latest plan from `TeacherEvan/<repo>/plans/<domain>/`
- Implements changes in local clone
- Creates GitHub PR with implementation
- **Hard-block: NO direct push — PR only**

**Monitors** (for each worker, `no_agent: true`, runs 2x worker frequency):
- Checks `last_run_at`, `last_status`
- Alerts on failure/stall
- Does NOT echo `last_error` (prevents recursive loop per audit §19)

---

### Phase 3: GitHub Review Gate

**PR Creation (by implementation worker):**
- Title: `[IMPL] <domain> - <plan-timestamp>`
- Body: Plan summary + implementation summary + test results
- Labels: `auto-impl`, `awaiting-review`, `<domain>`
- Assignee: none (user reviews via GitHub UI)

**Review Gate (cron-managed):**
- Cron checks open PRs with `awaiting-review` label every 30 min
- If PR has user approval (GitHub "Approve" review): auto-merge
- If PR has changes requested: cron comments with summary, pauses implementation
- If PR stale > 7 days: cron comments "stale - re-review needed"

**Merge Strategy:**
- Squash merge (clean history)
- Delete branch after merge
- Update plan status to "implemented" in plan file

---

### Phase 4: Hard Blocks & Safety (Per Audit Discipline)

**Hard-blocked repos (never touch):**
- User profile repos
- Billing/org config repos
- Any repo in `HARD_BLOCK_LIST` config

**Dry-run by default:**
- `CRON_IMPL_PUSH=1` required for actual PR creation
- Default: dry-run (creates local changes, logs what would be done, no PR)
- User enables per-domain via `CRON_IMPL_<DOMAIN>_PUSH=1`

**Rate-limit protection:**
- Max 5 PRs per hour per worker
- Exponential backoff on 429
- `providers.github.stale_timeout_seconds: 300`

---

### Job Modifications Required

**Existing 10 Tier 2 jobs (plan push):**
- Modify scripts to generate standardized plan markdown
- Add GitHub push logic (gh CLI)
- Output: `TeacherEvan/<repo>/plans/<job-name>/<timestamp>.md`

**New 4 implementation workers + 4 monitors (8 new cronjobs):**
- `impl-git-hygiene` + `impl-git-hygiene-monitor`
- `impl-core-monitor` + `impl-core-monitor-monitor`
- `impl-fleet-health` + `impl-fleet-health-monitor`
- `impl-infra-heartbeat` + `impl-infra-heartbeat-monitor`

**Removed (already done):**
- Fleet brief (`e4ed8fade341`)
- 3 low-activity (`185996d96367`, `a82e85030ba8`, `6a20cf96f0fe`)

---

### Configuration Requirements

**Environment variables (`.env.local` additions):**
```
GH_TOKEN=<github-token-with-repo-write>
CRON_IMPL_GIT_HYGIENE_PUSH=1
CRON_IMPL_CORE_MONITOR_PUSH=1
CRON_IMPL_FLEET_HEALTH_PUSH=1
CRON_IMPL_INFRA_HEARTBEAT_PUSH=1
HARD_BLOCK_LIST=TeacherEvan/profile-repo,TeacherEvan/billing,TeacherEvan/org-config
```

**Hermes config:**
```
cron.model_drift_guard: false
cron.model: <live-free-model>
providers.github.stale_timeout_seconds: 300
```

---

### Implementation Order (4-Gate Each)

1. **Plan generation scripts** → lint → test → deploy
2. **GitHub push library** → lint → test → deploy  
3. **Implementation workers** (4) → lint → vitest → e2e → deploy
4. **Monitors** (4) → lint → test → deploy
5. **Review/merge cron** → lint → test → deploy
5. **Integration test** — full cycle dry-run
6. **Production enable** — set push env vars

---

### Acceptance Criteria

- [ ] All 10 Tier 2 jobs push plans to correct GitHub paths
- [ ] 4 implementation workers pull plans, implement, create PRs
- [ ] PRs created with correct labels, body, test results
- [ ] User can approve PR in GitHub UI → auto-merge
- [ ] Monitors alert on failure/stall (no recursive errors)
- [ ] Dry-run mode works (no PR created without env var)
- [ ] Hard-blocked repos never touched
- [ ] Rate-limits respected (max 5 PR/hr/worker)
- [ ] `cron.model_drift_guard: false` set
- [ ] Rollback: `git reset --hard HEAD~1` + `vercel rollback` per change
- [ ] 4 gates PASS for each change (lint, convex, vitest, e2e)

---

### Rollback Procedure

Per change:
- `git reset --hard HEAD~1` (source)
- `vercel rollback` (deploy)
- Cron registry: restore from `.b4-*` backup

Full rollback:
- Restore `jobs.json` from `.b4-tier-removal-20260909`
- Rebuild registry
- Remove new cronjobs from `jobs.json`
- `vercel rollback` to pre-change deployment

---

### External Resources Required

- `vercel` CLI (already verified)
- `gh` CLI (available in cron env)
- `github.com/TeacherEvan/*` repos (write access via `GH_TOKEN`)
- `cron-reliability-ops` skill (monitor pattern, drift guard, review-only)
- `make-cronjob` skill (worker+monitor pairing, env-gate, dry-run)
- `surgical-implementation` skill (4-gate, bounded retries, rollback)

---

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Rate-limit (429) on GitHub | Medium | High | Backoff + max 5 PR/hr; alert on 429 |
| Recursive monitor error | Low | High | Monitors omit `last_error` (§19) |
| Accidental push to hard-blocked repo | Low | Critical | Hard-block list + dry-run default |
| Model drift silent skip | Medium | Medium | `cron.model_drift_guard: false` |
| Plan format drift | Low | Medium | Schema version in plan metadata |

---

### Timeline Estimate

- Phase 1 (plan push): ~2 hours (10 script mods + 4-gate each)
- Phase 2 (impl workers): ~4 hours (4 workers + 4 monitors + 4-gate each)
- Phase 3 (review gate): ~1 hour (1 cron + 4-gate)
- Phase 4 (integration + dry-run): ~1 hour
- **Total: ~8 hours** (can be parallelized across workers)

---

### Next Step

**STOP — Plan complete. Awaiting user confirmation to proceed with Phase 1 implementation (4-gate per change, atomic commits, rollback preserved).**