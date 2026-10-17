import { useState } from "react";
import { Link } from "react-router-dom";
import type { Movie } from "../lib/types";
import Badge from "./Badge";

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

interface MovieCardProps {
  movie: Movie;
}

export default function MovieCard({ movie }: MovieCardProps) {
  const [imageError, setImageError] = useState(false);
  const hasValidImage = Boolean(movie.poster_url && !imageError);
  const language = movie.language || "English";

  return (
    <Link
      to={`/movies/${movie.id}`}
      id={`movie-card-${movie.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-card card-hover shadow-card"
    >
      {/* Poster area with aspect-[2/3] and zoom on hover */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-bg">
        {hasValidImage ? (
          <img
            src={movie.poster_url!}
            alt={movie.title}
            onError={() => setImageError(true)}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          /* Premium placeholder when poster_url is null or image failed to load */
          <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center select-none bg-gradient-to-br from-card to-bg">
            <span className="text-5xl mb-3 text-muted/50 transition-transform duration-500 group-hover:scale-110">
              🎬
            </span>
            <p className="line-clamp-2 text-sm font-bold text-gray-900/70">
              {movie.title}
            </p>
            <span className="mt-1 text-xs text-muted">
              {movie.genre || "Cinema"}
            </span>
          </div>
        )}

        {/* Premium gradient overlay at the bottom */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-20">
          <div className="flex items-center justify-between gap-2 mb-2">
            <Badge rating={movie.rating} />
            <span className="text-xs font-bold text-white bg-accent/90 px-2.5 py-1 rounded border border-accent">
              {language}
            </span>
          </div>

          <h3 className="line-clamp-1 text-base font-bold text-white group-hover:text-accent transition-colors">
            {movie.title}
          </h3>

          <div className="mt-1.5 flex items-center gap-2 text-xs text-white/80">
            <span className="truncate">{movie.genre}</span>
            <span className="text-accent">•</span>
            <span className="flex-shrink-0 font-medium text-white/80">{formatDuration(movie.duration_minutes)}</span>
          </div>
        </div>

        {/* Premium hover overlay */}
        <div className="absolute inset-0 bg-accent/0 transition-colors duration-300 group-hover:bg-accent/5" />
      </div>
    </Link>
  );
}
