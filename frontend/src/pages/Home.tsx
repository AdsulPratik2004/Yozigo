import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMovies } from "../lib/api";
import MovieCard from "../components/MovieCard";
import Spinner from "../components/Spinner";
import ErrorMessage from "../components/ErrorMessage";
import Button from "../components/Button";
import { useSearch } from "../context/SearchContext";

export default function Home() {
  const [selectedGenre, setSelectedGenre] = useState<string>("All");
  const { searchQuery, setSearchQuery } = useSearch();

  const {
    data: movies,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["movies"],
    queryFn: fetchMovies,
  });

  // Extract unique genres for filter pills
  const genres = useMemo(() => {
    if (!movies) return ["All"];
    const set = new Set<string>();
    movies.forEach((m) => {
      if (m.genre) {
        m.genre.split("/").forEach((g) => {
          const trimmed = g.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    });
    return ["All", ...Array.from(set)];
  }, [movies]);

  // Filter movies based on search and genre
  const filteredMovies = useMemo(() => {
    if (!movies) return [];
    return movies.filter((m) => {
      const matchesSearch =
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.genre && m.genre.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesGenre =
        selectedGenre === "All" ||
        (m.genre && m.genre.toLowerCase().includes(selectedGenre.toLowerCase()));

      return matchesSearch && matchesGenre;
    });
  }, [movies, searchQuery, selectedGenre]);

  return (
    <div className="space-y-12">
      {/* Premium Hero Header */}
      <section className="relative overflow-hidden rounded-2xl bg-hero p-8 sm:p-12 lg:p-16">
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-accent">
            <span>🎬</span>
            <span>Yogizo Cinema</span>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
            Book Movies <span className="text-gradient">Instantly</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Premium movie booking experience. Select your seats, book instantly, and enjoy the show.
          </p>
        </div>

        {/* Premium background glow */}
        <div className="pointer-events-none absolute -top-32 left-1/2 -z-0 h-80 w-[500px] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 -z-0 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
      </section>

      {/* Premium Genre Filter Pills */}
      {genres.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
          <span className="mr-2 text-xs font-bold uppercase tracking-widest text-muted">
            Browse by:
          </span>
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                selectedGenre === g
                  ? "bg-accent text-white shadow-glow font-bold"
                  : "border border-line bg-card-light text-muted hover:border-accent/50 hover:text-accent"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Movie Grid Section Header */}
      <div className="flex items-center justify-between border-b border-line pb-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
            Now Showing
          </h2>
          <p className="mt-1 text-sm text-muted">
            Book your favorite movies from our collection
          </p>
        </div>
        {!isLoading && movies && (
          <span className="text-sm font-medium text-muted">
            {filteredMovies.length} {filteredMovies.length === 1 ? 'movie' : 'movies'}
          </span>
        )}
      </div>

      {/* Loading State */}
      {isLoading && <Spinner size="lg" className="py-20" />}

      {/* Error State with Retry */}
      {isError && (
        <ErrorMessage
          message={(error as Error)?.message || "Unable to load movies. Please check the backend connection."}
          onRetry={() => refetch()}
        />
      )}

      {/* Empty State: No movies yet */}
      {!isLoading && !isError && movies && movies.length === 0 && (
        <div className="rounded-2xl border border-line bg-card p-16 text-center shadow-card">
          <div className="mb-4 text-5xl">🎬</div>
          <h3 className="text-xl font-bold text-gray-900">No movies available</h3>
          <p className="mt-2 text-sm text-muted">
            Our schedule is being updated. Check back soon!
          </p>
        </div>
      )}

      {/* Filtered Empty State */}
      {!isLoading && !isError && movies && movies.length > 0 && filteredMovies.length === 0 && (
        <div className="rounded-2xl border border-line bg-card p-16 text-center shadow-card">
          <div className="mb-4 text-5xl">🔍</div>
          <h3 className="text-xl font-bold text-gray-900">No movies found</h3>
          <p className="mt-2 text-sm text-muted">
            Try adjusting your search or filter
          </p>
          <div className="mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedGenre("All");
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      )}

      {/* Premium Movies Grid */}
      {!isLoading && !isError && filteredMovies.length > 0 && (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4 xl:gap-8">
          {filteredMovies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      )}
    </div>
  );
}
