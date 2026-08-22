---
description: Print the current GSD planning state (roadmap phases, active milestone, pending phase) for career-ops-ui.
---

Run a fast triage of the GSD pipeline state for this repo:

1. Read `.planning/ROADMAP.md` (if it exists) and list each phase with its status.
2. List directories under `.planning/phases/` and report which one has `STATE.json: active`.
3. Show the latest entries in `.planning/CHANGELOG.md` if present.
4. Cross-check `docs/ROADMAP.md` (the public roadmap) against `.planning/ROADMAP.md` — flag drift.

Output:

```
## GSD state — <today>
- Active phase: <name>
- Pending phases: <list>
- Public roadmap drift: <none | description>
```

Use Read + Glob only — don't write anything. Under 200 words.
