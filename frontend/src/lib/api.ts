import type {
  AuthResponse,
  Booking,
  HoldResponse,
  Movie,
  PayResponse,
  SeatStatus,
  Show,
} from "./types";

const BASE = (import.meta.env.VITE_API_URL as string) ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  detail?: string;

  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function token(): string | null {
  return localStorage.getItem("access_token");
}

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  const t = token();
  if (t) headers["Authorization"] = `Bearer ${t}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  
  if (res.status === 401) {
    const refreshTokenValue = localStorage.getItem("refresh_token");
    
    if (!refreshTokenValue) {
      throw new ApiError(401, "No refresh token available");
    }

    if (isRefreshing) {
      // Wait for the refresh to complete
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((newToken: string) => {
          headers["Authorization"] = `Bearer ${newToken}`;
          fetch(`${BASE}${path}`, { ...init, headers })
            .then((retryRes) => {
              if (!retryRes.ok) {
                return retryRes.json().then((err) => {
                  const detail = (err as { detail?: string }).detail;
                  reject(new ApiError(retryRes.status, detail ?? "Request failed", detail));
                });
              }
              if (retryRes.status === 204) {
                resolve(undefined as unknown as T);
              } else {
                resolve(retryRes.json() as Promise<T>);
              }
            })
            .catch(reject);
        });
      });
    }

    isRefreshing = true;
    try {
      const refreshRes = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshTokenValue }),
      });

      if (!refreshRes.ok) {
        // Refresh failed, clear tokens and throw error
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        throw new ApiError(401, "Invalid or expired refresh token");
      }

      const refreshData = await refreshRes.json();
      const newAccessToken = refreshData.access_token;
      const newRefreshToken = refreshData.refresh_token;

      // Update localStorage
      localStorage.setItem("access_token", newAccessToken);
      localStorage.setItem("refresh_token", newRefreshToken);

      // Notify AuthContext of token refresh
      window.dispatchEvent(new CustomEvent('tokenRefreshed', {
        detail: { access_token: newAccessToken, refresh_token: newRefreshToken }
      }));

      // Notify waiting requests
      onTokenRefreshed(newAccessToken);

      // Retry original request with new token
      headers["Authorization"] = `Bearer ${newAccessToken}`;
      const retryRes = await fetch(`${BASE}${path}`, { ...init, headers });
      
      if (!retryRes.ok) {
        const err = await retryRes.json().catch(() => ({ detail: retryRes.statusText }));
        const detail = (err as { detail?: string }).detail;
        throw new ApiError(retryRes.status, detail ?? "Request failed", detail);
      }

      if (retryRes.status === 204) {
        return undefined as unknown as T;
      }

      return retryRes.json() as Promise<T>;
    } finally {
      isRefreshing = false;
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = (err as { detail?: string }).detail;
    throw new ApiError(res.status, detail ?? "Request failed", detail);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return res.json() as Promise<T>;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const registerUser = (email: string, password: string, name: string) =>
  request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });

export const loginUser = (email: string, password: string) =>
  request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const refreshToken = (refreshToken: string) =>
  request<AuthResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

export const resendConfirmation = (email: string) =>
  request<{ message: string }>("/auth/resend-confirmation", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

// ── Movies ────────────────────────────────────────────────────────────────────
export const fetchMovies = () => request<Movie[]>("/movies");
export const fetchMovie = (id: number) => request<Movie>(`/movies/${id}`);

export const createMovie = (data: {
  title: string;
  description?: string;
  poster_url?: string | null;
  duration_minutes: number;
  genre?: string;
  rating?: number | null;
}) =>
  request<Movie>("/movies", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateMovie = (
  id: number,
  data: Partial<{
    title: string;
    description?: string;
    poster_url?: string | null;
    duration_minutes: number;
    genre?: string;
    rating?: number | null;
  }>
) =>
  request<Movie>(`/movies/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteMovie = (id: number) =>
  request<void>(`/movies/${id}`, {
    method: "DELETE",
  });

// ── Shows ─────────────────────────────────────────────────────────────────────
export const fetchShow = (id: number) => request<Show>(`/shows/${id}`);

export const createShow = (data: {
  movie_id: number;
  start_time: string;
  price: number;
}) =>
  request<Show>("/shows", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteShow = (id: number) =>
  request<void>(`/shows/${id}`, {
    method: "DELETE",
  });

export const fetchShowSeats = (showId: number) =>
  request<SeatStatus[]>(`/shows/${showId}/seats`);

// ── Holds & Payment ──────────────────────────────────────────────────────────
export const holdSeats = (showId: number, seats: string[]) =>
  request<HoldResponse>(`/shows/${showId}/hold`, {
    method: "POST",
    body: JSON.stringify({ seats }),
  });

export const paySeats = (
  showId: number,
  result: "success" | "failure" = "success"
) =>
  request<PayResponse>(`/shows/${showId}/pay`, {
    method: "POST",
    body: JSON.stringify({ result }),
  });

// ── Bookings ──────────────────────────────────────────────────────────────────
export const createBooking = (show_id: number, seat_ids: number[]) =>
  request<Booking>("/bookings", {
    method: "POST",
    body: JSON.stringify({ show_id, seat_ids }),
  });

export const fetchMyBookings = () => request<Booking[]>("/bookings");

export const fetchBooking = (id: number) => request<Booking>(`/bookings/${id}`);

export const cancelBooking = (id: number) =>
  request<void>(`/bookings/${id}`, {
    method: "DELETE",
  });
