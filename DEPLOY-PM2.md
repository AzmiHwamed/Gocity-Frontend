# Hosting the frontend on a VPS with PM2

The frontend is a static Vite build. PM2 serves the `dist/` folder; Nginx (optional but recommended)
puts it on port 80/443 with your domain and HTTPS.

## 1. One-time server setup (Ubuntu)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx
sudo npm install -g pm2
```

## 2. Get the code and set the environment

```bash
git clone <your-repo-url> gocity-frontend && cd gocity-frontend
cp .env.example .env.production
nano .env.production
```

Set at least these (they are baked into the build, so rebuild after changing them):

```
VITE_API_BASE_URL=https://api.your-domain.com/api/v1
VITE_SOCKET_URL=https://api.your-domain.com
VITE_GOOGLE_MAPS_KEY=...   # browser key restricted to your domain
```

Also fill the `VITE_FIREBASE_*` values if you use Google/Facebook sign-in or push notifications.

## 3. Build and start

```bash
npm ci
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup        # run the command it prints, so the app restarts after a reboot
```

The site is now on `http://<server-ip>:5173`.

## 4. Domain and HTTPS with Nginx

`/etc/nginx/sites-available/gocity`:

```nginx
server {
  listen 80;
  server_name your-domain.com www.your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:5173;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/gocity /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Then close port 5173 to the outside (`sudo ufw allow 'Nginx Full' && sudo ufw deny 5173`).

## 5. Backend settings to match

In the backend `.env`, allow the new site and use its URL in links:

```
CORS_ORIGIN=https://your-domain.com
APP_URL=https://your-domain.com
```

## Updating

```bash
git pull && npm ci && npm run build && pm2 restart gocity-frontend
```

Useful: `pm2 logs gocity-frontend`, `pm2 status`.
