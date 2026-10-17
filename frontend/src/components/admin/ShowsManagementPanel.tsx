import { createPortal } from "react-dom";
import Button from "../Button";
import type { Movie } from "../../lib/types";

interface ShowsManagementPanelProps {
  movie: Movie;
  movieData: Movie | undefined;
  isLoading: boolean;
  showDate: string;
  showTime: string;
  showPrice: number;
  showFormError: string | null;
  showDeleteError: string | null;
  isCreatePending: boolean;
  isDeletePending: boolean;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onPriceChange: (price: number) => void;
  onAddShow: (e: React.FormEvent) => void;
  onDeleteShow: (showId: number) => void;
  onClose: () => void;
}

function formatShowDateTime(isoString: string): string {
  try {
    const dt = new Date(isoString);
    return dt.toLocaleString("en-IN", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

export default function ShowsManagementPanel({
  movie,
  movieData,
  isLoading,
  showDate,
  showTime,
  showPrice,
  showFormError,
  showDeleteError,
  isCreatePending,
  isDeletePending,
  onDateChange,
  onTimeChange,
  onPriceChange,
  onAddShow,
  onDeleteShow,
  onClose,
}: ShowsManagementPanelProps) {
  // Extract flat list of shows from grouped shows
  const flatShows = (movieData?.shows || []).flatMap((g) =>
    g.showtimes.map((s) => ({
      ...s,
      date: g.date,
    }))
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
              Screening Schedule
            </span>
            <h3 className="mt-0.5 text-xl font-black text-gray-900">
              {movie.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-gray-900"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 1. Add Show Form */}
          <form onSubmit={onAddShow} className="rounded-xl border border-line bg-white p-5">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-900">
              Add Show Screening
            </h4>

            {/* Overlap Error Display */}
            {showFormError && (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-300"
              >
                <span className="text-base leading-none">⚠️</span>
                <div className="flex-1">
                  <p>{showFormError}</p>
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              {/* Date */}
              <div>
                <label className="block text-[11px] font-semibold text-muted">Date</label>
                <input
                  type="date"
                  required
                  value={showDate}
                  onChange={(e) => onDateChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-xs text-gray-900 focus:border-accent focus:outline-none"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-[11px] font-semibold text-muted">Start Time</label>
                <input
                  type="time"
                  required
                  value={showTime}
                  onChange={(e) => onTimeChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-xs text-gray-900 focus:border-accent focus:outline-none"
                />
              </div>

              {/* Price */}
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-muted">
                  Price per Seat (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={showPrice}
                  onChange={(e) => onPriceChange(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-xs text-gray-900 focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4">
              <Button
                variant="primary"
                type="submit"
                disabled={isCreatePending}
                className="w-full py-2.5 text-xs font-bold"
              >
                {isCreatePending ? "Scheduling..." : "+ Schedule Screening"}
              </Button>
            </div>
          </form>

          {/* 2. List of Shows */}
          <div>
            <h4 className="mb-3 text-xs font-black uppercase tracking-wider text-muted">
              Scheduled Shows ({flatShows.length})
            </h4>

            {/* Show Delete Error Display */}
            {showDeleteError && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/15 p-3 text-xs font-semibold text-red-300"
              >
                <span className="text-base leading-none">🚫</span>
                <div className="flex-1">
                  <p>{showDeleteError}</p>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="py-8 flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
              </div>
            ) : flatShows.length === 0 ? (
              <p className="rounded-xl border border-line bg-white p-4 text-center text-xs text-muted">
                No upcoming shows scheduled for this film.
              </p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                {flatShows.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-line bg-white p-3 text-xs transition hover:bg-white"
                  >
                    <div>
                      <p className="font-bold text-gray-900">
                        {formatShowDateTime(s.start_time)}
                      </p>
                      <p className="mt-0.5 text-muted">
                        ₹{s.price} · {s.available_seats} seats left
                      </p>
                    </div>

                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => onDeleteShow(s.id)}
                      disabled={isDeletePending}
                      className="px-2.5 py-1 text-[11px]"
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
