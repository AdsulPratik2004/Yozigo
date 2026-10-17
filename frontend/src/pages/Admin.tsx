import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMovies,
  fetchMovie,
  createMovie,
  updateMovie,
  deleteMovie,
  createShow,
  deleteShow,
  ApiError,
} from "../lib/api";
import type { Movie } from "../lib/types";
import Button from "../components/Button";
import MovieFormModal, { initialMovieForm, type MovieFormData } from "../components/admin/MovieFormModal";
import MovieTable from "../components/admin/MovieTable";
import ShowsManagementPanel from "../components/admin/ShowsManagementPanel";


export default function Admin() {
  const queryClient = useQueryClient();

  // State
  const [isMovieModalOpen, setIsMovieModalOpen] = useState(false);
  const [editingMovieId, setEditingMovieId] = useState<number | null>(null);
  const [movieForm, setMovieForm] = useState<MovieFormData>(initialMovieForm);
  const [movieError, setMovieError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Selected Movie for Shows management
  const [selectedMovieForShows, setSelectedMovieForShows] = useState<Movie | null>(null);

  // Show Form State
  const [showDate, setShowDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [showTime, setShowTime] = useState<string>("18:00");
  const [showPrice, setShowPrice] = useState<number>(250);
  const [showFormError, setShowFormError] = useState<string | null>(null);
  const [showDeleteError, setShowDeleteError] = useState<string | null>(null);

  // 1. Fetch all movies
  const {
    data: movies,
    isLoading: isMoviesLoading,
    isError: isMoviesError,
    error: moviesError,
  } = useQuery({
    queryKey: ["admin-movies"],
    queryFn: fetchMovies,
  });

  // Filter movies based on search query
  const filteredMovies = (movies || []).filter((movie) =>
    movie.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 2. Fetch specific movie details (with shows) when managing shows
  const {
    data: selectedMovieData,
    isLoading: isShowsLoading,
    refetch: refetchSelectedMovie,
  } = useQuery({
    queryKey: ["admin-movie-detail", selectedMovieForShows?.id],
    queryFn: () => fetchMovie(selectedMovieForShows!.id),
    enabled: !!selectedMovieForShows,
  });

  // Movie Mutations
  const createMovieMutation = useMutation({
    mutationFn: (data: Parameters<typeof createMovie>[0]) => createMovie(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-movies"] });
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      setIsMovieModalOpen(false);
      setMovieForm(initialMovieForm);
      setMovieError(null);
    },
    onError: (err: ApiError | Error) => {
      setMovieError(err.message || "Failed to create movie.");
    },
  });

  const updateMovieMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateMovie>[1] }) =>
      updateMovie(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-movies"] });
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      setIsMovieModalOpen(false);
      setEditingMovieId(null);
      setMovieForm(initialMovieForm);
      setMovieError(null);
    },
    onError: (err: ApiError | Error) => {
      setMovieError(err.message || "Failed to update movie.");
    },
  });

  const deleteMovieMutation = useMutation({
    mutationFn: (id: number) => deleteMovie(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-movies"] });
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      if (selectedMovieForShows?.id) {
        setSelectedMovieForShows(null);
      }
    },
    onError: (err: ApiError | Error) => {
      alert(`Could not delete movie: ${err.message}`);
    },
  });

  // Show Mutations
  const createShowMutation = useMutation({
    mutationFn: (data: Parameters<typeof createShow>[0]) => createShow(data),
    onSuccess: () => {
      refetchSelectedMovie();
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      setShowFormError(null);
    },
    onError: (err: ApiError | Error) => {
      const apiErr = err as ApiError;
      setShowFormError(
        apiErr.detail ||
          apiErr.message ||
          "Failed to schedule show. There might be a time overlap."
      );
    },
  });

  const deleteShowMutation = useMutation({
    mutationFn: (id: number) => deleteShow(id),
    onSuccess: () => {
      refetchSelectedMovie();
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      setShowDeleteError(null);
    },
    onError: (err: ApiError | Error) => {
      const apiErr = err as ApiError;
      setShowDeleteError(
        apiErr.detail ||
          apiErr.message ||
          "This show cannot be deleted because it already has bookings."
      );
    },
  });

  // Handlers for Movie Modal
  const handleOpenAddModal = () => {
    setEditingMovieId(null);
    setMovieForm(initialMovieForm);
    setMovieError(null);
    setIsMovieModalOpen(true);
  };

  const handleOpenEditModal = (m: Movie) => {
    setEditingMovieId(m.id);
    setMovieForm({
      title: m.title,
      poster_url: m.poster_url || "",
      language: m.language || "English",
      duration_minutes: m.duration_minutes || 120,
      genre: m.genre || "",
      rating: m.rating != null ? String(m.rating) : "",
      description: m.description || "",
    });
    setMovieError(null);
    setIsMovieModalOpen(true);
  };

  const handleSaveMovie = (e: React.FormEvent) => {
    e.preventDefault();
    setMovieError(null);

    const payload = {
      title: movieForm.title.trim(),
      poster_url: movieForm.poster_url.trim() || null,
      duration_minutes: Number(movieForm.duration_minutes),
      genre: movieForm.genre.trim() || "Cinema",
      rating: movieForm.rating ? parseFloat(movieForm.rating) : null,
      description: movieForm.description.trim(),
    };

    if (editingMovieId) {
      updateMovieMutation.mutate({ id: editingMovieId, data: payload });
    } else {
      createMovieMutation.mutate(payload);
    }
  };

  const handleDeleteMovie = (m: Movie) => {
    if (confirm(`Are you sure you want to delete "${m.title}"? This cannot be undone.`)) {
      deleteMovieMutation.mutate(m.id);
    }
  };

  // Handlers for Shows Management
  const handleAddShow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovieForShows) return;

    setShowFormError(null);
    setShowDeleteError(null);

    try {
      const startDateTime = new Date(`${showDate}T${showTime}:00`);
      if (isNaN(startDateTime.getTime())) {
        setShowFormError("Please provide a valid date and time.");
        return;
      }

      createShowMutation.mutate({
        movie_id: selectedMovieForShows.id,
        start_time: startDateTime.toISOString(),
        price: Number(showPrice),
      });
    } catch {
      setShowFormError("Invalid date/time format.");
    }
  };

  const handleDeleteShow = (showId: number) => {
    setShowDeleteError(null);
    setShowFormError(null);
    if (confirm("Delete this show screening?")) {
      deleteShowMutation.mutate(showId);
    }
  };

  return (
    <div className="w-full max-w-full space-y-8 bg-white text-gray-900 overflow-x-hidden min-w-0 px-2 sm:px-6 py-4 box-border">
      {/* Dashboard Top Header */}
      <section className="flex flex-col gap-4 border-b border-line pb-6 w-full min-w-0 max-w-full">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-accent">
              Admin Portal
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-gray-900 sm:text-3xl truncate">
            Cinema Management
          </h1>
          <p className="mt-1 text-xs text-muted">
            Add, update, or remove movies and schedule screening times in Hall 1.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full min-w-0">
          {/* Search Filter */}
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              placeholder="Search movies…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9 pr-8 py-2 text-sm w-full bg-white border-line-light box-border"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
              🔍
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted hover:text-accent transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          <Button
            variant="primary"
            id="btn-add-movie"
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 shrink-0 text-xs py-2"
          >
            <span>+</span>
            <span>Add New Movie</span>
          </Button>
        </div>
      </section>

      {/* Main Grid: Movies Table & Shows Panel */}
      <div className="w-full min-w-0 max-w-full overflow-hidden grid gap-8 lg:grid-cols-12">
        {/* Left Column: Movies List (Table) */}
        <div className="lg:col-span-12 w-full min-w-0 max-w-full overflow-hidden">
          <MovieTable
            movies={filteredMovies}
            isLoading={isMoviesLoading}
            isError={isMoviesError}
            error={moviesError as Error | null}
            selectedMovieId={selectedMovieForShows?.id || null}
            onSelectMovie={(m) =>
              setSelectedMovieForShows(
                selectedMovieForShows?.id === m.id ? null : m
              )
            }
            onEditMovie={handleOpenEditModal}
            onDeleteMovie={handleDeleteMovie}
          />
        </div>
      </div>

      {/* Shows Management Modal */}
      {selectedMovieForShows && (
        <ShowsManagementPanel
          movie={selectedMovieForShows}
          movieData={selectedMovieData}
          isLoading={isShowsLoading}
          showDate={showDate}
          showTime={showTime}
          showPrice={showPrice}
          showFormError={showFormError}
          showDeleteError={showDeleteError}
          isCreatePending={createShowMutation.isPending}
          isDeletePending={deleteShowMutation.isPending}
          onDateChange={setShowDate}
          onTimeChange={setShowTime}
          onPriceChange={setShowPrice}
          onAddShow={handleAddShow}
          onDeleteShow={handleDeleteShow}
          onClose={() => setSelectedMovieForShows(null)}
        />
      )}

      {/* Add / Edit Movie Modal */}
      <MovieFormModal
        isOpen={isMovieModalOpen}
        onClose={() => setIsMovieModalOpen(false)}
        onSubmit={handleSaveMovie}
        formData={movieForm}
        onFormChange={setMovieForm}
        error={movieError}
        isEditing={!!editingMovieId}
        isPending={createMovieMutation.isPending || updateMovieMutation.isPending}
      />
    </div>
  );
}
