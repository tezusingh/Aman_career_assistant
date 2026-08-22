# Aman Career Assistant

A self-hosted, AI-powered job-search command center that unifies **three** open-source
tools into **one pipeline**: search jobs across the world → score fit → tailor your CV →
deep-evaluate the best ones → find who to contact → draft referral/cold emails → track
everything.

> **It never auto-applies and never auto-sends.** Every tool here *finds, scores, tailors,
> and drafts* — you review and hit submit. That is deliberate: automated applications get
> you filtered out and blacklisted.

---

## Table of contents
- [What it can do](#what-it-can-do)
- [The three components](#the-three-components)
- [How it works (architecture)](#how-it-works-architecture)
- [The integration bridge](#the-integration-bridge)
- [Requirements](#requirements)
- [First-time setup](#first-time-setup-on-a-new-machine)
- [Daily workflow](#daily-workflow)
- [Configuration](#configuration)
- [Command reference](#command-reference)
- [Repository layout](#repository-layout)
- [Security & privacy](#security--privacy)
- [Coverage & known gaps](#coverage--known-gaps)

---

## What it can do

| Capability | How | Where |
|------------|-----|-------|
| **Search 10+ job boards at once** | LinkedIn, Indeed, Glassdoor, Naukri (India), Adzuna, Hiring Cafe, startup.jobs, Working Nomads, Gradcracker, Seek, and more | JobOps (`:3005`) |
| **Score each job against your profile (0–100)** | An LLM ranks fit from your CV + preferences | JobOps |
| **Tailor your CV per job** | AI rewrites your résumé for each JD; exports a PDF (locally or via Reactive Resume) | JobOps |
| **Visa-sponsorship checks** | Cross-references sponsorship registries (e.g. Netherlands IND) | JobOps |
| **Auto-track outcomes from Gmail** | Watches your inbox and flips status to Interviewing / Rejected / Offer | JobOps |
| **Deep 0–5 fit evaluation (A–H rubric)** | Reasons about CV vs JD across five dimensions + legitimacy (scam/ghost-job) + work-auth flag | career-ops |
| **Find the right person to contact** | Identifies hiring manager / recruiter / team peer for a referral | career-ops (`contacto`) |
| **Draft referral & cold emails** | Formal recruiter/referral/cold-application email drafts + ≤300-char LinkedIn messages | career-ops (`email`, `contacto`) |
| **Company deep research** | AI strategy, recent moves, culture, the angle your profile should take | career-ops (`deep`) |
| **Interview prep + STAR story bank + negotiation** | Time-blocked prep, practice, debriefs, salary scripts | career-ops |
| **Browser dashboard** | Browse/evaluate/track everything in one tab instead of the CLI | career-ops web-ui (`:4317`) |
| **One-way sync of the best jobs** | Pushes high-scoring JobOps jobs into career-ops for deep work | pipeline bridge |

---

## The three components

### 1. JobOps — `job-ops/`  (runs on Docker, `http://localhost:3005`)
The **wide-net search + tracking** front end. Scrapes many boards, scores every result,
tailors your CV per role, checks visa sponsorship, and watches Gmail for replies. Stores
everything in a local SQLite database (`job-ops/data/jobs.db`). Ships its own onboarding
wizard for provider setup.

### 2. career-ops — `career-ops/`  (Fighter90 fork; AI-CLI + engine)
The **deep-work** engine. Runs as slash-commands inside an AI coding CLI (Claude Code,
Codex, etc.) or headless via API keys. Turns a job URL into a structured A–H evaluation,
an ATS-tailored PDF, a contact to reach out to, and outreach email drafts. Data lives in
plain files: `cv.md`, `data/pipeline.md`, `data/applications.md`, `reports/`.

### 3. career-ops web-ui — `career-ops/web-ui/`  (`http://localhost:4317`)
A **browser dashboard** that sits on top of career-ops (reads the same files). CRM-style
views for the pipeline, reports, tracker, CV editor, evaluate/deep/contacto pages, and a
live provider config (`#/config`) to switch models without restarting.

---

## How it works (architecture)

```
                          YOU (review + submit — always human-in-the-loop)
                                        ▲
                                        │
 ┌───────────────────────┐   bridge    ┌────────────────────────────────────┐
 │  JobOps  (:3005)       │  (one-way)  │  career-ops  +  web-ui  (:4317)     │
 │  Docker + SQLite       │ ──────────▶ │  file-based engine + dashboard      │
 │                        │             │                                     │
 │  • search 10+ boards   │  high-score │  • A–H deep evaluation (0–5)        │
 │  • score fit 0–100     │  jobs only  │  • find contact (referral)          │
 │  • tailor CV + PDF     │             │  • draft referral / cold emails     │
 │  • visa check          │             │  • company deep research            │
 │  • Gmail tracking      │             │  • interview prep + negotiation     │
 └───────────────────────┘             └────────────────────────────────────┘
        stores in                               reads/writes
     job-ops/data/jobs.db                 career-ops/data/pipeline.md
```

**Flow:** JobOps casts the wide net and scores everything → the bridge lifts only the
high-scoring jobs into career-ops → career-ops does the expensive, high-value work
(deep eval + outreach) on that shortlist → you decide and act.

---

## The integration bridge

`pipeline/import-jobs.mjs` is the connective tissue. It is intentionally decoupled — it
touches no internal APIs of either app:

1. **Reads** JobOps' SQLite DB (`job-ops/data/jobs.db`) directly using Node's built-in
   `node:sqlite` — no extra dependencies, no auth, no network.
2. **Filters** rows by `status` (default `discovered,ready`) and `suitability_score`
   (default `≥ 70`).
3. **Dedups** against jobs already in `career-ops/data/pipeline.md` using a normalized URL
   (lowercased host+path, trailing slash/hash stripped).
4. **Appends** the new jobs under `## Pending` in career-ops' pipeline format:
   `- [ ] {url} | {employer} | {title} | {location}` (pipe/newline characters neutralized
   so rows never break).
5. **Degrades cleanly** — if JobOps hasn't produced a DB yet, it prints guidance and exits
   without error.

Run it via `pipeline/sync.ps1` (Windows) or `node pipeline/import-jobs.mjs` (any OS).

---

## Requirements

- **Node.js ≥ 20** (built/tested on Node 24 — the bridge relies on `node:sqlite`).
- **Docker Desktop with virtualization enabled** — required **only** for JobOps. Everything
  else runs without Docker.
- **git**.
- At least one **LLM API key** — `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY`.

---

## First-time setup on a new machine

```powershell
git clone https://github.com/tezusingh/Aman_career_assistant.git
cd Aman_career_assistant

# Windows
.\bootstrap.ps1
# macOS / Linux
./bootstrap.sh
```

`bootstrap` creates local `.env` files from `setup/env/` templates and installs Node
dependencies for career-ops and the web-ui. Then:

1. **Paste your API keys** into `career-ops/.env` and `job-ops/.env`
   (`ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY`).
2. Put your real résumé into `career-ops/cv.md` and edit `career-ops/config/profile.yml`
   (target roles + locations: India, Singapore, Amsterdam, London, Dubai) and
   `career-ops/portals.yml` (companies + search filters).
3. Start JobOps (needs Docker): `cd job-ops; docker compose up -d`
4. Launch everything: `.\pipeline\start-all.ps1`

---

## Daily workflow

1. **Search** — in JobOps (`:3005`), run searches across boards for your locations. It
   scores and tailors as it goes.
2. **Bridge the winners** into career-ops:
   ```powershell
   .\pipeline\sync.ps1 -MinScore 70          # only jobs scoring >= 70
   .\pipeline\sync.ps1 -MinScore 60 -DryRun  # preview without writing
   ```
   Cross-platform: `node pipeline/import-jobs.mjs --min-score 70`
3. **Generate outreach** for the imported jobs (referrals get interviews, not applications):
   ```powershell
   .\pipeline\outreach.ps1                  # per-job worksheets under career-ops/networking/outreach
   ```
   Each worksheet has a ready-to-send LinkedIn note + recruiter cold email + referral ask,
   plus a "sharpen with AI" prompt for career-ops.
4. **Deep-work** — in the web-ui (`:4317`), run deep evaluation, find contacts, and draft
   referral / cold emails for the imported jobs.
5. **Beat the ATS** — before applying, check keyword coverage so your résumé passes filters:
   ```powershell
   .\pipeline\ats-check.ps1 -Jd .\career-ops\jds\some-job.txt
   ```
   It prints a 0–100 coverage score + the top JD keywords missing from your CV (add only
   the ones you genuinely have).
6. **Apply yourself**, then let JobOps' Gmail tracking update the status automatically.
7. **Chase replies** — most interviews are lost to silence, so nudge on time:
   ```powershell
   .\pipeline\followups.ps1                  # who to follow up with today / overdue
   ```
8. **Measure the funnel** to see where you're losing candidates and what to fix:
   ```powershell
   .\pipeline\funnel.ps1
   ```
9. **Stop** everything: `.\pipeline\stop-all.ps1`

---

## Configuration

Both `.env` files support **OpenAI and Claude simultaneously** so you can switch freely:

- **career-ops** (`career-ops/.env`): set `LLM_PROVIDER=claude` or `openai`. The web-ui
  `#/config` page can switch this live without restarting.
- **JobOps** (`job-ops/.env`): set `LLM_PROVIDER` + `MODEL` (or use its onboarding wizard).

Templates with every field documented live in [setup/env](setup/env). Optional JobOps
integrations (Reactive Resume, Adzuna API, Gmail OAuth) are commented in
`job-ops/.env` — fill only what you use.

**Bridge env overrides** (optional): `JOBOPS_DB`, `CAREER_OPS_ROOT`, `MIN_SCORE`, `STATUSES`.

---

## Command reference

| Command | What it does |
|---------|--------------|
| `.\bootstrap.ps1` / `./bootstrap.sh` | One-time setup: create `.env` files + `npm install` |
| `.\pipeline\start-all.ps1` | Start JobOps (if Docker up) + career-ops web-ui |
| `.\pipeline\stop-all.ps1` | Stop the web-ui and JobOps |
| `.\pipeline\sync.ps1 [-MinScore N] [-Status s] [-DryRun]` | Import scored JobOps jobs → career-ops |
| `node pipeline/import-jobs.mjs --min-score 70` | Same bridge, cross-platform |
| `.\pipeline\outreach.ps1 [-Limit N]` | Generate per-job outreach worksheets (LinkedIn + cold email + referral) |
| `.\pipeline\ats-check.ps1 -Jd <file>` / `-JdText "..."` | Pre-apply ATS keyword-coverage score + missing terms |
| `.\pipeline\followups.ps1` | Who to follow up with today / overdue, with the next action |
| `.\pipeline\funnel.ps1` | Search→interview funnel + conversion rates + biggest-leak diagnosis |
| `cd job-ops; docker compose up -d` | Start JobOps alone |
| `cd career-ops/web-ui; node server/index.mjs` | Start the web-ui alone |

---

## Repository layout

```
Aman_career_assistant/
├─ README.md                 # this file
├─ bootstrap.ps1 / .sh       # one-command setup on a fresh machine
├─ .gitignore                # excludes node_modules, real .env, runtime data
├─ setup/env/                # committed .env templates (no secrets)
├─ pipeline/                 # the integration layer
│  ├─ import-jobs.mjs        # JobOps SQLite -> career-ops pipeline.md bridge
│  ├─ outreach.mjs           # per-job outreach worksheets (referral + cold email)
│  ├─ ats-check.mjs          # pre-apply ATS keyword-coverage gate
│  ├─ followups.mjs          # follow-up cadence: who to chase today
│  ├─ funnel.mjs             # unified search->interview funnel + diagnosis
│  └─ *.ps1                  # PowerShell wrappers (start-all, stop-all, sync,
│                            #   outreach, ats-check, followups, funnel)
├─ job-ops/                  # JobOps (Docker app: search/score/tailor/track)
└─ career-ops/               # career-ops engine (deep eval + outreach)
   └─ web-ui/                # career-ops browser dashboard
```

---

## Security & privacy

- **Local-first.** Your CV, contacts, and job data stay on your machine; they go only to
  the LLM provider you configure. No telemetry from career-ops.
- **No secrets in git.** Real `.env` files are git-ignored — only blank templates are
  committed. Verified: 0 `.env` and 0 `node_modules` tracked.
- **Nothing is auto-submitted or auto-sent.** All three tools are human-in-the-loop by
  design.
- **JobOps note:** it ships anonymous usage analytics (Umami); block `umami.dakheera47.com`
  to opt out.

---

## Coverage & known gaps

- **India:** JobOps includes a **Naukri** extractor plus LinkedIn/Indeed. Native boards
  like Instahyre/Cutshort are not covered out of the box.
- **Dubai / Middle East:** reachable via LinkedIn/Indeed only; Bayt/GulfTalent are not
  built in.
- **The integration is one-way** (JobOps → career-ops). career-ops results do not sync back
  into JobOps' tracker, and the two dashboards are separate (not a single fused UI).

To close a gap, add a custom **TypeScript extractor** to JobOps (see its extractor docs) —
e.g. a Bayt or Instahyre source.

### Adding an India/Dubai board extractor (do this on the Docker machine)

JobOps extractors are self-contained TypeScript packages under `job-ops/extractors/<name>/`
(`manifest.ts`, `src/run.ts`, `src/parser.ts`, `tests/`). To add e.g. **Instahyre** or **Bayt**:

1. Copy an existing simple extractor as a template — `job-ops/extractors/golangjobs/` (API/HTML)
   or `job-ops/extractors/fiveamsat/` (fetch + parse) are the clearest.
2. Point its fetcher at the target board's search results and map fields to JobOps' job
   shape (title, employer, location, url, description).
3. Add a `tests/parser.test.ts` against a saved HTML fixture, then `npm test` in that package.
4. Register it so the app discovers it, and run a search from the UI to verify rows land.

This needs Docker + the live site's HTML, so it belongs on the target machine — it is
deliberately **not** pre-built here to avoid shipping an untested scraper.

---

Built on three open-source projects: **JobOps** (DaKheera47), **career-ops** (santifer,
Fighter90 fork), and **career-ops-ui** (Fighter90). This repo installs and integrates them;
it does not replace their upstream licenses.
