# Project Cleanup Report & Recommendations

**Date Generated:** October 20, 2025
**Scope:** Complete codebase audit (25+ API routes, 8 doc files, 13 markdown files, 500+ cached images)
**Status:** Ready for cleanup

---

## Executive Summary

Your project has accumulated **significant technical debt** through:
- **13 markdown files** in root (should be 2-3)
- **Session/status documents** that are now outdated (created 9+ days ago)
- **Duplicate documentation** spread across root and `/docs` directory
- **Empty/unused directories** (`hooks/`, `utils/`)
- **Test screenshots** that don't need to be committed
- **Redundant documentation** with overlapping purposes

**Good News:** Core code is well-organized. The mess is primarily in documentation and config.

---

## Section 1: Outdated & Unnecessary Documentation

### 🔴 DELETE (Outdated Session Notes)

These are historical session summaries that are now stale:

1. **`CATEGORIES_FIX_SUMMARY.md`** - Status: OUTDATED
   - Date: January 16, 2025 (9+ days old)
   - Purpose: One-time setup for BGG categories
   - Action: Already implemented in code
   - Recommendation: **DELETE** - This was a one-time task from January

2. **`SESSION_SUMMARY.md`** - Status: OUTDATED
   - Date: January 16, 2025 (9+ days old)
   - Purpose: Spinner wheel redesign notes
   - Contains: Implementation details from a past session
   - Recommendation: **DELETE** - Archive to git history if needed, not relevant now

3. **`SESSION_SUMMARY_2025-10-16.md`** - Status: OUTDATED
   - Date: October 16, 2025 (4+ days old)
   - Purpose: Expansion filtering system notes
   - Contains: Step-by-step implementation details
   - Recommendation: **DELETE** - Feature already implemented and working

4. **`STATUS.md`** - Status: OUTDATED
   - Date: October 16, 2025 (4+ days old)
   - Purpose: v0.1.0 completion status
   - Current Version: 1.2.0 (not 0.1.0)
   - Recommendation: **DELETE** - Completely superseded by version updates

5. **`MIGRATION_SUMMARY.md`** - Status: PARTIALLY OUTDATED
   - Date: October 18, 2025 (2 days old)
   - Purpose: Unraid → Railway migration
   - Current Status: Migration already complete
   - Note: Some info is still useful but should be in DEPLOYMENT.md instead
   - Recommendation: **MERGE** into DEPLOYMENT.md, then DELETE

---

### 🟡 CONSOLIDATE (Redundant Documentation)

These exist in both root and `/docs`:

1. **CHANGELOG.md** (in root)
   - Also exists at: `docs/CHANGELOG.md`
   - Recommendation: **KEEP one, DELETE the other**
   - Choice: Keep in root (users look there first), delete `docs/CHANGELOG.md`

2. **README.md** (in root)
   - Also exists at: `docs/README.md`
   - Recommendation: **KEEP one, DELETE the other**
   - Choice: Keep in root (GitHub shows this), delete `docs/README.md`

---

### 🟡 OVERLY DETAILED (Too Verbose for Size)

These files are comprehensive but could be better organized:

1. **DEPLOYMENT.md** - 360+ lines
   - Purpose: Complete deployment infrastructure
   - Issue: Mixes architecture, Railway setup, troubleshooting
   - Recommendation: **KEEP but reorganize**
   - Action: Extract troubleshooting to TROUBLESHOOTING.md in docs/

2. **RAILWAY_DEPLOYMENT.md** - 400+ lines
   - Purpose: Step-by-step Railway setup
   - Duplication: Heavy overlap with DEPLOYMENT.md
   - Recommendation: **CONSOLIDATE into single guide**
   - Action: Merge into DEPLOYMENT.md with clearer sections

