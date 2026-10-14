export type Role = 'owner' | 'editor' | 'viewer';

export interface User { id: number; firstName: string; lastName: string; email?: string; avatar?: { url: string }; role?: string; organizationName?: string }
export interface Activity { id: number; name: string; description?: string; kind: 'activity' | 'plan'; dayNumber: number; startTime: string; endTime: string; placeName?: string; transportation?: 'walk' | 'public_transport' | 'drive'; expense: number; meetingPointText?: string }
export interface Trip { id: number; name: string; startDate: string; endDate: string; travelersCount: number; budgetPerPerson?: number; totalBudget?: number; totalExpenses?: number; totalExpensesPerPerson?: number; actualSpentPerPerson?: number; hotelName?: string; hotelAddress?: string | null; hotelPlaceId?: string | null; city?: string | null; cityPlaceId?: string | null; country?: string | null; durationDays: number; role?: Role; myRole?: Role | null; visibility?: 'private' | 'link' | 'public'; coverUrl?: string; story?: string; storyExcerpt?: string; owner?: User; coverMediaId?: number | null; gallery?: GalleryItem[]; tips?: string[]; activities?: Activity[] }
/** A trip photo or video (Media row with type=trip). */
export interface GalleryItem { id: number; url: string; mimeType?: string; originalName?: string; size?: number; ownerId?: number; position?: number | null }
export interface Envelope<T> { status_code: number; response_title: string; response_body: T; response_error: string | null }
export interface AuthResult { accessToken: string; refreshToken: string; user: User }
export interface AppNotification { id: number; title: string; body: string; type: string; data?: Record<string, string> | null; readAt?: string | null; createdAt: string }

// ── Google Places (through the backend; the API key never reaches the browser) ──
export interface CitySuggestion { placeId: string; name: string; description: string | null; fullText: string }
export interface Hotel { placeId: string; name: string; address: string | null; latitude: number | null; longitude: number | null; rating: number | null; userRatingCount: number | null; priceLevel: number | null; photoUrl: string | null; websiteUri: string | null; googleMapsUri: string | null; phone: string | null }
export interface HotelPage { hotels: Hotel[]; nextPageToken: string | null }

// ── Expenses ──
export type ExpenseCategory = 'hotel' | 'activity' | 'transport' | 'food' | 'shopping' | 'other';
export interface Expense { id: number; tripId: number; title: string; amount: number; currency: string | null; category: ExpenseCategory; date: string | null; notes: string | null; paidById: number | null; paidBy?: User | null; isHotelStay: boolean }
export interface ExpenseSummary { total: number; perPerson: number; travelersCount: number; activitiesTotal: number; expensesTotal: number; budgetTotal: number | null; remainingBudget: number | null; byCategory: { category: ExpenseCategory; total: number }[]; byPayer: { userId: number | null; name: string; total: number }[]; currencies: string[] }

/** The API sends `myRole`; older code used `role`. */
export const roleOf = (trip: Trip): Role | undefined => trip.myRole ?? trip.role;
export const canEdit = (trip: Trip) => roleOf(trip) === 'owner' || roleOf(trip) === 'editor';
