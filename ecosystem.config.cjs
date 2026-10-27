// PM2 process for the built frontend: serves dist/ as a single-page app.
// Build first (npm run build), then: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'gocity-frontend',
      script: 'serve', // PM2's built-in static server
      env: {
        PM2_SERVE_PATH: './dist',
        PM2_SERVE_PORT: 5173,
        PM2_SERVE_SPA: 'true', // unknown paths (e.g. /trips/12) return index.html
        PM2_SERVE_HOMEPAGE: '/index.html',
      },
    },
  ],
};