3. **DOCKER.md** - 200+ lines
   - Purpose: Docker build process
   - Note: Still relevant but rarely needed
   - Recommendation: **KEEP as reference in docs/**

---

## Section 2: Files to Delete/Archive

### Immediate Deletions (Safe to Delete Now)

```
❌ CATEGORIES_FIX_SUMMARY.md          (One-time task, completed)
❌ SESSION_SUMMARY.md                  (Session notes, outdated)
❌ SESSION_SUMMARY_2025-10-16.md      (Session notes, outdated)
❌ STATUS.md                           (v0.1.0 status, we're at v1.2.0)
❌ docs/README.md                      (Duplicate of root README.md)
❌ docs/CHANGELOG.md                   (Duplicate of root CHANGELOG.md)
```

### Conditional Deletions

```
⚠️  MIGRATION_SUMMARY.md               (If merged into DEPLOYMENT.md)
⚠️  RAILWAY_DEPLOYMENT.md              (If consolidated into DEPLOYMENT.md)
```

---

## Section 3: Unused/Empty Code Directories

### Empty Directories (No Files)

1. **`hooks/` directory** - Status: EMPTY
   - Purpose: Originally for hooks
   - Current State: All hooks moved to `lib/hooks/`
   - Recommendation: **DELETE** empty directory

2. **`utils/` directory** - Status: EMPTY
   - Purpose: Originally for utilities
   - Current State: All utilities moved to `lib/`
   - Recommendation: **DELETE** empty directory

---

## Section 4: Test/Development Artifacts

### Playwright Screenshots (Not for Committed Code)

Location: `.playwright-mcp/` directory

Files to delete:
```
.playwright-mcp/board-game-wikia.png
.playwright-mcp/check-history-page.png
.playwright-mcp/games-page-current.png
.playwright-mcp/page-current.png
.playwright-mcp/play-logs-authenticated.png
.playwright-mcp/play-logs-empty-state.png
.playwright-mcp/play-logs-page.png
.playwright-mcp/play-logs-table.png
.playwright-mcp/snp-site-*.png
.playwright-mcp/staff-menu-*.png
```

Recommendation: **ADD TO .gitignore**
```
.playwright-mcp/**/*.png
.playwright-mcp/**/*.jpg
.playwright-mcp/**/*.jpeg
```

---

## Section 5: Recommended Documentation Structure

### NEW STRUCTURE (After Cleanup)

```
Root Directory:
├── README.md                    ← GitHub intro (what is this project)
├── CLAUDE.md                    ← Dev workflow guide (HOW TO CODE)
├── CHANGELOG.md                 ← Version history
├── package.json
└── Dockerfile

docs/ Directory:
├── DEPLOYMENT.md                ← Complete infrastructure guide
├── TROUBLESHOOTING.md          ← Moved from DEPLOYMENT.md
├── DOCKER.md                    ← Build process reference
├── AIRTABLE_SCHEMA.md          ← Database schema
├── board-games-catalog.md      ← Feature documentation
├── caching-system.md           ← Cache architecture
├── content-checker.md          ← Content check feature
├── staff-mode.md               ← Staff features guide
├── IMAGE_CACHING.md            ← Image caching details
└── DISCORD_NOTIFICATIONS.md    ← Discord integration

(DELETE THESE AFTER CONSOLIDATING):
❌ docs/README.md
❌ docs/CHANGELOG.md
❌ CATEGORIES_FIX_SUMMARY.md
❌ SESSION_SUMMARY.md
❌ SESSION_SUMMARY_2025-10-16.md
❌ STATUS.md
❌ MIGRATION_SUMMARY.md (merge first)
```

### Documentation Purpose by File

| File | Purpose | Audience | Length |
|------|---------|----------|--------|
| README.md | **What** is this project | Everyone | 1-2 screens |
| CLAUDE.md | **How to** code/develop | Developers | 3-5 screens |
| CHANGELOG.md | Version history | Everyone | 1-2 screens |
| DEPLOYMENT.md | **How to** deploy (complete) | DevOps | 5-8 screens |
| docs/TROUBLESHOOTING.md | **When** things break | Everyone | 2-3 screens |
| docs/DOCKER.md | **Why** Docker (reference) | Infrastructure | 1-2 screens |
| docs/*.md | Feature deep-dives | Developers | 1-3 screens each |

---

## Section 6: Cleanup Checklist

### Phase 1: Delete Outdated Docs (5 minutes)

```
[ ] Delete: CATEGORIES_FIX_SUMMARY.md
[ ] Delete: SESSION_SUMMARY.md
[ ] Delete: SESSION_SUMMARY_2025-10-16.md
[ ] Delete: STATUS.md
[ ] Delete: docs/README.md
[ ] Delete: docs/CHANGELOG.md
```

### Phase 2: Consolidate Documentation (15 minutes)

```
[ ] Read DEPLOYMENT.md + MIGRATION_SUMMARY.md
[ ] Merge MIGRATION_SUMMARY.md into DEPLOYMENT.md
[ ] Extract troubleshooting section → docs/TROUBLESHOOTING.md
[ ] Delete: MIGRATION_SUMMARY.md
[ ] Delete: RAILWAY_DEPLOYMENT.md (if consolidated)
[ ] Update: CLAUDE.md with new doc structure
```

### Phase 3: Clean Up Code Directories (5 minutes)

```
[ ] Delete: Empty hooks/ directory
[ ] Delete: Empty utils/ directory
```

### Phase 4: Ignore Test Artifacts (5 minutes)

```
[ ] Update .gitignore with .playwright-mcp/**/*.png
[ ] Delete all PNG files from .playwright-mcp/
[ ] Commit: "cleanup: Remove test screenshots from version control"
```

### Phase 5: Update CLAUDE.md (10 minutes)

```
[ ] Add "Documentation Structure" section
[ ] Add cleanup prevention rules
[ ] Add file ownership guidelines
```

---

## Section 7: Prevention Rules (For CLAUDE.md)

Add this section to prevent future mess:

```markdown
## Documentation & Project Hygiene

