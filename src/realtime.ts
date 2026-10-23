import { io } from 'socket.io-client';
import type { AppNotification, TripMessage } from './types';

const apiBase = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
const socketUrl = import.meta.env.VITE_SOCKET_URL || new URL(apiBase).origin;

export function subscribeToNotifications(onNotification: (notification: AppNotification) => void) {
  const token = localStorage.getItem('gocity_access_token');
  if (!token) return () => {};
  const socket = io(`${socketUrl}/notifications`, { auth: { token }, transports: ['websocket', 'polling'] });
  socket.on('notification:new', onNotification);
  return () => socket.disconnect();
}

/** Subscribes only after the server confirms the signed-in user belongs to the trip. */
export function subscribeToTripChat(tripId: string | number, onMessage: (message: TripMessage) => void) {
  const token = localStorage.getItem('gocity_access_token');
  if (!token) return () => {};
  const socket = io(`${socketUrl}/trips`, { auth: { token }, transports: ['websocket', 'polling'] });
  socket.on('connect', () => socket.emit('trip:join', { tripId: Number(tripId) }));
  socket.on('trip:message', onMessage);
  return () => socket.disconnect();
}
