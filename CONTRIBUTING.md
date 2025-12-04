# Contributing to StockTracker

Thank you for your interest in contributing to StockTracker! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Getting Started](#getting-started)
- [Architecture Overview](#architecture-overview)
- [Development Workflow](#development-workflow)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Coding Standards](#coding-standards)
- [Reporting Issues](#reporting-issues)
- [License](#license)

---

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and considerate in all communications
- Provide constructive feedback
- Focus on the issue, not the person
- Accept responsibility for mistakes and learn from them

---

## Ways to Contribute

- **Report bugs** - Found something broken? Open an issue
- **Suggest features** - Have an idea? We'd love to hear it
- **Submit pull requests** - Fix bugs, add features, improve code
- **Improve documentation** - Help make the docs clearer
- **Add API providers** - Extend market data sources

---

## Getting Started

### Quick Start

```bash
./init.sh              # One-time setup (installs dependencies)
./start-dev.sh         # Start both frontend and backend concurrently
```

### Backend (Express + SQLite)

```bash
cd backend
npm run dev            # Start with nodemon (auto-reload) on port 3001
npm start              # Start without auto-reload
```

### Frontend (React + Vite)

```bash
cd frontend
npm run dev            # Start Vite dev server on port 5173
npm run build          # Production build
npm run lint           # Run ESLint
npm run preview        # Preview production build
```

### Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
FINNHUB_API_KEY=<your_key>        # Required - real-time quotes, search, news
SESSION_SECRET=<random_string>    # Required in production (64+ chars)
PORT=3001                         # Backend port
NODE_ENV=development
```

### API Rate Limits

- **Finnhub**: 60 calls/minute (free tier) - uses in-memory caching
- **Yahoo Finance**: Unofficial API with no documented limits

---

## Architecture Overview

### Data Flow

```
┌─────────────────┐    SSE/REST    ┌─────────────────┐    HTTP    ┌─────────────────┐
│  React Frontend │◄──────────────►│  Express API    │◄──────────►│ Yahoo Finance/  │
│  (Zustand)      │                │  (Session Auth) │            │ Finnhub APIs    │
└─────────────────┘                └────────┬────────┘            └─────────────────┘
                                           │
                                  ┌────────▼────────┐
                                  │  SQLite (WAL)   │
                                  │  better-sqlite3 │
                                  └─────────────────┘
```

### Backend (`backend/src/`)

| Path | Purpose |
|------|---------|
| `index.js` | Express server entry with middleware (Helmet, CORS, sessions, CSRF) |
| `database.js` | SQLite schema and initialization (WAL mode enabled) |
| `routes/` | API endpoints: auth, quotes, stream (SSE), watchlists, search, api-keys, mfa |
| `services/finnhub.js` | Market data provider (profiles, news, search) |
| `services/yahoo.js` | Primary quote/chart provider (no API key required) |
| `middleware/` | Auth middleware, rate limiting, CSRF protection |

### Frontend (`frontend/src/`)

| Path | Purpose |
|------|---------|
| `App.jsx` | React Router setup with protected routes |
| `stores/` | Zustand stores for global state (quotes, auth, watchlists, charts, search) |
| `components/StockChart.jsx` | TradingView Lightweight Charts integration |
| `components/SearchBar.jsx` | Symbol search with autocomplete and live preview |
| `pages/` | Route pages: Dashboard, StockDetail, WatchlistDetail, Login, Register |
| `api/client.js` | API client with CSRF token handling |

### Key Patterns

- **Real-time Updates**: SSE endpoint at `/api/stream/quotes` for live price updates
- **State Management**: Zustand stores with persistence for client-side state
- **Authentication**: Session-based auth with bcrypt, CSRF protection, MFA support
- **Charts**: TradingView Lightweight Charts for candlestick/line charts
- **Database**: SQLite with WAL mode via better-sqlite3 for concurrent access

---

## Development Workflow

1. **Fork the repository** and clone your fork
2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** following the coding standards below
4. **Run linting** to ensure code quality:
   ```bash
   cd frontend && npm run lint
   ```
5. **Test your changes** manually by running the dev servers
6. **Commit with clear messages** describing what and why:
   ```bash
   git commit -m "feat: Add new watchlist sorting option"
   ```
7. **Push to your fork** and create a pull request

---

## Pull Request Guidelines

### Before Submitting

- Ensure your code follows the project's coding standards
- Run `npm run lint` in the frontend directory
- Test your changes locally with both backend and frontend running
- Update documentation if adding new features

### PR Requirements

- **Clear title** - Describe what the PR does (e.g., "Add dark mode toggle")
- **Description** - Explain the changes and motivation
- **Reference issues** - Link related issues (e.g., "Fixes #123")
- **Screenshots** - Include for UI changes
- **Small, focused PRs** - One feature or fix per PR

### Automated Review

Pull requests are automatically reviewed by Claude Code Review (see `.github/workflows/claude-code-review.yml`). The review checks for:
- Code quality and best practices
- Potential bugs or issues
- Performance considerations
- Security concerns
- Test coverage suggestions

---

## Coding Standards

### Backend

- **ES Modules** - Use `import`/`export` syntax (`type: "module"`)
- **Async/await** - Prefer over callbacks and raw Promises
- **Parameterized queries** - Always use to prevent SQL injection:
  ```javascript
  // Good
  db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  // Bad - SQL injection risk
  db.prepare(`SELECT * FROM users WHERE id = ${userId}`).get();
  ```

### Frontend

- **Function components** - Use React hooks, no class components
- **Tailwind CSS** - Use utility classes for styling
- **Zustand** - Use stores for shared state, local state for component-specific data

### General

- Use meaningful variable and function names
- Keep functions focused and small
- Add comments for complex logic
- Follow existing patterns in the codebase

---

## Reporting Issues

### Before Creating an Issue

1. **Search existing issues** to avoid duplicates
2. **Check the documentation** for answers

### When Creating an Issue

- **Use a descriptive title** - Be specific about the problem
- **Describe the issue** - What happened? What did you expect?
- **Reproduction steps** - How can we reproduce the issue?
- **Environment info** - Include:
  - Node.js version (`node --version`)
  - Browser and version
  - Operating system
  - Relevant error messages or logs

### Issue Templates

For bugs:
```
**Description**: [Brief description of the bug]

**Steps to Reproduce**:
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**: [What should happen]

**Actual Behavior**: [What actually happens]

**Environment**:
- Node.js: [version]
- Browser: [name and version]
- OS: [operating system]
```

---

## Key Technologies

| Component | Technology |
|-----------|------------|
| Charts | TradingView Lightweight Charts |
| Tables | TanStack Table + TanStack Virtual |
| State | Zustand |
| Styling | Tailwind CSS |
| Auth | bcrypt + express-session |
| Real-time | Server-Sent Events (SSE) |
| Database | SQLite with better-sqlite3 (WAL mode) |
| Drag-and-drop | dnd-kit |

---

## License

By contributing to StockTracker, you agree that your contributions will be licensed under the [MIT License](LICENSE).

Copyright (c) 2025 Zenetusken