### Documentation Rules
1. **One purpose per file** - Don't mix concerns
2. **No session notes in root** - Archive to git history
3. **No duplicate documentation** - One file per topic
4. **Max 3 top-level .md files** - README, CLAUDE, CHANGELOG
5. **Keep detailed docs in `/docs/`** - Separate from root

### Naming Conventions
- Session notes: Archive branch `sessions/yyyy-mm-dd-topic` or git history
- Status docs: Never commit "STATUS.md" or "SUMMARY.md"
- Summaries: Include only in PR descriptions, not separate files
- Screenshots: Store in `.playwright-mcp/` + add to .gitignore

### File Lifecycle
| Status | Action |
|--------|--------|
| New feature → Use PR description | Don't create FEATURE_SUMMARY.md |
| Session work → Summarize in CHANGELOG | Don't create SESSION_SUMMARY.md |
| Historical info → Archive to git tags | Don't leave in root |
| Bug fixes → Document in code comments | Don't create FIX_SUMMARY.md |

### Root Directory Guidelines
- **Keep in root:**
  - README.md - Project overview
  - CLAUDE.md - Development guide
  - CHANGELOG.md - Version history
  - package.json, tsconfig.json, etc.
  - Dockerfile, docker-compose.yml

- **Move to `/docs/`:**
  - All feature documentation
  - Architecture guides
  - Setup instructions
  - Troubleshooting guides

- **Never commit to root:**
  - Session summaries
  - Status updates
  - Temporary notes
  - Test screenshots
  - .env files or secrets
```

---

## Section 8: API Routes Review

### Current API Routes: 25 endpoints

**Well-organized**, minimal cruft:

- ✅ Games management (6 routes)
- ✅ Content checks (4 routes)
- ✅ Images (2 routes)
- ✅ Staff features (3 routes)
- ✅ Diagnostics (3 routes)
- ✅ BGG integration (1 route)
- ✅ Discord (1 route)
- ✅ Expansions (2 routes)
- ✅ Play logs (1 route)
- ✅ Knowledge base (1 route)

**Recommendation:** No cleanup needed - routes are purposeful

---

## Section 9: Component Structure Review

### Current Components: 25 components

**Well-organized:**

- ✅ Feature components grouped by feature
- ✅ UI primitives separated from features
- ✅ Clear naming conventions
- ✅ No unused components detected

**Recommendation:** No cleanup needed - structure is solid

---

## Section 10: Code Files Review

### Current Code Organization: 40+ TypeScript files

**Status:** Well-organized with clear separation:

- ✅ `lib/airtable/` - Data services
- ✅ `lib/cache/` - Caching layer
- ✅ `lib/hooks/` - Custom hooks
- ✅ `lib/services/` - External integrations
- ✅ `types/index.ts` - Type definitions
- ✅ `app/api/` - API routes
- ✅ `app/games/` - Page routes
- ✅ `app/staff/` - Staff pages
- ✅ `components/` - UI components

**Recommendation:** No cleanup needed - code structure is solid

---

## Section 11: Git Cleanup

### Check Current Git Status

```bash
# See what's tracked
git status

# Check size of repo
git count-objects -v

# Find large objects
git rev-list --objects --all | sort -k 2 | tail -20
```

### After Cleanup

```bash
# Add deletions to staging
git add -A

# Create cleanup commit
git commit -m "v1.2.1 - cleanup: Remove outdated session notes and duplicate docs

- Delete outdated session summaries (CATEGORIES_FIX_SUMMARY.md, etc)
- Delete duplicate documentation (docs/README.md, docs/CHANGELOG.md)
- Add .playwright-mcp screenshots to .gitignore
- Consolidate DEPLOYMENT and MIGRATION_SUMMARY documentation
- Update CLAUDE.md with documentation hygiene guidelines

🤖 Generated with Claude Code"

