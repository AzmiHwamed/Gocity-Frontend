import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
const firebaseWorker = (config) => {
    const source = `importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');
firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => self.registration.showNotification(payload.notification?.title || 'GoCity update', { body: payload.notification?.body || '', data: payload.data || {} }));
self.addEventListener('notificationclick', (event) => { event.notification.close(); event.waitUntil(clients.openWindow(event.notification.data?.url || '/notifications')); });`;
    return {
        name: 'gocity-firebase-messaging-worker',
        configureServer(server) {
            server.middlewares.use('/firebase-messaging-sw.js', (_req, res) => { res.setHeader('content-type', 'application/javascript'); res.end(source); });
        },
        generateBundle() { this.emitFile({ type: 'asset', fileName: 'firebase-messaging-sw.js', source }); },
    };
};
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    const firebaseConfig = { apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID, messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: env.VITE_FIREBASE_APP_ID };
    return { plugins: [react(), firebaseWorker(firebaseConfig)], server: { port: 5173 } };
});
