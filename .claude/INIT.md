# Claude Code Init Guide - Sip n Play Site

Quick reference for initializing work on this project.

## 📋 Pre-Work Checklist

Before starting ANY development session:

1. **Read the deployment workflow** → See `/claude.md`
2. **Check current version** → `lib/version.ts`
3. **Understand cache system** → See `.claude/project-workflow.md`
4. **Dev server port** → Runs on localhost:3000+ (or first available)

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start dev server (hot reload)
npm run dev
# Server runs on http://localhost:3000 (or next available port)

# Build production
npm run build

# Run production build
npm start
```

## 📝 Git Workflow - ALWAYS DO THIS

### Before Every Push to GitHub:

```bash
# 1. Update version numbers (BOTH files!)
# .  lib/version.ts
#    package.json

# 2. Test the build
npm run build

# 3. Stage and commit
git add .
git commit -m "vX.Y.Z - Description

More details here

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 4. Push to GitHub
git push origin main
```

**IMPORTANT**: GitHub Actions will automatically build and push Docker image to `ghcr.io/brendongl/snp-site:latest`

## 🏗️ Key Architecture

### Version Numbers (Must Stay in Sync!)
- `lib/version.ts` - Version constant used in app
- `package.json` - Package version

**UPDATE BOTH when releasing!**

### Caching System
- **Games**: 1-hour TTL, cache-first strategy → `lib/cache/games-cache.ts`
- **Images**: Content-based dedup (MD5 hash) → `lib/cache/image-cache.ts`

### API Routes
```
/api/games                    # Get all games (cached)
/api/games/refresh            # Refresh incremental
/api/games/refresh?full=true  # Hard refresh + image recache
/api/images/[hash]            # Serve cached image
/api/content-checks           # Get content check history
```

## 🔍 Finding Things

| What | Where |
|------|-------|
| Main page layout | `app/games/page.tsx` |
| Game cards display | `components/features/games/GameCard.tsx` |
| Cache management | `lib/cache/` |
| API routes | `app/api/` |
| Version constant | `lib/version.ts` |
| Workflow guide | `.claude/project-workflow.md` |
| Changelog | `CHANGELOG.md` |
| Claude config | `claude.md` |

## 🐛 Common Issues

### Dev server won't start
```bash
# Clean and restart
rm -rf .next
npm run dev
# It will use next available port (3001, 3002, 3003, etc)
```

### Build fails
```bash
rm -rf .next node_modules
npm install
npm run build
```

### Image cache issues
- Delete `data/image-cache-metadata.json` to reset
- Hard refresh will rebuild cache
- Windows fallback error handling in place

### File permission errors
- Only affects image caching on Windows
- Multiple fallback strategies in place
- Won't crash the app

## 📦 Version Numbers

Use semantic versioning: **MAJOR.MINOR.PATCH**

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features
- **PATCH** (1.0.0 → 1.0.1): Bug fixes

Examples:
- New caching feature → MINOR bump: 1.0.4 → 1.1.0
- Bug fix → PATCH bump: 1.0.4 → 1.0.5
- Redesign → MAJOR bump: 1.0.4 → 2.0.0

## 🐳 Docker & Deployment

After pushing to GitHub:

```bash
# Watchtower (if configured) will auto-deploy
# OR manually:
docker pull ghcr.io/brendongl/snp-site:latest
docker compose up -d

# The image will be tagged:
# ghcr.io/brendongl/snp-site:latest
# ghcr.io/brendongl/snp-site:vX.Y.Z
```

## 📚 Documentation

- **`claude.md`** - Main config file (read this first!)
- **`.claude/project-workflow.md`** - Detailed workflow
- **`CHANGELOG.md`** - Version history and features
- **`.claude/settings.local.json`** - Claude Code settings

## ✅ Quality Checklist

Before committing:
- [ ] Updated `lib/version.ts` AND `package.json`
- [ ] Ran `npm run build` (no errors)
- [ ] Tested locally with `npm run dev`
- [ ] Git commit includes version number
- [ ] Used proper commit template
- [ ] Push goes to `main` branch

## 🔗 Quick Links

- **GitHub**: https://github.com/brendongl/snp-site
- **Docker**: ghcr.io/brendongl/snp-site
- **Local Dev**: http://localhost:3000+ (auto port assignment)
- **Current Version**: Check `lib/version.ts`

---

**Remember**: Always check `claude.md` first when starting new work!
