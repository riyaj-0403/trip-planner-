export type Category =  "transport" | "food" | "sightseeing" | "adventure" | "shopping" | "stay" | "other";
export type TripStyle = "leisure" | "adventurous" | "cultural" ;

export interface Trip {
  id: string;
  title: string;
  startDate: string;   // "2026-11-05" (ISO format)
  endDate: string;
  travellers: number;
  currency: string;    // "INR", "USD"
  totalBudget: number;
  createdAt: string;   // ISO format
  updatedAt: string;   // ISO format
}

export interface Destination {
  id: string;
  tripId: string;      // which trip this belongs to
  city: string;
  country: string;
  arrivalDate: string;
  departureDate: string;
  createdAt: string;   // ISO format
  updatedAt: string;   // ISO format
}

export interface Activity {
  id: string;
  destinationId: string; // which destination this belongs to
  title: string;
  category: Category;
  cost: number;
  date: string;         // "2026-11-05" (ISO format)
  startTime: string;    // "09:00" (24-hour format)
  endTime: string;      // "10:30" (24-hour format)
  order: number;        // position within the day (your addition)
  createdAt: string;   // ISO format
  updatedAt: string;   // ISO format 
}
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
}

export interface AuthResponse extends AuthUser {
  token: string;
  tokenType: string;
}