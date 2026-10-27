export type Role = 'owner' | 'editor' | 'viewer';

export interface Interest { id: number; name: string }
export interface User { id: number; homeAirportCode?: string | null; firstName: string; lastName: string; email?: string; avatar?: { url: string }; avatarUrl?: string | null; role?: string; isActive?: boolean; organizationName?: string; organizationLocationName?: string | null; organizationLatitude?: number | null; organizationLongitude?: number | null; aboutMe?: string | null; interests?: Interest[]; tripCount?: number; savedCount?: number; sharedTripCount?: number }
export interface User { organizationDescription?: string | null }
export interface Activity { id: number; name: string; description?: string; kind: 'activity' | 'plan'; dayNumber: number; startTime: string; endTime: string; placeName?: string; placeId?: string | null; placeLatitude?: number | null; placeLongitude?: number | null; transportation?: 'walk' | 'public_transport' | 'drive'; expense: number; meetingPointText?: string; meetingLatitude?: number | null; meetingLongitude?: number | null }
export interface Trip { id: number; name: string; startDate: string; endDate: string; travelersCount: number; budgetPerPerson?: number; totalBudget?: number; totalExpenses?: number; totalExpensesPerPerson?: number; actualSpentPerPerson?: number; hotelName?: string; hotelAddress?: string | null; hotelPlaceId?: string | null; hotelLatitude?: number | null; hotelLongitude?: number | null; city?: string | null; cityLatitude?: number | null; cityLongitude?: number | null; cityPlaceId?: string | null; country?: string | null; durationDays: number; role?: Role; myRole?: Role | null; visibility?: 'private' | 'link' | 'public'; coverUrl?: string; story?: string; storyExcerpt?: string; owner?: User; coverMediaId?: number | null; gallery?: GalleryItem[]; tips?: string[]; activities?: Activity[]; isFavorite?: boolean }
/** A trip photo or video (Media row with type=trip). */
export interface GalleryItem { id: number; url: string; mimeType?: string; originalName?: string; size?: number; ownerId?: number; position?: number | null }
export interface Envelope<T> { status_code: number; response_title: string; response_body: T; response_error: string | null }
export interface AuthResult { accessToken: string; refreshToken: string; user: User }
export type OrganizationProgramType = 'activity' | 'trip';
export type ProgramDifficulty = 'easy' | 'moderate' | 'challenging';
export interface ProgramStop { name?: string; description?: string | null; dayNumber?: number; startTime?: string; endTime?: string; placeName?: string | null; expense?: number }
export interface OrganizationProgram { id: number; organizationId: number; programType: OrganizationProgramType; title: string; description?: string | null; destination?: string | null; durationDays: number; content: Record<string, unknown> | Record<string, unknown>[]; isPublished: boolean; useCount: number; organization?: User; images?: GalleryItem[]; category?: string | null; price?: number | null; currency?: string | null; difficulty?: ProgramDifficulty | null; maxGroupSize?: number | null; languages?: string[] | null; highlights?: string[] | null; included?: string[] | null; excluded?: string[] | null; whatToBring?: string[] | null; meetingPoint?: string | null; cancellationPolicy?: string | null; bookingUrl?: string | null; coverImageId?: number | null; createdAt?: string; updatedAt?: string; moreFromOrganization?: OrganizationProgram[] }
export interface OrganizationAnalytics { totalPrograms: number; publishedPrograms: number; activityPrograms: number; tripPrograms: number; totalUses: number; mostUsedPrograms: OrganizationProgram[] }
export interface AppNotification { id: number; title: string; body: string; type: string; data?: Record<string, string> | null; readAt?: string | null; createdAt: string }
export interface TripMessage { id: number; tripId: number; authorId: number | null; content: string; sharedTripId?: number | null; sharedTrip?: Pick<Trip, 'id' | 'name' | 'city' | 'startDate' | 'endDate' | 'coverUrl'> | null; sharedActivityId?: number | null; sharedActivity?: Pick<Activity, 'id' | 'name' | 'kind' | 'dayNumber' | 'startTime' | 'endTime' | 'placeName' | 'expense'> | null; sharedIdeaId?: number | null; sharedIdea?: Pick<Activity, 'id' | 'name' | 'dayNumber' | 'startTime' | 'endTime' | 'placeName'> & { status: 'open' | 'accepted' | 'rejected' }; createdAt: string; author?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'> | null }

// ── Google Places (through the backend; the API key never reaches the browser) ──
export interface CitySuggestion { placeId: string; name: string; description: string | null; fullText: string }
export interface Hotel { placeId: string; name: string; address: string | null; latitude: number | null; longitude: number | null; rating: number | null; userRatingCount: number | null; priceLevel: number | null; photoUrl: string | null; websiteUri: string | null; googleMapsUri: string | null; phone: string | null }
// ── Day route (GET /trips/:id/route) ──
export interface RouteStop { index: number; kind: 'activity' | 'hotel'; activityId: number | null; name: string; place: string | null; startTime: string | null; endTime: string | null; latitude: number; longitude: number; /** client-side fallback only */ transportation?: Activity['transportation'] }
export interface RouteLeg { from: number; to: number; mode: NonNullable<Activity['transportation']>; status: 'ok' | 'no_route' | 'failed'; distanceMeters: number | null; durationSeconds: number | null; polyline: string | null; transit: string | null; gapMinutes: number | null; late: boolean }
export interface DayRoute { day: number; date: string; includeHotel: boolean; stops: RouteStop[]; legs: RouteLeg[]; missing: { id: number; name: string; startTime: string }[]; totalDistanceMeters: number; totalDurationSeconds: number; routingAvailable: boolean; warnings: string[] }

// ── Booking (flights & eSIMs via the backend) ──
export interface PlacePhoto { url: string; attribution: string | null; attributionUrl: string | null }
export interface FlightPlace { code: string; type: 'city' | 'airport'; name: string; cityCode: string | null; cityName: string | null; countryCode: string | null; countryName: string | null; airportName: string | null; latitude: number | null; longitude: number | null }
export interface FlightOffer { price: number; currency: string; airline: { code: string; name: string; logoUrl: string } | null; flightNumber: string | null; departureAt: string; returnAt: string | null; departureDate: string; returnDate: string | null; originAirport: string | null; destinationAirport: string | null; stops: number; returnStops: number | null; durationMinutes: number | null; returnDurationMinutes: number | null; bookingUrl: string; ctaLabel: string }
export interface FlightPrices { provider: { name: string; logoUrl: string }; route: { origin: FlightPlace | null; destination: FlightPlace | null; originCode: string; destinationCode: string; departDate: string; returnDate: string | null; adults: number }; destinationPhotos: PlacePhoto[]; currency: string; pricesAvailable: boolean; message: string | null; datesMatched: 'exact' | 'month'; offers: FlightOffer[]; searchUrl: string }
export interface Country { code: string; name: string; flagEmoji: string; flagUrl: string }
export interface EsimPlan { id: number | null; provider: string; providerLogo: string | null; network: string | null; title: string; dataMb: number | null; isUnlimited: boolean; dataLabel: string | null; validityDays: number; price: number; currency: string; url: string; notes: string | null; source: 'airalo_api' | 'manual'; checkedAt: string }
export interface EsimList { country: Country | null; photos: PlacePhoto[]; plans: EsimPlan[]; plansSource: 'airalo_api' | 'manual' | 'none'; message: string | null; items: { provider: string; providerLogo: string; title: string; description: string; highlights: string[]; ctaLabel: string; url: string }[] }
export interface Traveller { userId: number; firstName: string; lastName: string; avatarUrl: string | null; isMe: boolean; homeAirportCode: string | null }
export interface TravellerFlights { origin: FlightPlace | null; originCode: string; travellers: Traveller[]; pricesAvailable: boolean; message: string | null; datesMatched: 'exact' | 'month'; offers: FlightOffer[]; searchUrl: string }
export interface TripFlights { destination: FlightPlace | null; departDate: string; returnDate: string; currency: string; groups: TravellerFlights[]; withoutAirport: Traveller[]; atDestination: Traveller[] }
/** Google place card (GET /places/details/:placeId). */
export interface PlaceDetails { placeId: string; name: string; category: string | null; summary: string | null; address: string | null; latitude: number | null; longitude: number | null; rating: number | null; userRatingCount: number | null; priceLevel: number | null; phone: string | null; websiteUri: string | null; googleMapsUri: string | null; openNow: boolean | null; weeklyHours: string[]; hoursOnDate: string | null; photos: PlacePhoto[]; reviews: { author: string | null; rating: number | null; text: string | null; when: string | null }[]; amenities: string[] }
export interface TripBooking { tripId: number; tripName: string; destination: FlightPlace | null; departDate: string; returnDate: string; adults: number; country: Country | null; photos: PlacePhoto[]; esims: EsimList; myHomeAirport: FlightPlace | null }

/** A place for an activity, from GET /places/search (always has coordinates). */
export interface PlaceResult { placeId: string; name: string; address: string | null; category: string | null; latitude: number; longitude: number; rating: number | null; googleMapsUri: string | null }
export interface HotelPage { hotels: Hotel[]; nextPageToken: string | null }

// ── Legal ──
export type LegalKind = 'privacy-policy' | 'terms';
export interface LegalDocument { id: number; type: 'privacy_policy' | 'terms_of_use'; version: string; title: string; content: string; effectiveDate: string; isCurrent: boolean }
export interface LegalVersion { version: string; title: string; effectiveDate: string; isCurrent: boolean; createdAt: string }
export interface LegalAcceptance { currentVersion: string | null; acceptedVersion: string | null; acceptedAt: string | null; needsAcceptance: boolean }
export interface LegalStatus { terms: LegalAcceptance; privacy: LegalAcceptance; needsAcceptance: boolean }

// ── Favorites ──
export type FavoriteType = 'trip' | 'activity' | 'hotel' | 'place' | 'program';
/** trip/activity: targetId is our id; hotel/place: the Google placeId. available=false when deleted or no longer visible. */
export interface Favorite { id: number; type: FavoriteType; targetId: string; title: string; subtitle: string | null; imageUrl: string | null; available: boolean; tripId: number | null; mapsUrl: string | null; createdAt: string }
export type FavoriteCounts = Record<FavoriteType | 'all', number>;
export interface FavoritePage { items: Favorite[]; counts: FavoriteCounts; page: number; limit: number; total: number }

// ── Expenses ──
export type ExpenseCategory = 'hotel' | 'activity' | 'transport' | 'food' | 'shopping' | 'other';
export interface Expense { id: number; tripId: number; title: string; amount: number; currency: string | null; category: ExpenseCategory; date: string | null; notes: string | null; paidById: number | null; paidBy?: User | null; isHotelStay: boolean }
export interface ExpenseSummary { total: number; perPerson: number; travelersCount: number; activitiesTotal: number; expensesTotal: number; budgetTotal: number | null; remainingBudget: number | null; byCategory: { category: ExpenseCategory; total: number }[]; byPayer: { userId: number | null; name: string; total: number }[]; currencies: string[]; currency?: string; otherCurrencies?: { currency: string; total: number }[] }

/** The API sends `myRole`; older code used `role`. */
export const roleOf = (trip: Trip): Role | undefined => trip.myRole ?? trip.role;
export const canEdit = (trip: Trip) => roleOf(trip) === 'owner' || roleOf(trip) === 'editor';

export interface Paged<T> { items: T[]; meta: { page: number; limit: number; total: number; totalPages: number } }
export interface AdminOverview { users: number; travellers: number; agencies: number; admins: number; trips: number; publicTrips: number; disabledUsers?: number; newUsers30d?: number; newTrips30d?: number; linkTrips?: number }
export interface AdminEsimPlan { id: number; countryCode: string; provider: string; title: string; dataMb: number | null; isUnlimited: boolean; validityDays: number; price: number; currency: string; url: string; notes: string | null; isActive: boolean; createdAt?: string; updatedAt?: string }
export interface User { createdAt?: string }
export interface Trip { createdAt?: string }
export interface Trip { currency?: string }
