# Sip n Play Cafe Portal

A comprehensive customer portal website for Sip n Play Cafe - a board game and video game cafe serving as a social hub for expats and locals.

## Features

- **Authentication System**: Login connected to CustomerCRM Airtable database
- **Board Games Catalog**: Browse ~330 board games with search, filter, and sort functionality
- **Booking System**: Calendar-based booking with private room suggestions
- **Events Management**: Facebook event integration with registration
- **Discord Updates**: Real-time updates from Discord on the homepage
- **AI Chat Integration**: n8n-powered chat widget with cafe knowledge base
- **Multi-language Support**: English and Vietnamese translations

## Tech Stack

- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Airtable (via custom adapter)
- **Authentication**: NextAuth.js
- **Caching**: Redis
- **Deployment**: Docker on Unraid
- **Version Control**: Private GitHub repository

## Development Setup

1. Clone the repository
2. Copy `.env.example` to `.env.local` and fill in your credentials
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000)

## Docker Development

To run Redis for caching in development:
```bash
docker-compose -f docker-compose.dev.yml up
```

## Production Deployment (Unraid)

1. Build the Docker image:
   ```bash
   docker build -t sipnplay-portal .
   ```

2. Run with docker-compose:
   ```bash
   docker-compose up -d
   ```

## Project Structure

```
sipnplay-portal/
├── app/              # Next.js app directory
├── components/       # React components
│   ├── ui/          # shadcn/ui components
│   ├── layout/      # Layout components
│   └── features/    # Feature-specific components
├── lib/             # Utilities and services
│   ├── airtable/    # Airtable services
│   ├── auth/        # Authentication configuration
│   └── integrations/# Third-party integrations
├── types/           # TypeScript type definitions
├── hooks/           # Custom React hooks
├── utils/           # Utility functions
└── docs/            # Documentation
```

## Environment Variables

See `.env.example` for required environment variables. Key integrations:
- Airtable API for database
- NextAuth for authentication
- Discord webhooks for updates
- Facebook Graph API for events
- n8n for chat integration
- Redis for caching

## Git Workflow

- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: Feature branches
- `hotfix/*`: Urgent fixes

### Commit Convention

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Maintenance

## Testing

```bash
npm run test        # Run tests
npm run lint        # Lint code
npm run build       # Build production
```

## Contributing

1. Create feature branch from `develop`
2. Make changes and test locally
3. Commit with descriptive messages
4. Push to GitHub
5. Create pull request to `develop`

## License

Private repository - All rights reserved

## Support

For issues or questions, contact the development team.
