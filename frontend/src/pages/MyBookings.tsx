import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchMyBookings, cancelBooking } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";
import Spinner from "../components/Spinner";
import ConfirmModal from "../components/ConfirmModal";
import type { Booking } from "../lib/types";

function formatDateTime(isoString?: string | null): string {
  if (!isoString) return "—";
  try {
    const dt = new Date(isoString);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
    return isoString;
  } catch {
    return isoString;
  }
}

export default function MyBookings() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<{ id: number; movieTitle: string; seats: string[] } | null>(null);

  const {
    data: bookings,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: fetchMyBookings,
    enabled: isAuthenticated,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: (err: Error) => {
      alert(`Failed to cancel booking: ${err.message}`);
    },
  });

  // Ensure upcoming bookings are sorted first
  const sortedBookings = useMemo(() => {
    if (!bookings) return [];
    return [...bookings].sort((a, b) => {
      const aUpcoming = a.status === "upcoming";
      const bUpcoming = b.status === "upcoming";
      if (aUpcoming && !bUpcoming) return -1;
      if (!aUpcoming && bUpcoming) return 1;

      const aTime = new Date(a.show_start || a.show_time || 0).getTime();
      const bTime = new Date(b.show_start || b.show_time || 0).getTime();
      if (aUpcoming && bUpcoming) return aTime - bTime;
      return bTime - aTime;
    });
  }, [bookings]);

  // Filter based on selected tab
  const filteredBookings = useMemo(() => {
    if (filter === "all") return sortedBookings;
    return sortedBookings.filter((b) => b.status === filter);
  }, [sortedBookings, filter]);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="rounded-2xl border border-line bg-card p-8">
          <div className="mb-4 text-4xl">🔒</div>
          <h2 className="text-xl font-bold text-gray-900">Sign In to View Bookings</h2>
          <p className="mt-2 text-xs text-muted">
            Please log in with your account to access your booked cinema tickets.
          </p>
          <div className="mt-6">
            <Button variant="primary" size="sm" onClick={() => navigate("/login")}>
              Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const upcomingCount = sortedBookings.filter((b) => b.status === "upcoming").length;
  const pastCount = sortedBookings.filter((b) => b.status === "past").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col justify-between gap-6 border-b border-line pb-6 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-xl font-black text-accent border border-accent/25">
              {user?.name ? user.name[0].toUpperCase() : "U"}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
                My Bookings
              </h1>
              <p className="text-xs text-muted">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex rounded-xl border border-line bg-white p-1 text-xs font-semibold">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-4 py-1.5 transition-all ${
              filter === "all"
                ? "bg-accent text-white shadow-sm shadow-accent/20 font-bold"
                : "text-muted hover:text-gray-900"
            }`}
          >
            All ({sortedBookings.length})
          </button>
          <button
            onClick={() => setFilter("upcoming")}
            className={`rounded-lg px-4 py-1.5 transition-all ${
              filter === "upcoming"
                ? "bg-accent text-white shadow-sm shadow-accent/20 font-bold"
                : "text-muted hover:text-gray-900"
            }`}
          >
            Upcoming ({upcomingCount})
          </button>
          <button
            onClick={() => setFilter("past")}
            className={`rounded-lg px-4 py-1.5 transition-all ${
              filter === "past"
                ? "bg-accent text-white shadow-sm shadow-accent/20 font-bold"
                : "text-muted hover:text-gray-900"
            }`}
          >
            Past ({pastCount})
          </button>
        </div>
      </section>

      {/* Loading State */}
      {isLoading && <Spinner size="lg" className="py-20" />}

      {/* Error State */}
      {isError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
          <div className="mb-3 text-4xl">⚠️</div>
          <h3 className="text-lg font-bold text-red-400">Failed to load bookings</h3>
          <p className="mt-1 text-xs text-muted">
            {(error as Error)?.message || "Could not retrieve your booking history."}
          </p>
          <div className="mt-5">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Empty States */}
      {!isLoading && !isError && sortedBookings.length === 0 && (
        <div className="rounded-2xl border border-line bg-white p-14 text-center">
          <div className="mb-4 text-5xl">🎟️</div>
          <h3 className="text-xl font-bold text-gray-900">No Bookings Yet</h3>
          <p className="mt-1 text-sm text-muted">
            You haven't reserved any cinema tickets yet. Explore movies and choose your seats!
          </p>
          <div className="mt-6">
            <Link to="/">
              <Button variant="primary" size="md">
                Browse Movies
              </Button>
            </Link>
          </div>
        </div>
      )}

      {!isLoading && !isError && sortedBookings.length > 0 && filteredBookings.length === 0 && (
        <div className="rounded-2xl border border-line bg-white p-12 text-center">
          <p className="text-sm font-semibold text-muted">
            No {filter} bookings found.
          </p>
        </div>
      )}

      {/* Bookings List: Upcoming first */}
      {!isLoading && !isError && filteredBookings.length > 0 && (
        <div className="space-y-4">
          {filteredBookings.map((b: Booking) => {
            const isUpcoming = b.status === "upcoming";
            const amount = b.amount ?? b.total_price ?? 0;
            const dateTime = b.show_start || b.show_time;

            return (
              <div
                key={b.id}
                id={`booking-card-${b.id}`}
                className={`relative overflow-hidden rounded-2xl border p-5 sm:p-6 transition-all duration-200 ${
                  isUpcoming
                    ? "border-accent/30 bg-white hover:border-accent/60 shadow-lg shadow-gray-200/40"
                    : "border-line bg-white/60 opacity-80 hover:opacity-100"
                }`}
              >
                {/* Left accent color bar for upcoming */}
                {isUpcoming && (
                  <div className="absolute inset-y-0 left-0 w-1 bg-accent" />
                )}

                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  {/* Movie & DateTime */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      {/* Status Badge */}
                      <span
                        className={`rounded-md px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          isUpcoming
                            ? "bg-success/15 text-success border border-success/30"
                            : "bg-gray-100 text-muted border border-line"
                        }`}
                      >
                        {isUpcoming ? "Upcoming" : "Past"}
                      </span>

                      {/* Booking ID */}
                      <span className="font-mono text-xs font-bold text-muted">
                        #{b.id}
                      </span>
                    </div>

                    {/* Movie Title */}
                    <h3 className="mt-2 text-lg font-black text-gray-900 sm:text-xl">
                      {b.movie_title || "Cinema Screening"}
                    </h3>

                    {/* Date / Time */}
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <span>📅</span>
                      <span className="font-medium text-gray-900/90">
                        {formatDateTime(dateTime)}
                      </span>
                    </div>

                    {/* Seats list */}
                    <div className="mt-4 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-muted">
                        Seats:
                      </span>
                      {b.seats.map((s, idx) => {
                        const label = typeof s === "string" ? s : `${s.row}${s.number}`;
                        return (
                          <span
                            key={idx}
                            className="rounded-md border border-accent/40 bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent"
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right side: Amount & View button */}
                  <div className="flex flex-row items-baseline justify-between border-t border-line pt-3 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                    <div>
                      <span className="block text-[10px] font-semibold uppercase text-muted text-left sm:text-right">
                        Paid Amount
                      </span>
                      <span className="text-xl font-black text-accent">
                        ₹{amount}
                      </span>
                    </div>

                    <div className="mt-3 flex gap-2">
                      {isUpcoming && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setBookingToCancel({
                              id: b.id,
                              movieTitle: b.movie_title || "Cinema Screening",
                              seats: b.seats.map((s) => typeof s === "string" ? s : `${s.row}${s.number}`),
                            });
                            setCancelModalOpen(true);
                          }}
                          disabled={cancelMutation.isPending}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                      )}
                      <Link to={`/bookings/${b.id}`}>
                        <Button variant="outline" size="sm" className="text-xs">
                          View Ticket →
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={cancelModalOpen}
        title="Cancel Booking"
        message={`Are you sure you want to cancel booking #${bookingToCancel?.id}? This will release your seats.`}
        movieTitle={bookingToCancel?.movieTitle}
        seats={bookingToCancel?.seats}
        confirmText="Yes, Cancel"
        cancelText="No, Keep Booking"
        onConfirm={() => {
          if (bookingToCancel) {
            cancelMutation.mutate(bookingToCancel.id);
          }
          setCancelModalOpen(false);
          setBookingToCancel(null);
        }}
        onCancel={() => {
          setCancelModalOpen(false);
          setBookingToCancel(null);
        }}
        isPending={cancelMutation.isPending}
      />
    </div>
  );
}
