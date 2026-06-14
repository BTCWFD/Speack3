# Contributing to Speack3

Thanks for your interest! This is a pre-1.0 project; expect rough edges.

## Project layout

- `server/` — Node.js + Express + Socket.io + NeDB backend.
- `mobile/` — React Native 0.73 app.
- `docs/` — design notes.

## Getting started

```bash
# Server
cd server
cp .env.example .env        # then set strong JWT secrets
npm install
npm run dev                 # http://localhost:3000

# Mobile
cd mobile
npm install
# set SERVER_HOST in src/config/api.js (use your LAN IP for a real device)
npm run android             # or: npm run ios (macOS)
```

Or run the server with Docker: `docker compose up --build`.

## Before opening a PR

1. Branch from `master` (`git checkout -b feature/your-thing`).
2. Keep changes focused; match the existing code style (4-space indent).
3. Run the server tests: `cd server && npm test`.
4. If you changed the mobile app, confirm it bundles:
   `cd mobile && npx react-native bundle --platform android --dev true \
     --entry-file index.js --bundle-output /tmp/check.bundle`
5. Do not commit secrets or `server/data/*.db`.
6. Open a PR with a clear description of what and why.

## Security

Please report vulnerabilities privately — see [SECURITY.md](SECURITY.md).
Do not file public issues for exploitable bugs.
