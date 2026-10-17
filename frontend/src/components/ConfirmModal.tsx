import { createPortal } from "react-dom";
import Button from "./Button";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  movieTitle?: string;
  seats?: string[];
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  movieTitle,
  seats,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isPending = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h3 className="text-lg font-black text-gray-900">{title}</h3>
          <button onClick={onCancel} className="text-muted hover:text-gray-900">
            ✕
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-muted">{message}</p>
          
          {movieTitle && (
            <div className="mt-4 rounded-xl border border-line bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                Movie
              </div>
              <p className="mt-1 text-base font-black text-gray-900">{movieTitle}</p>
              
              {seats && seats.length > 0 && (
                <>
                  <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted">
                    Seats ({seats.length})
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {seats.map((seat) => (
                      <span
                        key={seat}
                        className="rounded-md border border-accent/40 bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent"
                      >
                        {seat}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-line px-6 py-4">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1"
          >
            {cancelText}
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1"
          >
            {isPending ? "Processing..." : confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
