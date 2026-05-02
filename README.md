# Content-Calendar

Content calendar app for a Linux server.

## Stack

- HTML
- CSS
- Vanilla JavaScript
- Node.js
- Express
- Multer
- server-side JSON state storage
- local disk image uploads

## What changed

- Team A state is saved on the server in `data/state.json`
- Team B state is saved on the server in `data/team-b-state.json`
- Uploaded images are saved on the server in `uploads/`
- Images are served publicly from `/uploads/...`
- Browser `localStorage` is now only a fallback/local backup

## Local run

1. Install Node.js 18 or newer.
2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

If port `3000` is already in use, run on another port:

```bash
PORT=3100 npm start
```

4. Open:

```text
http://localhost:3000
```

## Important folders

- `server.js`: Linux app server
- `data/state.json`: TEAM A saved calendar content
- `data/team-b-state.json`: TEAM B saved calendar content
- `uploads/`: uploaded image files
- `ecosystem.config.js`: PM2 config for port `3100`
- `deploy/nginx/content-calendar.online.conf`: ready nginx config for your domain
- `deploy/apache/content-calendar.online.conf`: ready Apache vhost for your domain

## Environment variables

Optional:

- `PORT=3000`
- `HOST=0.0.0.0`
- `TEAM_A_PASSWORD`
- `TEAM_B_PASSWORD`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

If you do not set team passwords in the environment, the defaults are:

- `TEAM A`: `team-a`
- `TEAM B`: `team-b`

## Make it public on your Linux server

### Quick test by IP

Run the app:

```bash
npm install
pm2 start ecosystem.config.js
```

Open your firewall:

```bash
sudo ufw allow 3100/tcp
```

Then visit:

```text
http://YOUR_SERVER_IP:3100
```

### Recommended production setup

Use `nginx` in front of Node so your site is public on port 80 or 443.

1. Install `nginx`
2. Run this app on `127.0.0.1:3100` with `pm2 start ecosystem.config.js`
3. Reverse proxy from `nginx` to Node
4. Point your domain DNS to the server IP
5. Add HTTPS with Let's Encrypt

Ready config in repo:

```text
deploy/nginx/content-calendar.online.conf
```

Example nginx config:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Reload nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Add HTTPS

If your domain already points to the server:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## Keep it running after logout

Use `pm2` or `systemd`.

Example with pm2:

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Notes

- `uploads/` is ignored by git on purpose
- back up `data/state.json`, `data/team-b-state.json`, and `uploads/` if you want durable content storage
- if you move servers, copy both folders
