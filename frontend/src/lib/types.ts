export interface User {
  id: number;
  email: string;
  name: string;
  role: "customer" | "admin";
  is_verified?: boolean;
}

export interface Movie {
  id: number;
  title: string;
  description: string;
  poster_url: string | null;
  duration_minutes: number;
  genre: string;
  rating: string | number | null;
  language?: string;
  shows?: ShowDateGroup[];
  booking_count?: number;
}

export interface Showtime {
  id: number;
  start_time: string;
  price: number;
  available_seats: number;
}

export interface ShowDateGroup {
  date: string;
  showtimes: Showtime[];
}

export interface Show {
  id: number;
  movie_id?: number;
  start_time: string;
  show_time: string;
  price: number;
  movie?: MovieMeta;
  seats?: Seat[];
}

export interface MovieMeta {
  id: number;
  title: string;
  duration_minutes: number;
  genre: string;
  rating: number | null;
  poster_url: string | null;
  language?: string;
}

export interface Seat {
  id: number;
  row: string;
  number: number;
  is_booked: boolean;
}

export interface SeatStatus {
  seat: string;
  status: "available" | "held" | "booked";
  mine: boolean;
  held_until?: string | null;
}

export interface HoldResponse {
  status: string;
  seats: string[];
  held_until: string;
}

export interface PayResponse {
  id: number;
  movie: string;
  date: string;
  time: string;
  seats: string[];
  amount: number;
}

export interface Booking {
  id: number;
  show_id?: number;
  total_price?: number;
  amount?: number;
  created_at?: string;
  movie_title?: string | null;
  poster_url?: string | null;
  show_start?: string | null;
  show_time?: string | null;
  seats: { row: string; number: number }[];
  status?: "upcoming" | "past";
}

export interface AuthResponse {
  token?: string;
  access_token?: string;
  refresh_token?: string;
  user?: User;
  confirmation_required?: boolean;
  message?: string;
  email?: string;
}
