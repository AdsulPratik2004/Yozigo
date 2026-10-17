import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchShow, fetchShowSeats, holdSeats, paySeats, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import SeatMap from "../components/SeatMap";
import Spinner from "../components/Spinner";
import ErrorMessage from "../components/ErrorMessage";
import Button from "../components/Button";
import type { SeatStatus } from "../lib/types";

function formatShowTime(isoString?: string | null): string {
  if (!isoString) return "";
  try {
    const dt = new Date(isoString);
    return dt.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export default function ShowDetail() {
  const { id } = useParams<{ id: string }>();
  const showId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Local state
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [heldUntil, setHeldUntil] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);

  // Status alerts
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [holdExpiredMessage, setHoldExpiredMessage] = useState<string | null>(null);
  const [paymentFailedError, setPaymentFailedError] = useState<string | null>(null);

  // 1. Fetch Show details
  const {
    data: show,
    isLoading: isShowLoading,
    isError: isShowError,
  } = useQuery({
    queryKey: ["show", showId],
    queryFn: () => fetchShow(showId),
    enabled: !!showId,
  });

  // 2. Fetch live seats
  const {
    data: seatsData,
    isLoading: isSeatsLoading,
    isError: isSeatsError,
    error: seatsError,
    refetch: refetchSeats,
  } = useQuery({
    queryKey: ["show-seats", showId],
    queryFn: () => fetchShowSeats(showId),
    enabled: !!showId,
    refetchInterval: heldUntil ? 5000 : 15000,
  });

  // Convert seats array to map
  const seatMap = useMemo(() => {
    const map = new Map<string, SeatStatus>();
    if (!seatsData) return map;
    for (const s of seatsData) {
      map.set(s.seat, s);
    }
    return map;
  }, [seatsData]);

  // Sync own holds if already active on refresh
  useEffect(() => {
    if (!seatsData) return;
    const ownHeld = seatsData.filter((s) => s.status === "held" && s.mine && s.held_until);
    if (ownHeld.length > 0) {
      const activeLabels = ownHeld.map((s) => s.seat);
      setSelectedSeats((prev) => Array.from(new Set([...prev, ...activeLabels])));
      const earliestUntil = ownHeld.map((s) => s.held_until!).sort()[0];
      setHeldUntil(earliestUntil);
    }
  }, [seatsData]);

  // 10-minute hold countdown timer
  useEffect(() => {
    if (!heldUntil) {
      setSecondsRemaining(null);
      return;
    }

    const checkTimer = () => {
      const expiryTime = new Date(heldUntil).getTime();
      const now = Date.now();
      const diffSeconds = Math.max(0, Math.floor((expiryTime - now) / 1000));
      setSecondsRemaining(diffSeconds);

      if (diffSeconds <= 0) {
        setHeldUntil(null);
        setIsPaymentModalOpen(false);
        setPaymentFailedError(null);
        setHoldExpiredMessage("Your hold expired");
        setSelectedSeats([]);
        refetchSeats();
      }
    };

    checkTimer();
    const interval = setInterval(checkTimer, 1000);
    return () => clearInterval(interval);
  }, [heldUntil, refetchSeats]);

  // Toggle seat selection with Max 6 limit
  const handleToggleSeat = (label: string) => {
    if (heldUntil) {
      setHeldUntil(null);
      setSecondsRemaining(null);
      setIsPaymentModalOpen(false);
      setPaymentFailedError(null);
    }

    setWarningMessage(null);
    setErrorMessage(null);
    setHoldExpiredMessage(null);

    if (selectedSeats.includes(label)) {
      setSelectedSeats((prev) => prev.filter((s) => s !== label));
    } else {
      if (selectedSeats.length >= 6) {
        setWarningMessage("Maximum 6 seats can be selected per booking.");
        return;
      }
      setSelectedSeats((prev) => [...prev, label].sort());
    }
  };

  // Continue button -> POST /shows/:id/hold
  const handleContinue = async () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }

    if (selectedSeats.length === 0) return;

    setIsHolding(true);
    setErrorMessage(null);
    setWarningMessage(null);
    setHoldExpiredMessage(null);

    try {
      const result = await holdSeats(showId, selectedSeats);
      setHeldUntil(result.held_until);
      setHoldExpiredMessage(null);
      refetchSeats();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (
        apiErr.status === 409 ||
        apiErr.message?.includes("already taken") ||
        apiErr.message?.includes("conflict")
      ) {
        const takenMsg = apiErr.detail || apiErr.message || "One or more seats were already taken.";
        setErrorMessage(`${takenMsg}. Please choose another seat.`);
        const fresh = await refetchSeats();
        if (fresh.data) {
          const freshMap = new Map(fresh.data.map((s) => [s.seat, s]));
          setSelectedSeats((prev) =>
            prev.filter((s) => freshMap.get(s)?.status === "available" || freshMap.get(s)?.mine)
          );
        }
      } else {
        setErrorMessage(apiErr.message || "Failed to hold seats. Please try again.");
      }
    } finally {
      setIsHolding(false);
    }
  };

  // Process payment modal action ("success" | "failure")
  const handleProcessPayment = async (result: "success" | "failure") => {
    setIsPaying(true);
    setPaymentFailedError(null);
    setErrorMessage(null);

    try {
      const res = await paySeats(showId, result);

      if (result === "success") {
        navigate(`/bookings/${res.id}`, {
          state: {
            confirmation: {
              id: res.id,
              movie: res.movie,
              date: res.date,
              time: res.time,
              seats: res.seats,
              amount: res.amount,
            },
          },
        });
      } else {
        setIsPaymentModalOpen(false);
        setPaymentFailedError("Payment failed");
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.status === 410 || apiErr.message?.toLowerCase().includes("expired")) {
        setIsPaymentModalOpen(false);
        setHeldUntil(null);
        setPaymentFailedError(null);
        setHoldExpiredMessage("Your hold expired");
        setSelectedSeats([]);
        refetchSeats();
      } else {
        setIsPaymentModalOpen(false);
        setPaymentFailedError("Payment failed");
      }
    } finally {
      setIsPaying(false);
    }
  };

  const handleTryAgain = () => {
    if (!heldUntil || (secondsRemaining !== null && secondsRemaining <= 0)) {
      setPaymentFailedError(null);
      setHoldExpiredMessage("Your hold expired");
      setSelectedSeats([]);
      refetchSeats();
      return;
    }
    setPaymentFailedError(null);
    setIsPaymentModalOpen(true);
  };

  if (isShowLoading) {
    return <Spinner size="lg" className="py-24" />;
  }

  if (isShowError || !show) {
    return (
      <div className="py-12">
        <ErrorMessage
          message="The requested screening does not exist or has already finished."
          onRetry={() => navigate("/")}
        />
        <div className="text-center mt-6">
          <Link to="/">
            <Button variant="outline" size="sm">
              ← Browse Movies
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const pricePerSeat = show.price || 0;
  const totalPrice = selectedSeats.length * pricePerSeat;
  const isHeldActive = Boolean(heldUntil && secondsRemaining !== null && secondsRemaining > 0);

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to={`/movies/${show.movie?.id || show.movie_id}`}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-line/80 hover:text-gray-900"
        >
          <span>←</span>
          <span>{show.movie?.title || "Back to Movie"}</span>
        </Link>

        <span className="text-xs font-medium text-gray-500">
          Screen 1 · Hall Capacity 80
        </span>
      </div>

      {/* Show Title & Overview */}
      <section className="rounded-2xl border border-line bg-white p-6 shadow-xl sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-accent">
              Seat Selection
            </span>
            <h1 className="mt-1 text-2xl font-black text-gray-900 sm:text-3xl">
              {show.movie?.title}
            </h1>
            <p className="mt-1 text-xs text-gray-600 sm:text-sm">
              {formatShowTime(show.start_time || show.show_time)}
              {show.movie?.genre && ` · ${show.movie.genre}`}
            </p>
          </div>

          <div className="rounded-xl border border-line bg-white px-5 py-3 text-right">
            <span className="block text-[11px] font-semibold text-gray-500 uppercase">
              Ticket Price
            </span>
            <span className="text-2xl font-black text-accent">
              ₹{pricePerSeat}
            </span>
            <span className="block text-[10px] text-gray-500">per seat</span>
          </div>
        </div>
      </section>

      {/* Authentication Prompt */}
      {!isAuthenticated && (
        <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-accent/30 bg-accent/10 p-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-3 text-sm text-gray-900">
            <span className="text-xl">🔒</span>
            <span>You must be signed in to reserve and book seats.</span>
          </div>
          <Link to="/login" state={{ from: location }}>
            <Button variant="primary" size="sm">
              Sign in to Book
            </Button>
          </Link>
        </div>
      )}

      {/* Warning Notice: Max 6 seats limit */}
      {warningMessage && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl border border-warning/30 bg-warning/10 px-5 py-3 text-sm font-semibold text-warning"
        >
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{warningMessage}</span>
          </div>
          <button
            onClick={() => setWarningMessage(null)}
            className="text-xs text-warning/70 hover:text-gray-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Message: 409 Conflict / Seat already taken */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-400"
        >
          <div className="flex items-center gap-2">
            <span>❌</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs text-red-400/70 hover:text-gray-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hold Expired Notice */}
      {holdExpiredMessage && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl border border-warning/30 bg-warning/10 px-5 py-3 text-sm font-semibold text-warning"
        >
          <div className="flex items-center gap-2">
            <span>⏱️</span>
            <span>{holdExpiredMessage}</span>
          </div>
          <button
            onClick={() => setHoldExpiredMessage(null)}
            className="text-xs text-warning/70 hover:text-gray-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* Payment Failed Banner */}
      {paymentFailedError && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-400"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold">{paymentFailedError}</p>
              {isHeldActive && (
                <p className="text-xs text-red-300/80">
                  Your seat hold is still active for {formatTimer(secondsRemaining!)}.
                </p>
              )}
            </div>
          </div>
          {isHeldActive && (
            <Button variant="danger" size="sm" onClick={handleTryAgain}>
              Try Again
            </Button>
          )}
        </div>
      )}

      {/* Active Hold Countdown Banner */}
      {isHeldActive && (
        <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-success/30 bg-success/10 p-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/20 text-xl text-success">
              ⏱️
            </span>
            <div>
              <p className="text-sm font-bold text-success">
                Seats Held for You
              </p>
              <p className="text-xs text-gray-600">
                Click Pay below to complete your booking before the timer runs out.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Hold timer:
            </span>
            <div className="rounded-xl border border-success/40 bg-white px-4 py-2 font-mono text-xl font-black text-success">
              {formatTimer(secondsRemaining!)}
            </div>
          </div>
        </div>
      )}

      {/* Seat Map Container */}
      <section className="relative overflow-hidden rounded-2xl border border-line bg-white p-4 sm:p-8 shadow-xl">
        {isSeatsLoading ? (
          <Spinner size="lg" className="py-20" />
        ) : isSeatsError ? (
          <div className="p-8 text-center">
            <p className="text-red-400 font-semibold">Failed to load seat availability</p>
            <p className="mt-1 text-xs text-gray-500">{(seatsError as Error)?.message}</p>
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={() => refetchSeats()}>
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <SeatMap
            seatMap={seatMap}
            selectedSeats={selectedSeats}
            onToggleSeat={handleToggleSeat}
            isHoldLocked={isHolding || isPaying}
          />
        )}
      </section>

      {/* Bottom Booking Summary Bar */}
      <aside className="sticky bottom-4 rounded-2xl border border-line bg-white/95 p-4 sm:p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Selected seats list & info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Selected Seats:
              </span>
              <span className="text-xs font-semibold text-accent">
                ({selectedSeats.length} / 6 max)
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {selectedSeats.length === 0 ? (
                <span className="text-sm italic text-gray-500">
                  Click on available seats above (up to 6)
                </span>
              ) : (
                selectedSeats.map((seat) => (
                  <span
                    key={seat}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent"
                  >
                    {seat}
                    {!isHeldActive && (
                      <button
                        type="button"
                        onClick={() => handleToggleSeat(seat)}
                        className="text-[10px] text-accent hover:text-gray-900"
                        title="Remove seat"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Pricing & Call to Actions */}
          <div className="flex flex-shrink-0 items-center justify-between gap-6 border-t border-line pt-3 sm:border-t-0 sm:pt-0">
            {/* Total Price */}
            <div className="text-left sm:text-right">
              <span className="block text-[11px] font-medium text-gray-500 uppercase">
                Total Price
              </span>
              <span className="text-2xl font-black text-accent">
                ₹{totalPrice}
              </span>
              {selectedSeats.length > 0 && (
                <span className="block text-[10px] text-gray-500">
                  ₹{pricePerSeat} × {selectedSeats.length}
                </span>
              )}
            </div>

            {/* Actions: "Continue" before hold, or "Pay" after hold */}
            <div>
              {!isHeldActive ? (
                <Button
                  variant="primary"
                  id="btn-continue-hold"
                  disabled={selectedSeats.length === 0 || isHolding}
                  onClick={handleContinue}
                  className="px-8 py-3 text-sm font-bold"
                >
                  {isHolding
                    ? "Holding seats..."
                    : !isAuthenticated
                    ? "Sign in to Continue"
                    : "Continue"}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    id="btn-cancel-hold"
                    disabled={isPaying}
                    onClick={() => {
                      setHeldUntil(null);
                      setSecondsRemaining(null);
                      setSelectedSeats([]);
                      refetchSeats();
                    }}
                    className="text-xs"
                  >
                    Release
                  </Button>
                  <Button
                    variant="primary"
                    id="btn-open-pay-modal"
                    disabled={isPaying}
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="px-8 py-3 text-sm font-bold"
                  >
                    Pay
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-6 py-5">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">💳</span>
                <h3 className="text-lg font-black text-gray-900">Payment Simulation</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900">
                  ✕
                </span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="rounded-xl border border-line bg-white p-4 text-xs">
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Movie:</span>
                  <span className="font-bold text-gray-900">{show.movie?.title}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Showtime:</span>
                  <span className="font-medium text-gray-900">
                    {formatShowTime(show.start_time || show.show_time)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Seats:</span>
                  <span className="font-black text-accent">
                    {selectedSeats.join(", ")}
                  </span>
                </div>
                <div className="flex justify-between border-t border-line pt-2 text-sm">
                  <span className="font-bold text-gray-500">Total Amount:</span>
                  <span className="font-black text-accent">₹{totalPrice}</span>
                </div>
              </div>

              {/* Countdown inside modal */}
              {secondsRemaining !== null && (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-success/10 py-2 text-xs font-semibold text-success">
                  <span>⏱️</span>
                  <span>Hold expires in {formatTimer(secondsRemaining)}</span>
                </div>
              )}

              <p className="mt-5 text-center text-xs text-gray-500">
                Choose a payment result to complete or test the reservation:
              </p>

              {/* Action Buttons */}
              <div className="mt-5 flex flex-col gap-3">
                <Button
                  variant="primary"
                  id="btn-pay-success"
                  disabled={isPaying}
                  onClick={() => handleProcessPayment("success")}
                  className="w-full py-3"
                >
                  {isPaying ? "Processing..." : "Payment success"}
                </Button>

                <Button
                  variant="danger"
                  id="btn-pay-failure"
                  disabled={isPaying}
                  onClick={() => handleProcessPayment("failure")}
                  className="w-full py-3"
                >
                  Simulate failure
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}