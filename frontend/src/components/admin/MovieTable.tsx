import Button from "../Button";
import type { Movie } from "../../lib/types";

interface MovieTableProps {
  movies: Movie[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  selectedMovieId: number | null;
  onSelectMovie: (movie: Movie) => void;
  onEditMovie: (movie: Movie) => void;
  onDeleteMovie: (movie: Movie) => void;
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

export default function MovieTable({
  movies,
  isLoading,
  isError,
  error,
  selectedMovieId,
  onSelectMovie,
  onEditMovie,
  onDeleteMovie,
}: MovieTableProps) {
  return (
    <div className="w-full min-w-0 max-w-full box-border overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
      {/* Header Bar */}
      {}
      <div className="flex items-center justify-between border-b border-line px-3 sm:px-6 py-3 sm:py-4 min-w-0">
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-gray-900 truncate">Movie Catalog</h2>
          <p className="text-xs text-muted truncate">
            {movies?.length || 0} movie{movies?.length !== 1 ? "s" : ""} registered
          </p>
        </div>
      </div>

      {/* Loading, Error, or Empty States */}
      {}
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : isError ? (
        <div className="p-6 text-center text-xs text-red-400 break-words">
          Failed to load movies: {error?.message}
        </div>
      ) : !movies || movies.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted">
          No movies found. Click "Add New Movie" above to get started.
        </div>
      ) : (
        <>
          {}
          {/* Mobile Card Layout (Visible below 'lg' breakpoint) */}
          <div className="block lg:hidden space-y-3 p-2.5 sm:p-4 w-full min-w-0 max-w-full box-border overflow-hidden">
            {movies.map((m) => {
              const isSelected = selectedMovieId === m.id;
              return (
                <div
                  key={m.id}
                  className={`w-full min-w-0 max-w-full box-border rounded-xl border p-2.5 sm:p-3 transition overflow-hidden ${
                    isSelected ? "border-accent bg-accent/10" : "border-line bg-white"
                  }`}
                >
                  {/* Poster + Details Header */}
                  <div className="flex items-start gap-2.5 min-w-0 w-full">
                    {/* Compact Poster */}
                    <div className="flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100 border border-line text-xs">
                      {m.poster_url ? (
                        <img
                          src={m.poster_url}
                          alt={m.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        "🎬"
                      )}
                    </div>

                    {/* Metadata column */}
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="font-bold text-gray-900 truncate text-xs sm:text-sm leading-tight">
                        {m.title}
                      </p>
                      <p className="text-[11px] text-muted truncate mt-0.5">{m.genre}</p>
                      
                      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted leading-none">
                        <span>{m.language || "English"}</span>
                        <span>•</span>
                        <span>{formatDuration(m.duration_minutes)}</span>
                        {m.rating != null && (
                          <>
                            <span>•</span>
                            <span className="font-bold text-accent">
                              ⭐ {Number(m.rating).toFixed(1)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bookings Count Badge */}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent border border-accent/20">
                      🎫 {m.booking_count || 0} bookings
                    </span>
                  </div>

                  {}
                  {/* Slim, Full-Width Stacked Action Buttons */}
                  <div className="mt-2.5 flex flex-col gap-1.5 w-full min-w-0 box-border">
                    <Button
                      variant={isSelected ? "primary" : "outline"}
                      size="sm"
                      onClick={() => onSelectMovie(m)}
                      className="w-full text-[11px] py-1 px-2 h-auto min-w-0 min-h-0 justify-center leading-tight truncate"
                    >
                      {isSelected ? "Close" : "Shows"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditMovie(m)}
                      className="w-full text-[11px] py-1 px-2 h-auto min-w-0 min-h-0 justify-center leading-tight truncate"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => onDeleteMovie(m)}
                      className="w-full text-[11px] py-1 px-2 h-auto min-w-0 min-h-0 justify-center leading-tight truncate"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {}
          {/* Desktop Table Layout (Only rendered on 'lg' and up) */}
          <div className="hidden lg:block w-full min-w-0 overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[650px]">
              <thead className="border-b border-line bg-white/50 text-xs font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-6 py-3.5">Film</th>
                  <th className="px-4 py-3.5">Language</th>
                  <th className="px-4 py-3.5">Duration</th>
                  <th className="px-4 py-3.5">Rating</th>
                  <th className="px-4 py-3.5">Bookings</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {movies.map((m) => {
                  const isSelected = selectedMovieId === m.id;

                  return (
                    <tr
                      key={m.id}
                      className={`transition hover:bg-white/80 ${
                        isSelected ? "bg-accent/10" : ""
                      }`}
                    >
                      {/* Title & Poster Thumbnail */}
                      <td className="px-6 py-4 min-w-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white border border-line text-sm">
                            {m.poster_url ? (
                              <img
                                src={m.poster_url}
                                alt={m.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              "🎬"
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-gray-900">{m.title}</p>
                            <p className="truncate text-xs text-muted">{m.genre}</p>
                          </div>
                        </div>
                      </td>

                      {/* Language */}
                      <td className="px-4 py-4 text-xs font-semibold text-gray-900/90 whitespace-nowrap">
                        {m.language || "English"}
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-4 text-xs text-muted whitespace-nowrap">
                        {formatDuration(m.duration_minutes)}
                      </td>

                      {/* Rating */}
                      <td className="px-4 py-4 text-xs font-bold text-accent whitespace-nowrap">
                        {m.rating != null ? `⭐ ${Number(m.rating).toFixed(1)}` : "—"}
                      </td>

                      {/* Bookings */}
                      <td className="px-4 py-4 text-xs whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 font-semibold text-accent border border-accent/20">
                          🎫 {m.booking_count || 0}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant={isSelected ? "primary" : "outline"}
                            size="sm"
                            onClick={() => onSelectMovie(m)}
                            className="text-xs"
                          >
                            {isSelected ? "Close" : "Shows"}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEditMovie(m)}
                            className="text-xs"
                          >
                            Edit
                          </Button>

                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => onDeleteMovie(m)}
                            className="text-xs"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}