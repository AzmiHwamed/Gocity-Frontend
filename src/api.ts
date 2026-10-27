import axios from 'axios';
import type { AdminEsimPlan, AdminOverview, Paged, AppNotification, AuthResult, CitySuggestion, DayRoute, Envelope, EsimList, Expense, ExpenseSummary, Favorite, FlightPlace, FlightPrices, TripBooking, TripFlights, PlaceDetails, FavoritePage, FavoriteType, GalleryItem, HotelPage, LegalDocument, LegalKind, LegalStatus, LegalVersion, PlaceResult, Interest, OrganizationAnalytics, OrganizationProgram, Trip, TripMessage, User } from './types';

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
  const candidate = error as { code?: string; response?: { status?: number; data?: Partial<Envelope<unknown>> & { message?: string | string[] } }; message?: string };
  const message = candidate.response?.data?.response_error ?? candidate.response?.data?.message ?? candidate.message;
  if (!candidate.response && (candidate.code === 'ERR_NETWORK' || candidate.message === 'Network Error')) return 'Unable to reach GoCity. Check your connection and try again.';
  if (candidate.response?.status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (candidate.response?.status && candidate.response.status >= 500) return 'GoCity is temporarily unavailable. Please try again shortly.';
  if (candidate.response?.status === 403) return 'You do not have permission to do that.';
  if (candidate.response?.status === 404) return 'We could not find what you were looking for.';
  return Array.isArray(message) ? message.join('; ') : message || fallback;
};
export const api = {
  login: (email: string, password: string, acceptTerms = false) => body<AuthResult>(client.post('/auth/login', { email, password, acceptTerms })),
  oauthLogin: (provider: 'google' | 'facebook', firebaseIdToken: string, acceptTerms = false) => body<AuthResult>(client.post('/auth/oauth/login', { provider, firebaseIdToken, acceptTerms })),
  register: (input: Record<string, string | boolean>) => body<{ message: string }>(client.post('/auth/register', input)),
  registerOrganization: (input: Record<string, string | boolean>) => body<{ message: string }>(client.post('/auth/register-organization', input)),
  verifyRegistration: (email: string, otp: string) => body<AuthResult>(client.post('/auth/verify-registration', { email, otp })),
  me: () => body<User>(client.get('/auth/me')),
  updateMe: (input: Record<string, string> | FormData) => body<User>(client.patch('/users/me', input)),
  interests: () => body<Interest[]>(client.get('/interests')),
  createInterest: (name: string) => body<Interest>(client.post('/interests', { name })),
  updateInterest: (id: number, name: string) => body<Interest>(client.patch(`/interests/${id}`, { name })),
  deleteInterest: (id: number) => body<void>(client.delete(`/interests/${id}`)),
  notifications: () => body<AppNotification[]>(client.get('/notifications')),
  markNotificationRead: (id: number) => body<void>(client.patch(`/notifications/${id}/read`)),
  markAllNotificationsRead: () => body<void>(client.patch('/notifications/read-all')),
  registerDevice: (token: string) => body<void>(client.post('/notifications/devices', { token, platform: 'web' })),
  logout: (refreshToken: string) => body<void>(client.post('/auth/logout', { refreshToken })),
  forgotPassword: (email: string) => body<{ message: string }>(client.post('/auth/forgot-password', { email })),
  verifyOtp: (email: string, otp: string) => body<{ resetToken: string; expiresIn: number }>(client.post('/auth/verify-otp', { email, otp })),
  resetPassword: (resetToken: string, newPassword: string) => body<{ message: string }>(client.post('/auth/reset-password', { resetToken, newPassword })),
  publicTrips: (params: { q?: string; cityPlaceId?: string; from?: string; to?: string; sort?: 'newest' | 'start_date' } = {}) => body<Trip[] | { items: Trip[] }>(client.get('/trips/public', { params })),
  adminOverview: () => body<AdminOverview>(client.get('/users/admin/overview')),
  adminUsers: (params: { page?: number; limit?: number; search?: string; role?: string } = {}) => body<Paged<User>>(client.get('/users', { params })),
  adminTrips: (params: { page?: number; limit?: number; search?: string; visibility?: string } = {}) => body<Paged<Trip>>(client.get('/users/admin/trips', { params })),
  adminCreateUser: (input: Record<string, string>) => body<User>(client.post('/users', input)),
  adminDeleteUser: (id: number) => body<void>(client.delete(`/users/${id}`)),
  adminPrograms: () => body<OrganizationProgram[]>(client.get('/admin/programs')),
  adminSetProgramPublished: (id: number, isPublished: boolean) => body<OrganizationProgram>(client.patch(`/admin/programs/${id}/publish`, { isPublished })),
  adminDeleteProgram: (id: number) => body<void>(client.delete(`/admin/programs/${id}`)),
  adminEsimPlans: (country?: string) => body<AdminEsimPlan[]>(client.get('/booking/esims/plans', { params: country ? { country } : undefined })),
  adminCreateEsimPlan: (input: Record<string, unknown>) => body<AdminEsimPlan>(client.post('/booking/esims/plans', input)),
  adminUpdateEsimPlan: (id: number, input: Record<string, unknown>) => body<AdminEsimPlan>(client.patch(`/booking/esims/plans/${id}`, input)),
  adminDeleteEsimPlan: (id: number) => body<void>(client.delete(`/booking/esims/plans/${id}`)),
  adminUpdateUser: (id: number, input: Partial<Pick<User, 'isActive' | 'role' | 'organizationName'>>) => body<User>(client.patch(`/users/${id}`, input)),
  forYouTrips: (params: { q?: string; cityPlaceId?: string; sort?: 'newest' | 'start_date' } = {}) => body<Trip[] | { items: Trip[] }>(client.get('/trips/public/for-you', { params })),
  cityBreakTrips: (params: { city?: string; cityPlaceId?: string; sort?: 'newest' | 'start_date' } = {}) => body<Trip[] | { items: Trip[] }>(client.get('/trips/public/city-breaks', { params })),
  agencyTrips: (params: { q?: string; cityPlaceId?: string; sort?: 'newest' | 'start_date' } = {}) => body<Trip[] | { items: Trip[] }>(client.get('/trips/public/agencies', { params })),
  // Google Places through the backend
  searchCities: (q: string, sessionToken?: string) => body<CitySuggestion[]>(client.get('/places/cities/search', { params: { q, sessionToken } })),
  tripRoute: (tripId: string, day: number, includeHotel = false) => body<DayRoute>(client.get(`/trips/${tripId}/route`, { params: { day, includeHotel } })),
  tripMessages: (tripId: string, limit = 50) => body<TripMessage[]>(client.get(`/trips/${tripId}/messages`, { params: { limit } })),
  sendTripMessage: (tripId: string, content: string, sharedTripId?: number, sharedActivityId?: number) => body<TripMessage>(client.post(`/trips/${tripId}/messages`, { content: content || undefined, sharedTripId, sharedActivityId })),
  tripChatReadState: (tripId: string) => body<{ unreadCount: number; readAt: string | null }>(client.get(`/trips/${tripId}/messages/read-state`)),
  markTripChatRead: (tripId: string) => body<{ unreadCount: number; readAt: string }>(client.patch(`/trips/${tripId}/messages/read`)),
  // Booking (flights & eSIMs)
  tripFlights: (tripId: string) => body<TripFlights>(client.get(`/booking/trips/${tripId}/flights`)),
  placeDetails: (placeId: string, date?: string) => body<PlaceDetails>(client.get(`/places/details/${encodeURIComponent(placeId)}`, { params: { date } })),
  tripBooking: (tripId: string) => body<TripBooking>(client.get(`/booking/trips/${tripId}`)),
  esims: (country?: string) => body<EsimList>(client.get('/booking/esims', { params: country ? { country } : undefined })),
  flightPlaces: (term: string) => body<FlightPlace[]>(client.get('/booking/flights/places', { params: { term } })),
  flightPrices: (params: { origin: string; destination: string; departDate: string; returnDate?: string; adults?: number; currency?: string }) => body<FlightPrices>(client.get('/booking/flights/prices', { params })),
  searchPlaces: (params: { q: string; near?: string; lat?: number; lng?: number; limit?: number }) => body<PlaceResult[]>(client.get('/places/search', { params })),
  hotelSearch: (params: { q?: string; placeId?: string; city?: string; minRating?: number; maxPriceLevel?: number; limit?: number; pageToken?: string }) => body<HotelPage>(client.get('/places/hotels', { params })),
  hotelSuggestions: (tripId: string, params: { minRating?: number; maxPriceLevel?: number; limit?: number; pageToken?: string } = {}) => body<HotelPage>(client.get(`/trips/${tripId}/hotel-suggestions`, { params })),
  setHotel: (tripId: string, input: { placeId: string; pricePerNight?: number; nights?: number; totalPrice?: number; currency?: string; paidById?: number }) => body<Trip>(client.put(`/trips/${tripId}/hotel`, input)),
  removeHotel: (tripId: string) => body<void>(client.delete(`/trips/${tripId}/hotel`)),
  // Privacy policy & terms
  legal: (kind: LegalKind, lang = 'en') => body<LegalDocument>(client.get(`/legal/${kind}`, { params: { lang } })),
  legalVersions: (kind: LegalKind) => body<LegalVersion[]>(client.get(`/legal/${kind}/versions`)),
  legalVersion: (kind: LegalKind, version: string) => body<LegalDocument>(client.get(`/legal/${kind}/versions/${encodeURIComponent(version)}`)),
  legalStatus: () => body<LegalStatus>(client.get('/legal/status')),
  /** Accepts the current versions (both documents by default). */
  acceptLegal: (types?: ('terms_of_use' | 'privacy_policy')[]) => body<LegalStatus>(client.post('/legal/accept', { types })),
  // Favorites
  favorites: (params: { type?: FavoriteType; page?: number; limit?: number } = {}) => body<FavoritePage>(client.get('/favorites', { params })),
  addFavorite: (type: FavoriteType, targetId: string | number, title?: string) => body<Favorite>(client.post('/favorites', { type, targetId: String(targetId), title })),
  removeFavorite: (type: FavoriteType, targetId: string | number) => body<void>(client.delete(`/favorites/${type}/${encodeURIComponent(String(targetId))}`)),
  /** Which of these ids are in my favorites. */
  checkFavorites: (type: FavoriteType, ids: (string | number)[]) => body<string[]>(client.get('/favorites/check', { params: { type, ids: ids.join(',') } })),
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
  organizationPrograms: () => body<OrganizationProgram[]>(client.get('/organizations/programs')),
  organizationAnalytics: () => body<OrganizationAnalytics>(client.get('/organizations/analytics')),
  createOrganizationProgram: (input: Record<string, unknown>) => body<OrganizationProgram>(client.post('/organizations/programs', input)),
  updateOrganizationProgram: (id: number, input: Record<string, unknown>) => body<OrganizationProgram>(client.patch(`/organizations/programs/${id}`, input)),
  deleteOrganizationProgram: (id: number) => body<void>(client.delete(`/organizations/programs/${id}`)),
  publishedPrograms: () => body<OrganizationProgram[]>(client.get('/programs')),
  program: (id: number | string) => body<OrganizationProgram>(client.get(`/programs/${id}`)),
  addProgramImages: (id: number, images: File[]) => { const form = new FormData(); images.forEach((image) => form.append('images', image)); return body<GalleryItem[]>(client.post(`/organizations/programs/${id}/images`, form)); },
  removeProgramImage: (id: number, imageId: number) => body<void>(client.delete(`/organizations/programs/${id}/images/${imageId}`)),
  setProgramCover: (id: number, imageId: number) => body<OrganizationProgram>(client.patch(`/organizations/programs/${id}/cover`, { imageId })),
  applyProgram: (id: number, targetTripId: number, startDay = 1, startTime?: string, endTime?: string) => body<any[]>(client.post(`/programs/${id}/apply`, { targetTripId, startDay, startTime, endTime })),
};
