# Aman Career Assistant — unified job-search pipeline

Three open-source tools installed side-by-side and wired into one workflow:

| Component | URL (local) | What it does |
|-----------|-------------|--------------|
| **JobOps** (`job-ops/`) | http://localhost:3005 | Search LinkedIn / Indeed / Glassdoor / Naukri + 10 boards, score fit, tailor CV, visa-sponsorship checks, Gmail tracking. Runs via **Docker**. |
| **career-ops** (`career-ops/`) | — | Deep 0–5 fit evaluation, tailored PDF CVs, find the right contact, draft referral / recruiter / cold emails. Runs as an AI-CLI + web-ui. |
| **career-ops web-ui** (`career-ops/web-ui/`) | http://localhost:4317 | Browser dashboard over career-ops. |
| **pipeline bridge** (`pipeline/`) | — | Pulls JobOps' scored jobs into career-ops for deep evaluation + outreach. |

> **Note:** none of these auto-apply or auto-send. They find, score, tailor, and *draft* — you review and submit. That is by design.

## Requirements (target machine)

- **Node.js ≥ 20** (repo built/tested on Node 24)
- **Docker Desktop with virtualization enabled** — required *only* for JobOps. The rest runs without Docker.
- **git**

## First-time setup on a new machine

```powershell
git clone <your-repo-url> Aman_career_assistant
cd Aman_career_assistant

# Windows
.\bootstrap.ps1

# macOS / Linux
./bootstrap.sh
```

`bootstrap` creates local `.env` files from templates and installs Node dependencies.

Then:

1. **Paste your API keys** into `career-ops/.env` and `job-ops/.env`
   (`ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY`). Switch the active model with
   `LLM_PROVIDER` in each file.
2. Put your real resume into `career-ops/cv.md` and edit `career-ops/config/profile.yml`
   (target roles, locations: India, Singapore, Amsterdam, London, Dubai) and
   `career-ops/portals.yml` (companies + search filters).
3. Start JobOps (needs Docker): `cd job-ops && docker compose up -d`
4. Launch everything: `.\pipeline\start-all.ps1`

## Daily use

1. In **JobOps** (`:3005`) run searches across boards for your locations; it scores + tailors.
2. Bridge the good ones into career-ops:
   ```powershell
   .\pipeline\sync.ps1 -MinScore 70          # only jobs scoring >= 70
   .\pipeline\sync.ps1 -MinScore 60 -DryRun  # preview without writing
   ```
   (cross-platform: `node pipeline/import-jobs.mjs --min-score 70`)
3. In **career-ops web-ui** (`:4317`) run deep evaluation, find contacts, and draft
   referral / cold emails for the imported jobs.
4. Stop everything: `.\pipeline\stop-all.ps1`

## How the bridge works

`pipeline/import-jobs.mjs` reads JobOps' SQLite DB (`job-ops/data/…`) with Node's
built-in `node:sqlite` (no extra deps), filters by fit score + status, and appends
qualifying jobs to `career-ops/data/pipeline.md` (dedup on normalized URL). No coupling
to either app's internals — if JobOps hasn't produced a DB yet, it exits cleanly.

## What is NOT committed

`node_modules/`, real `.env` files (keys), and personal runtime data
(`career-ops/data`, `reports`, `output`; `job-ops/data`) are git-ignored. Templates live
in `setup/env/`. Re-run `bootstrap` on each new machine to regenerate them.

## Coverage gaps to know

- **India:** JobOps includes a Naukri extractor + LinkedIn/Indeed; native boards like
  Instahyre/Cutshort are not covered.
- **Dubai / Middle East:** reachable via LinkedIn/Indeed only; Bayt/GulfTalent are not
  built in. Add a custom extractor (`job-ops` TypeScript extractor docs) if needed.
