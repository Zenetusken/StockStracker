# StockTracker

![React](https://img.shields.io/badge/React-18.2-61DAFB?style=flat&logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat&logo=sqlite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=flat&logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)


**Institutional-grade analytics meets complete data privacy. Open source, self-hosted, and engineered for the individual investor.**

Built for developers, StockTracker is a local-first platform that merges real-time market streaming via SSE with professional FIFO tax accounting. It delivers an enterprise-grade experience—featuring MFA, audit logging, and advanced analytics—without the monthly subscription fees. All data is stored in your own local SQLite database, ensuring complete privacy and ownership.

<p align="center">
  <img src="docs/UI_SCREENSHOT.png" alt="StockTracker Dashboard" width="800">
  <br>
  <em>Dashboard with recently viewed stocks, instant preview panel, and the Jade Requiem theme</em>
</p>


## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd StockTracker
./init.sh
```

### 2. Configure API Keys

**Powered by a Single Free Key**

StockTracker's intelligent data engine is designed to run flawlessly on a single free Finnhub API key. We handle the optimization so you get institutional-grade data without the overhead.

1. **[Get your free key](https://finnhub.io/register)** (takes < 30 seconds).
2. Create your `.env` file:
   ```bash
   cp .env.example .env
   ```
3. Paste your key:
   ```bash
   FINNHUB_API_KEY=your_key_here
   SESSION_SECRET=any_random_string
   ```

That’s it. Your dashboard is live.

### 3. Start Development

```bash
./start-dev.sh
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001


## Contributing

**StockTracker is under active development.**
New features, performance improvements, and analytics tools are pushed daily. Check back often for updates.

We welcome contributions! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to submit pull requests, report issues, and contribute to the project.


MIT License - Copyright (c) 2025

See the [LICENSE](LICENSE) file for details.


## Disclaimer

Market data is for informational purposes only and may have slight delays or variations between sources. Not investment advice—always do your own research.
