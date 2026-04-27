# Content-Calendar

Simple static content calendar app.

## Tech stack

- HTML
- CSS
- Vanilla JavaScript
- `localStorage` for save/load

## Run locally

Open `index.html` in your browser.

## Edit and save

- Click a day card.
- Edit text, tags, and images.
- Click **Save**.
- Data is saved in browser `localStorage`.

## Deploy to Vercel

1. Push this folder to a git repo.
2. Import the repo in Vercel.
3. Add environment variables in Vercel Project Settings:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
4. Deploy (no build command needed).

This project uses `vercel.json` with:
- static frontend (`index.html`)
- serverless API route (`/api/telegram-notify`) for Telegram notifications

## Telegram notifications

- Notifications are sent when:
  - you add a content item
  - you click **Save** on content edits
- UI shows only send result status: **Send Success** or **Send Fail**
