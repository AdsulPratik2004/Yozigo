import { useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBooking, cancelBooking } from "../lib/api";
import Button from "../components/Button";
import ConfirmModal from "../components/ConfirmModal";

interface PassedConfirmation {
  id: number;
  movie: string;
  date: string;
  time: string;
  seats: string[];
  amount: number;
}

function formatDate(isoOrDateString?: string | null): string {
  if (!isoOrDateString) return "";
  try {
    const dt = new Date(isoOrDateString);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    return isoOrDateString;
  } catch {
    return isoOrDateString;
  }
}

function formatTime(isoOrTimeString?: string | null): string {
  if (!isoOrTimeString) return "";
  try {
    const dt = new Date(isoOrTimeString);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
    return isoOrTimeString;
  } catch {
    return isoOrTimeString;
  }
}

export default function BookingConfirmation() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const passedData = (location.state as { confirmation?: PassedConfirmation } | null)?.confirmation;

  const {
    data: fetchedBooking,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["booking", id],
    queryFn: () => fetchBooking(Number(id)),
    enabled: !!id && !passedData,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      alert("Booking cancelled successfully. Your seats have been released.");
      window.location.href = "/my-bookings";
    },
    onError: (err: Error) => {
      alert(`Failed to cancel booking: ${err.message}`);
    },
  });

  if (isLoading && !passedData) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="h-80 animate-pulse rounded-2xl border border-line bg-white" />
      </div>
    );
  }

  // Derive consolidated fields from either passedData or fetchedBooking
  const bookingId = passedData?.id || fetchedBooking?.id || id;
  const movieTitle = passedData?.movie || fetchedBooking?.movie_title || "Cinema Movie";
  const amount = passedData?.amount ?? fetchedBooking?.amount ?? fetchedBooking?.total_price ?? 0;
  const isUpcoming = fetchedBooking?.status === "upcoming";

  // Normalized date and time
  const showDate = passedData?.date || formatDate(fetchedBooking?.show_start || fetchedBooking?.show_time);
  const showTime = passedData?.time || formatTime(fetchedBooking?.show_start || fetchedBooking?.show_time);

  // Normalize seat labels array: ["A1", "A2"]
  const seatsList: string[] = passedData?.seats
    ? passedData.seats
    : fetchedBooking?.seats
    ? fetchedBooking.seats.map((s) => (typeof s === "string" ? s : `${s.row}${s.number}`))
    : [];

  if (isError && !passedData) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="rounded-2xl border border-line bg-white p-8">
          <div className="mb-4 text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900">Booking Not Found</h2>
          <p className="mt-2 text-xs text-muted">
            Could not retrieve booking details. Please visit your profile.
          </p>
          <div className="mt-6">
            <Link to="/my-bookings">
              <Button variant="primary" size="sm">
                Go to My Bookings
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-full max-w-lg">
        {/* Ticket Card */}
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
          {/* Top highlight bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-accent via-rose-400 to-accent" />

          <div className="p-6 sm:p-8">
            {/* Success icon & title */}
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-3xl border border-success/30">
                🎉
              </div>
              <h1 id="booking-success-title" className="text-2xl font-black text-gray-900 sm:text-3xl">
                Booking Confirmed!
              </h1>
              <p className="mt-1 text-sm text-muted">
                Your ticket has been booked successfully.
              </p>
            </div>

            {/* Ticket details summary */}
            <div className="rounded-xl border border-line bg-gray-50 p-5">
              {/* Booking ID badge */}
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                    Booking ID
                  </span>
                  <p className="font-mono text-base font-black text-accent">
                    #{bookingId}
                  </p>
                </div>
                <div className="rounded-md bg-success/15 px-3 py-1 text-xs font-bold text-success border border-success/30">
                  Confirmed
                </div>
              </div>

              {/* Movie & Show Info */}
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Movie
                  </span>
                  <p className="text-lg font-black text-gray-900">{movieTitle}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Date
                    </span>
                    <p className="font-semibold text-gray-900/90">{showDate}</p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Time
                    </span>
                    <p className="font-semibold text-gray-900/90">{showTime}</p>
                  </div>
                </div>

                {/* Seats */}
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Reserved Seats ({seatsList.length})
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {seatsList.map((seat) => (
                      <span
                        key={seat}
                        className="rounded-md border border-accent/40 bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent"
                      >
                        {seat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Amount Paid */}
                <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                  <span className="text-sm font-semibold text-muted">Total Amount Paid</span>
                  <span className="text-2xl font-black text-accent">
                    ₹{amount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {isUpcoming && (
            <Button
              variant="danger"
              onClick={() => setCancelModalOpen(true)}
              disabled={cancelMutation.isPending}
              className="w-full py-3"
            >
              Cancel Booking
            </Button>
          )}
          <Link to="/" className="flex-1">
            <Button variant="outline" className="w-full py-3">
              ← Browse Movies
            </Button>
          </Link>
          <Link to="/my-bookings" className="flex-1">
            <Button variant="primary" className="w-full py-3">
              View My Bookings →
            </Button>
          </Link>
        </div>

        {/* Cancel Confirmation Modal */}
        <ConfirmModal
          isOpen={cancelModalOpen}
          title="Cancel Booking"
          message={`Are you sure you want to cancel booking #${bookingId}? This will release your seats.`}
          movieTitle={movieTitle}
          seats={seatsList}
          confirmText="Yes, Cancel"
          cancelText="No, Keep Booking"
          onConfirm={() => {
            cancelMutation.mutate(Number(bookingId));
            setCancelModalOpen(false);
          }}
          onCancel={() => setCancelModalOpen(false)}
          isPending={cancelMutation.isPending}
        />
      </div>
    </div>
  );
}
