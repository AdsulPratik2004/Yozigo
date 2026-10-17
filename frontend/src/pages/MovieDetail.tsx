import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchMovie } from "../lib/api";
import Spinner from "../components/Spinner";
import ErrorMessage from "../components/ErrorMessage";
import Badge from "../components/Badge";
import Button from "../components/Button";

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

function formatShowTime(isoString: string): string {
  try {
    const dt = new Date(isoString);
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(dt);
  } catch {
    return isoString;
  }
}

function formatDateHeader(dateString: string): { label: string; badge?: string } {
  try {
    const dt = new Date(dateString.includes("T") ? dateString : dateString + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(dt);
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const formatted = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(dt);

    if (diffDays === 0) return { label: formatted, badge: "Today" };
    if (diffDays === 1) return { label: formatted, badge: "Tomorrow" };
    return { label: formatted };
  } catch {
    return { label: dateString };
  }
}

export default function MovieDetail() {
  const { id } = useParams<{ id: string }>();
  const [imageFailed, setImageFailed] = useState(false);

  const {
    data: movie,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["movie", id],
    queryFn: () => fetchMovie(Number(id)),
    enabled: !!id,
  });

  if (isLoading) {
    return <Spinner size="lg" className="py-24" />;
  }

  if (isError || !movie) {
    return (
      <div className="py-12">
        <ErrorMessage
          message={(error as Error)?.message || "The movie you are looking for does not exist."}
          onRetry={() => refetch()}
        />
        <div className="text-center mt-6">
          <Link to="/">
            <Button variant="outline" size="sm">
              ← Back to Movies
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const language = movie.language || "English";
  const showImage = Boolean(movie.poster_url && !imageFailed);
  const dateGroups = movie.shows ?? [];
  const totalUpcomingShows = dateGroups.reduce((acc, g) => acc + g.showtimes.length, 0);

  return (
    <div className="space-y-10">
      {/* Back Button */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:border-line/80 hover:text-gray-900"
        >
          <span>←</span>
          <span>Back to Movies</span>
        </Link>
      </div>

      {/* Hero Section / Movie Details */}
      <section className="relative overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-xl sm:p-8 lg:p-10">
        <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-start">
          {/* Poster Container */}
          <div className="mx-auto w-full max-w-[260px] flex-shrink-0 md:mx-0">
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-line bg-bg shadow-xl">
              {showImage ? (
                <img
                  src={movie.poster_url!}
                  alt={movie.title}
                  onError={() => setImageFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                /* Dark/Light card placeholder with movie title */
                <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center select-none bg-gradient-to-br from-gray-50 to-white">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 border border-line">
                    <span className="text-3xl text-gray-500">🎬</span>
                  </div>
                  <p className="line-clamp-2 text-base font-bold text-gray-900">{movie.title}</p>
                  <p className="mt-1 text-xs text-gray-600">{movie.genre || "Cinema"}</p>
                </div>
              )}

              {/* Top Rating Badge */}
              <div className="absolute right-3 top-3">
                <Badge rating={movie.rating} />
              </div>
            </div>
          </div>

          {/* Metadata & Synopsis */}
          <div className="flex flex-1 flex-col">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {/* Language Badge */}
                <span className="rounded-md border border-line bg-white px-2.5 py-1 text-xs font-semibold text-gray-700">
                  🌐 {language}
                </span>

                {/* Rating Badge */}
                <Badge rating={movie.rating} />

                {/* Genre Badge */}
                <span className="rounded-md border border-line bg-white px-2.5 py-1 text-xs font-semibold text-gray-700">
                  {movie.genre}
                </span>

                {/* Duration */}
                <span className="rounded-md border border-line bg-white px-2.5 py-1 text-xs font-semibold text-gray-700">
                  ⏱️ {formatDuration(movie.duration_minutes)}
                </span>
              </div>

              {/* Movie Title */}
              <h1 className="mt-2 text-2xl font-black tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
                {movie.title}
              </h1>
            </div>

            {/* Synopsis / Description */}
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Synopsis
              </h3>
              <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-gray-600 sm:text-base">
                {movie.description || "No description provided for this movie."}
              </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="mt-8 grid grid-cols-2 gap-3 border-t border-line pt-6 sm:grid-cols-4">
              <div className="rounded-xl border border-line bg-white p-3 text-center">
                <span className="block text-[11px] font-medium text-gray-500 uppercase">Rating</span>
                <span className="mt-0.5 text-base font-black text-accent">
                  {movie.rating ?? "U"}
                </span>
              </div>
              <div className="rounded-xl border border-line bg-white p-3 text-center">
                <span className="block text-[11px] font-medium text-gray-500 uppercase">Language</span>
                <span className="mt-0.5 text-base font-bold text-gray-900">{language}</span>
              </div>
              <div className="rounded-xl border border-line bg-white p-3 text-center">
                <span className="block text-[11px] font-medium text-gray-500 uppercase">Duration</span>
                <span className="mt-0.5 text-base font-bold text-gray-900">{formatDuration(movie.duration_minutes)}</span>
              </div>
              <div className="rounded-xl border border-line bg-white p-3 text-center">
                <span className="block text-[11px] font-medium text-gray-500 uppercase">Shows</span>
                <span className="mt-0.5 text-base font-black text-accent">
                  {totalUpcomingShows}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Ambient glow */}
        <div className="pointer-events-none absolute -bottom-20 -right-20 -z-0 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
      </section>

      {/* Upcoming Showtimes Section */}
      <section className="space-y-6">
        <div className="flex flex-col justify-between gap-2 border-b border-line pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-gray-900">
              Upcoming Shows
            </h2>
            <p className="mt-1 text-xs text-gray-600">
              Select a screening time to book your seats
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-1.5 text-xs text-gray-700">
            <span>🎟️</span>
            <span>Hall Capacity: 80 Seats</span>
          </div>
        </div>

        {/* Empty state: No upcoming shows */}
        {dateGroups.length === 0 ? (
          <div className="rounded-xl border border-line bg-white p-12 text-center">
            <div className="mb-3 text-4xl">🕒</div>
            <h3 className="text-lg font-bold text-gray-900">No upcoming shows</h3>
            <p className="mt-1 text-sm text-gray-600">
              There are currently no scheduled screenings for this movie. Check back soon!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {dateGroups.map((group) => {
              const { label, badge } = formatDateHeader(group.date);

              return (
                <div
                  key={group.date}
                  className="rounded-2xl border border-line bg-white p-5 sm:p-6"
                >
                  {/* Date Header */}
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-sm text-accent">
                      📅
                    </span>
                    <h3 className="text-base font-bold text-gray-900 sm:text-lg">
                      {label}
                    </h3>
                    {badge && (
                      <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-black uppercase text-gray-900 shadow-sm shadow-accent/20">
                        {badge}
                      </span>
                    )}
                    <span className="ml-auto text-xs font-medium text-gray-600">
                      {group.showtimes.length} show{group.showtimes.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Showtimes Grid */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.showtimes.map((show) => {
                      const isSoldOut = show.available_seats <= 0;
                      const isFillingFast = !isSoldOut && show.available_seats <= 15;

                      return (
                        <Link
                          key={show.id}
                          to={`/shows/${show.id}`}
                          id={`show-time-card-${show.id}`}
                          className={`group relative flex flex-col justify-between rounded-xl border p-5 transition-all duration-200 ${
                            isSoldOut
                              ? "cursor-not-allowed border-line/40 bg-bg opacity-50"
                              : "border-line bg-white hover:-translate-y-1 hover:border-accent hover:shadow-lg hover:shadow-accent/5"
                          }`}
                        >
                          {/* Top Row: Start time & Price */}
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="block text-xl font-black text-gray-900 group-hover:text-accent transition-colors">
                                {formatShowTime(show.start_time)}
                              </span>
                              <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-wider text-gray-500">
                                Screen 1
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="block text-lg font-black text-accent">
                                ₹{show.price}
                              </span>
                              <span className="text-[10px] text-gray-500">per seat</span>
                            </div>
                          </div>

                          {/* Bottom Row: Seat Availability */}
                          <div className="mt-5 border-t border-line pt-3">
                            <div className="flex items-center justify-between text-xs">
                              {isSoldOut ? (
                                <span className="font-semibold text-red-400">
                                  Sold Out
                                </span>
                              ) : isFillingFast ? (
                                <span className="flex items-center gap-1 font-semibold text-warning">
                                  <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                                  {show.available_seats} seats left
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 font-medium text-success">
                                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                                  {show.available_seats} available
                                </span>
                              )}

                              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-gray-500 transition-transform group-hover:translate-x-1 group-hover:text-accent">
                                {isSoldOut ? "Full" : "Book →"}
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}