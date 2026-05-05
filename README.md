# Content Calendar

Private content planning app for Adstomate.

## Current Setup

- Frontend: plain HTML, CSS, and vanilla JavaScript
- Backend: Node.js + Express
- Uploads: Multer, stored on local disk
- Runtime: PM2 process named `content-calendar`
- Public domain: `content-calendar.online`
- Reverse proxy: Apache to `127.0.0.1:3100`
- Login: TEAM A password only

## Important Files

- `index.html`: main app shell
- `assets/js/app.js`: calendar, editor, auth, uploads, Social Inbox UI
- `assets/css/styles.css`: app styling
- `server.js`: Express server and API routes
- `api/telegram-notify.js`: Telegram notification route handler
- `ecosystem.config.js`: local PM2 runtime config
- `deploy/apache/content-calendar.online.conf`: Apache reverse proxy example for this domain

## Runtime Data

These folders/files are intentionally not committed:

- `data/state.json`: saved TEAM A calendar content
- `data/social-inbox.json`: Social Inbox connection and message state
- `uploads/`: uploaded image resources
- `backups/`: local backups
- `ecosystem.config.js`: ignored because it can contain real passwords and API secrets

Back up `data/` and `uploads/` before moving servers or doing risky maintenance.

## Local Run

Install dependencies:

```bash
npm install
```

Start locally:

```bash
TEAM_A_PASSWORD="your-password" PORT=3100 npm start
```

Open:

```text
http://localhost:3100
```

## Production Run

The live app runs with PM2:

```bash
pm2 start ecosystem.config.js
pm2 save
```

Useful checks:

```bash
pm2 describe content-calendar
curl -s http://127.0.0.1:3100/api/health
```

Restart after code changes:

```bash
pm2 restart content-calendar
```

## Environment Variables

Core:

- `HOST`: usually `0.0.0.0`
- `PORT`: live app uses `3100`
- `TEAM_A_PASSWORD`: password for the only active login

Optional integrations:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI`
- `PUBLIC_BASE_URL`
- `SOCIAL_TOKEN_ENCRYPTION_KEY`
- `META_WEBHOOK_VERIFY_TOKEN`

## Apache

This project uses Apache as the public reverse proxy. The app itself listens on port `3100`; Apache serves the domain and proxies traffic to Node.

Config reference:

```text
deploy/apache/content-calendar.online.conf
```

Smoke test after Apache or PM2 changes:

```bash
curl -s https://content-calendar.online/api/health
```
