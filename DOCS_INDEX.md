# Documentation Index

Quick navigation to all project documentation.

---

## Getting Started

| Guide | Purpose | For Whom |
|-------|---------|----------|
| [README.md](README.md) | Project overview & quick start | Everyone |
| [CLAUDE.md](CLAUDE.md) | Development workflow & local setup | Developers using Claude Code |

---

## Production Deployment (Railway Stack)

| Guide | Purpose | For Whom |
|-------|---------|----------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | **🎯 START HERE** - Complete architecture & workflow | DevOps / Deployment |
| [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) | Step-by-step Railway + Cloudflare setup | First-time deployment |
| [DOCKER.md](DOCKER.md) | Docker build process & optimization | Docker / Infrastructure |

---

## Architecture Overview

### Hosting Stack
```
┌─────────────────┐
│   Your Local    │
│   Computer      │
└────────┬────────┘
         │ git push
         ↓
┌─────────────────┐
│  GitHub Repo    │
└────────┬────────┘
         │ GitHub Actions
         ↓
┌─────────────────┐
│  Docker Image   │
│  (ghcr.io)      │
└────────┬────────┘
         │ Auto-detected
         ↓
┌─────────────────┐
│  Railway        │
│  (Deploy)       │
└────────┬────────┘
         │ CNAME
         ↓
┌─────────────────┐
│  Cloudflare     │
│  DNS            │
└────────┬────────┘
         │ sipnplay.cafe
         ↓
┌─────────────────┐
│  User Browser   │
│  (Live Site)    │
└─────────────────┘
```

---

## Documentation Breakdown

### [DEPLOYMENT.md](DEPLOYMENT.md) - Complete Guide
**Read this first for production understanding**

- Architecture diagram
- Step-by-step deployment workflow
- Environment variables reference
- Caching layers explained
- Troubleshooting guide
- Cost & performance
- Common tasks

### [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) - Setup Guide
**Read this for hands-on setup**

- Create Railway account
- Connect GitHub repo
- Configure environment variables
- Deploy to Railway
- Connect Cloudflare DNS
- Verify deployment
- Common issues & fixes

### [DOCKER.md](DOCKER.md) - Build & Containerization
**Read this to understand Docker setup**

- Multi-stage build explanation
- Build optimization
- GitHub Actions auto-build
- Persistent storage
- Local Docker testing
- Troubleshooting builds

### [CLAUDE.md](CLAUDE.md) - Development Workflow
**Read this for local development**

- Build & run commands
- Version management
- Git workflow
- Project structure
- Common dev tasks
- Debugging cache issues
- API endpoints reference

---

## Quick Reference

### Development
```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm start                # Run production build locally
```

### Deployment
```bash
# All automatic on git push:
# 1. GitHub Actions builds Docker image
# 2. Pushes to ghcr.io
# 3. Railway detects & deploys
# 4. Visit https://sipnplay.cafe
```

### Cache Management
```bash
# Incremental refresh
curl -X POST https://sipnplay.cafe/api/games/refresh

# Full refresh (recaches images)
curl -X POST https://sipnplay.cafe/api/games/refresh?full=true

# Check health
curl https://sipnplay.cafe/api/health
```

### Key Files
- `lib/version.ts` - Version constant (update with package.json)
- `package.json` - Dependencies & version
- `Dockerfile` - Multi-stage build
- `.github/workflows/docker-build.yml` - Auto-build on push
- `CLAUDE.md` - Development guide
- `DEPLOYMENT.md` - Production guide

---

## Common Scenarios

### "I want to deploy to production"
→ Read [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) (Part 1-5)

### "I want to understand the architecture"
→ Read [DEPLOYMENT.md](DEPLOYMENT.md) (Architecture Overview)

### "I want to make code changes"
→ Read [CLAUDE.md](CLAUDE.md) (Common Development Tasks)

### "The site isn't loading"
→ Read [DEPLOYMENT.md](DEPLOYMENT.md) (Troubleshooting)

### "I want to change the Docker setup"
→ Read [DOCKER.md](DOCKER.md)

### "I need to update environment variables"
→ See [DEPLOYMENT.md](DEPLOYMENT.md) (Step 5: Environment Variables)

### "I want to add a new filter to games"
→ Read [CLAUDE.md](CLAUDE.md) (Adding a New Filter)

---

## Infrastructure Details

### Hosting
- **Platform:** Railway.app
- **Deployment:** Automatic on GitHub push
- **Cost:** Free tier (~$0-5/month)
- **Uptime:** 99.9%

### DNS
- **Provider:** Cloudflare
- **Domain:** sipnplay.cafe
- **Registrar:** Namecheap
- **Setup:** CNAME @ → snp-site-production.up.railway.app

### Build Pipeline
- **Trigger:** Push to `main` branch
- **Builder:** GitHub Actions
- **Registry:** GitHub Container Registry (ghcr.io)
- **Auto-deploy:** Railway watches for new images

### Caching
- **Games Cache:** 1-hour TTL (file-based)
- **Image Cache:** Persistent (content-deduped)
- **Browser Cache:** 1 year for images
- **Survives:** Restarts, redeployments

---

## Version Information

**Current Version:** 1.0.6
**Framework:** Next.js 15 + TypeScript
**Node:** 20+ (Alpine)
**Database:** Airtable
**Hosting:** Railway

---

## Support & Issues

- **GitHub Issues:** https://github.com/brendongl/snp-site/issues
- **Railway Dashboard:** https://railway.app/dashboard
- **Cloudflare Dashboard:** https://dash.cloudflare.com
- **Airtable:** Your Board Games base

---

**Last Updated:** October 18, 2025
