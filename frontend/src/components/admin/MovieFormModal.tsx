import { createPortal } from "react-dom";
import Button from "../Button";

interface MovieFormData {
  title: string;
  poster_url: string;
  language: string;
  duration_minutes: number;
  genre: string;
  rating: string;
  description: string;
}

interface MovieFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: MovieFormData;
  onFormChange: (data: MovieFormData) => void;
  error: string | null;
  isEditing: boolean;
  isPending: boolean;
}

const initialMovieForm: MovieFormData = {
  title: "",
  poster_url: "",
  language: "English",
  duration_minutes: 120,
  genre: "Action / Sci-Fi",
  rating: "8.0",
  description: "",
};

export { initialMovieForm };
export type { MovieFormData };

export default function MovieFormModal({
  isOpen,
  onClose,
  onSubmit,
  formData,
  onFormChange,
  error,
  isEditing,
  isPending,
}: MovieFormModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h3 className="text-lg font-black text-gray-900">
            {isEditing ? "Edit Movie" : "Add New Movie"}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-gray-900">
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-300"
            >
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-muted">
                Movie Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => onFormChange({ ...formData, title: e.target.value })}
                placeholder="e.g. Inception"
                className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-gray-900 focus:border-accent focus:outline-none"
              />
            </div>

            {/* Poster URL */}
            <div>
              <label className="block text-xs font-semibold text-muted">
                Poster Image URL
              </label>
              <input
                type="url"
                value={formData.poster_url}
                onChange={(e) => onFormChange({ ...formData, poster_url: e.target.value })}
                placeholder="https://..."
                className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-gray-900 focus:border-accent focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Language */}
              <div>
                <label className="block text-xs font-semibold text-muted">
                  Language
                </label>
                <input
                  type="text"
                  value={formData.language}
                  onChange={(e) => onFormChange({ ...formData, language: e.target.value })}
                  placeholder="e.g. English"
                  className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-gray-900 focus:border-accent focus:outline-none"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-semibold text-muted">
                  Duration (min) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.duration_minutes}
                  onChange={(e) =>
                    onFormChange({ ...formData, duration_minutes: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-gray-900 focus:border-accent focus:outline-none"
                />
              </div>

              {/* Rating */}
              <div>
                <label className="block text-xs font-semibold text-muted">
                  Rating (0-10)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={formData.rating}
                  onChange={(e) => onFormChange({ ...formData, rating: e.target.value })}
                  placeholder="8.5"
                  className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-gray-900 focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            {/* Genre */}
            <div>
              <label className="block text-xs font-semibold text-muted">Genre</label>
              <input
                type="text"
                value={formData.genre}
                onChange={(e) => onFormChange({ ...formData, genre: e.target.value })}
                placeholder="e.g. Sci-Fi / Thriller"
                className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-gray-900 focus:border-accent focus:outline-none"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-muted">Synopsis</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
                placeholder="Movie synopsis or plot summary..."
                className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-gray-900 focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-line pt-4">
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isPending}
              className="text-xs"
            >
              {isPending ? "Saving..." : isEditing ? "Update Movie" : "Create Movie"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
