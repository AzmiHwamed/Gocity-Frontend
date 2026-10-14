import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import type { AppNotification } from './types';

const config = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const enabled = Object.values(config).every(Boolean) && !!vapidKey;

export async function enablePush(onForegroundMessage: (notification: Partial<AppNotification>) => void) {
  if (!enabled || !(await isSupported()) || !('serviceWorker' in navigator)) return null;
  const permission = await Notification.requestPermission(); if (permission !== 'granted') return null;
  await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const registration = await navigator.serviceWorker.ready;
  const app = getApps().length ? getApp() : initializeApp(config);
  const messaging = getMessaging(app);
  onMessage(messaging, (payload) => onForegroundMessage({ title: payload.notification?.title || 'GoCity update', body: payload.notification?.body || '', type: payload.data?.type || 'general', data: payload.data }));
  return getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
}
