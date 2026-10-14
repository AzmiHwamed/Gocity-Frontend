import axios from 'axios';
import type { AppNotification, AuthResult, CitySuggestion, Envelope, Expense, ExpenseSummary, GalleryItem, HotelPage, Trip, User } from './types';

// .env.example names it VITE_API_BASE_URL; accept both.
const client = axios.create({ baseURL: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1' });
/** Backend paths like /api/v1/places/photo?… need the API's origin when the app runs on another port. */
export const assetUrl = (path?: string | null) => (path ? new URL(path, client.defaults.baseURL).toString() : '');
const token = () => localStorage.getItem('gocity_access_token');
client.interceptors.request.use((config) => { if (token()) config.headers.Authorization = `Bearer ${token()}`; return config; });
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    if (error.response?.status === 401 && !request._retry && localStorage.getItem('gocity_refresh_token')) {
      request._retry = true;
      try {
        const { data } = await axios.post<Envelope<AuthResult>>(`${client.defaults.baseURL}/auth/refresh`, { refreshToken: localStorage.getItem('gocity_refresh_token') });
        saveSession(data.response_body); request.headers.Authorization = `Bearer ${data.response_body.accessToken}`; return client(request);
      } catch { clearSession(); }
    }
    return Promise.reject(error);
  },
);
export const saveSession = (session: AuthResult) => { localStorage.setItem('gocity_access_token', session.accessToken); localStorage.setItem('gocity_refresh_token', session.refreshToken); localStorage.setItem('gocity_user', JSON.stringify(session.user)); };
export const clearSession = () => ['gocity_access_token', 'gocity_refresh_token', 'gocity_user'].forEach((key) => localStorage.removeItem(key));
/** Accept the API envelope while still tolerating plain JSON from endpoints/proxies. */
const body = <T>(p: Promise<{ data: Envelope<T> | T }>) => p.then((r) => {
  const payload = r.data as Envelope<T>;
  if (payload && typeof payload === 'object' && 'response_body' in payload) return payload.response_body as T;
  return r.data as T;
});
export const apiError = (error: unknown, fallback = 'Something went wrong. Please try again.') => {
  const candidate = error as { response?: { data?: Partial<Envelope<unknown>> & { message?: string | string[] } }; message?: string };
  const message = candidate.response?.data?.response_error ?? candidate.response?.data?.message ?? candidate.message;
  return Array.isArray(message) ? message.join('; ') : message || fallback;
};
export const api = {
  login: (email: string, password: string) => body<AuthResult>(client.post('/auth/login', { email, password })),
  register: (input: Record<string, string>) => body<AuthResult>(client.post('/auth/register', input)),
  me: () => body<User>(client.get('/auth/me')),
  updateMe: (input: Record<string, string>) => body<User>(client.patch('/users/me', input)),
  notifications: () => body<AppNotification[]>(client.get('/notifications')),
  markNotificationRead: (id: number) => body<void>(client.patch(`/notifications/${id}/read`)),
  markAllNotificationsRead: () => body<void>(client.patch('/notifications/read-all')),
  registerDevice: (token: string) => body<void>(client.post('/notifications/devices', { token, platform: 'web' })),
  logout: (refreshToken: string) => body<void>(client.post('/auth/logout', { refreshToken })),
  forgotPassword: (email: string) => body<{ message: string }>(client.post('/auth/forgot-password', { email })),
  verifyOtp: (email: string, otp: string) => body<{ resetToken: string; expiresIn: number }>(client.post('/auth/verify-otp', { email, otp })),
  resetPassword: (resetToken: string, newPassword: string) => body<{ message: string }>(client.post('/auth/reset-password', { resetToken, newPassword })),
  publicTrips: (params: { q?: string; cityPlaceId?: string; from?: string; to?: string; sort?: 'newest' | 'start_date' } = {}) => body<Trip[] | { items: Trip[] }>(client.get('/trips/public', { params })),
  // Google Places through the backend
  searchCities: (q: string, sessionToken?: string) => body<CitySuggestion[]>(client.get('/places/cities/search', { params: { q, sessionToken } })),
  hotelSearch: (params: { q?: string; placeId?: string; city?: string; minRating?: number; maxPriceLevel?: number; limit?: number; pageToken?: string }) => body<HotelPage>(client.get('/places/hotels', { params })),
  hotelSuggestions: (tripId: string, params: { minRating?: number; maxPriceLevel?: number; limit?: number; pageToken?: string } = {}) => body<HotelPage>(client.get(`/trips/${tripId}/hotel-suggestions`, { params })),
  setHotel: (tripId: string, input: { placeId: string; pricePerNight?: number; nights?: number; totalPrice?: number; currency?: string; paidById?: number }) => body<Trip>(client.put(`/trips/${tripId}/hotel`, input)),
  removeHotel: (tripId: string) => body<void>(client.delete(`/trips/${tripId}/hotel`)),
  // Expenses
  expenses: (tripId: string) => body<Expense[]>(client.get(`/trips/${tripId}/expenses`)),
  expenseSummary: (tripId: string) => body<ExpenseSummary>(client.get(`/trips/${tripId}/expenses/summary`)),
  addExpense: (tripId: string, input: Record<string, unknown>) => body<Expense>(client.post(`/trips/${tripId}/expenses`, input)),
  updateExpense: (tripId: string, expenseId: number, input: Record<string, unknown>) => body<Expense>(client.patch(`/trips/${tripId}/expenses/${expenseId}`, input)),
  deleteExpense: (tripId: string, expenseId: number) => body<void>(client.delete(`/trips/${tripId}/expenses/${expenseId}`)),
  myTrips: () => body<Trip[] | { items: Trip[] }>(client.get('/trips')),
  trip: (id: string) => body<Trip>(client.get(`/trips/${id}`)),
  publicTrip: (id: string) => body<Trip>(client.get(`/trips/public/${id}`)),
  createTrip: (input: Record<string, unknown>) => body<Trip>(client.post('/trips', input)),
  updateTrip: (id: string, input: Record<string, unknown>) => body<Trip>(client.patch(`/trips/${id}`, input)),
  copyTrip: (id: string) => body<Trip>(client.post(`/trips/${id}/copy`, {})),
  activities: (tripId: string) => body<any>(client.get(`/trips/${tripId}/activities`)),
  addActivity: (tripId: string, input: Record<string, unknown>) => body<any>(client.post(`/trips/${tripId}/activities`, input)),
  updateActivity: (tripId: string, activityId: number, input: Record<string, unknown>) => body<any>(client.patch(`/trips/${tripId}/activities/${activityId}`, input)),
  deleteActivity: (tripId: string, activityId: number) => body<void>(client.delete(`/trips/${tripId}/activities/${activityId}`)),
  ideas: (tripId: string) => body<any>(client.get(`/trips/${tripId}/ideas`)),
  addIdea: (tripId: string, input: Record<string, unknown>) => body<any>(client.post(`/trips/${tripId}/ideas`, input)),
  vote: (tripId: string, ideaId: number, value: string) => body<any>(client.put(`/trips/${tripId}/ideas/${ideaId}/vote`, { value })),
  deleteIdea: (tripId: string, ideaId: number) => body<void>(client.delete(`/trips/${tripId}/ideas/${ideaId}`)),
  members: (tripId: string) => body<any[]>(client.get(`/trips/${tripId}/members`)),
  invite: (tripId: string, input: Record<string, unknown>) => body<any>(client.post(`/trips/${tripId}/invitations`, input)),
  invitations: () => body<any[]>(client.get('/invitations')),
  acceptInvitation: (id: number) => body<any>(client.post(`/invitations/${id}/accept`)),
  declineInvitation: (id: number) => body<void>(client.post(`/invitations/${id}/decline`)),
  searchUsers: (q: string, excludeTripId?: string) => body<any[]>(client.get('/users/search', { params: { q, excludeTripId } })),
  updateVisibility: (tripId: string, visibility: string) => body<any>(client.patch(`/trips/${tripId}/visibility`, { visibility })),
  shareDetails: (tripId: string, input: Record<string, unknown>) => body<any>(client.patch(`/trips/${tripId}/share-details`, input)),
  addTripGallery: (tripId: string, images: File[]) => { const form = new FormData(); images.forEach((image) => form.append('images', image)); return body<any[]>(client.post(`/trips/${tripId}/gallery`, form)); },
  setTripCover: (tripId: string, mediaId: number | null) => body<void>(client.patch(`/trips/${tripId}/cover`, { mediaId })),
  tripGallery: (tripId: string) => body<GalleryItem[]>(client.get(`/trips/${tripId}/gallery`)),
  /** One file per request, so each file gets its own progress bar and its own error. */
  uploadTripMedia: (tripId: string, file: File, onProgress?: (percent: number) => void) => { const form = new FormData(); form.append('images', file); return body<GalleryItem[]>(client.post(`/trips/${tripId}/gallery`, form, { onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)) })).then((items) => items[0]); },
  reorderGallery: (tripId: string, mediaIds: number[]) => body<GalleryItem[]>(client.patch(`/trips/${tripId}/gallery/order`, { mediaIds })),
  deleteGalleryItem: (tripId: string, mediaId: number) => body<void>(client.delete(`/trips/${tripId}/gallery/${mediaId}`)),
  inviteLink: (tripId: string) => body<{ code: string; url: string; role: string }>(client.get(`/trips/${tripId}/invite-link`)),
  regenerateInviteLink: (tripId: string) => body<{ code: string; url: string; role: string }>(client.post(`/trips/${tripId}/invite-link/regenerate`)),
  previewInvite: (code: string) => body<any>(client.get(`/trips/invite/${code}`)),
  joinInvite: (code: string) => body<{ tripId: number; role: string; alreadyMember: boolean }>(client.post(`/trips/invite/${code}/join`)),
};