# Optionally optimize repo (warning: rewrites history!)
# git gc --aggressive
```

---

## Section 12: Summary Statistics

### Before Cleanup

| Category | Count | Status |
|----------|-------|--------|
| Root .md files | 13 | ❌ Too many |
| Docs directory .md files | 10 | ⚠️ Duplicate content |
| Empty code directories | 2 | ❌ Unused |
| API routes | 25 | ✅ Good |
| Components | 25 | ✅ Good |
| Service files | 3+ | ✅ Good |
| Cache files | Large (103 MB) | ⚠️ Expected |
| Test screenshots | 10+ | ❌ In version control |

### After Cleanup (Target)

| Category | Target | Improvement |
|----------|--------|-------------|
| Root .md files | 3 | -10 files removed |
| Docs directory .md files | 8 | -2 files removed |
| Empty code directories | 0 | -2 directories |
| Test screenshots | 0 in repo | Move to .gitignore |
| Total .md files | 11 | -5 files removed |

---

## Section 13: Implementation Order

### Recommended Execution Order

```
1. BACKUP FIRST
   git branch backup-before-cleanup
   git push origin backup-before-cleanup

2. DELETE SESSION DOCS (5 min)
   - CATEGORIES_FIX_SUMMARY.md
   - SESSION_SUMMARY.md
   - SESSION_SUMMARY_2025-10-16.md
   - STATUS.md

3. DELETE DUPLICATES (5 min)
   - docs/README.md
   - docs/CHANGELOG.md

4. CONSOLIDATE DOCS (15 min)
   - Read DEPLOYMENT.md
   - Read MIGRATION_SUMMARY.md
   - Merge content
   - Create docs/TROUBLESHOOTING.md
   - Delete MIGRATION_SUMMARY.md
   - Delete RAILWAY_DEPLOYMENT.md

5. REMOVE EMPTY DIRS (2 min)
   - Delete hooks/
   - Delete utils/

6. IGNORE TEST ARTIFACTS (3 min)
   - Update .gitignore
   - Delete .playwright-mcp/*.png

7. UPDATE CLAUDE.md (10 min)
   - Add Documentation & Project Hygiene section
   - Add file lifecycle guidelines
   - Add cleanup prevention rules

8. COMMIT ALL CHANGES (2 min)
   git commit -m "v1.2.1 - cleanup: ..."

9. VERIFY (5 min)
   - npm run build
   - Visual inspection of docs/
   - Check .gitignore is working
```

---

## Section 14: Why This Matters

### Costs of Current Messiness

1. **Navigation Chaos** - Users don't know which doc to read
2. **Update Burden** - Duplicate docs get out of sync
3. **Onboarding Friction** - New devs spend time sorting through docs
4. **Professional Appearance** - Messy repo signals poor practices
5. **Search Confusion** - Multiple versions of "how to deploy"
6. **Repository Bloat** - Test screenshots add unnecessary size

### Benefits After Cleanup

1. ✅ **Clear Documentation Path** - README → CLAUDE → docs/*
2. ✅ **Single Source of Truth** - One file per topic
3. ✅ **Better Onboarding** - New devs know where to look
4. ✅ **Professional Quality** - Clean repo, clean documentation
5. ✅ **Easy Maintenance** - Updates in one place only
6. ✅ **Smaller Repository** - Faster clones, cleaner history

---

## Section 15: Prevention Going Forward

### New Guidelines for CLAUDE.md

**When you add new documentation:**
1. Ask: "Does a file already exist for this?"
2. Ask: "Will this be outdated soon?"
3. Ask: "Should this be in the code comments instead?"
4. Ask: "Is this root-level or docs/-level?"

**New Feature Workflow:**
- Feature PR: Describe in PR body (not a new file)
- After merge: Update CLAUDE.md/feature docs if needed
- Never create: SESSION_SUMMARY.md, STATUS.md, SUMMARY.md

**Bug Fix Workflow:**
- Fix PR: Document the fix in code comments
- After merge: Update TROUBLESHOOTING.md if applicable
- Never create: A separate fix summary file

**Session Work:**
- Work locally, commit regularly to branches
- Summarize work in git commit messages
- Archive detailed notes to git history, not root files

---

## Next Steps

1. **Review** this report
2. **Create backup branch** (safety first!)
3. **Execute Phase 1** (delete outdated docs)
4. **Execute Phase 2** (consolidate)
5. **Execute Phase 3-5** (code cleanup)
6. **Update CLAUDE.md** (prevention rules)
7. **Commit** all changes
8. **Verify build** passes

---

**Report Generated:** October 20, 2025
**Estimated Cleanup Time:** 45 minutes
**Risk Level:** Low (only docs and empty dirs)
**Backup Recommended:** Yes ✅
