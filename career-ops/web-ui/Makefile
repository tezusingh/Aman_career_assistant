# v1.58.49 (TOOL-1) — convenience targets layered on top of the npm
# scripts. The project's source of truth for build/test commands is
# package.json; this Makefile is a thin shortcut + the parent-project
# fixture cleaner (which doesn't belong in package.json because it
# writes to the parent repo).

.PHONY: help test clean-test-fixtures clean-test-fixtures-dry-run

help:
	@echo "career-ops-ui — make targets"
	@echo ""
	@echo "  make test                       — run the full unit suite (npm test)"
	@echo "  make clean-test-fixtures        — strip example.com lines from"
	@echo "                                    \$$CAREER_OPS_ROOT/data/pipeline.md"
	@echo "                                    (writes; doctrine: parent-project"
	@echo "                                    write is intentional + irreversible)"
	@echo "  make clean-test-fixtures-dry-run — print the would-be result; no on-disk change"
	@echo ""
	@echo "Anything not here lives in package.json scripts (npm run …)."

test:
	npm test

clean-test-fixtures:
	@node scripts/clean-test-fixtures.mjs

clean-test-fixtures-dry-run:
	@node scripts/clean-test-fixtures.mjs --dry-run
