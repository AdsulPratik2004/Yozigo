import Button from "./Button";

interface ErrorMessageProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorMessage({
  title = "Something went wrong",
  message = "Failed to load content. Please try again.",
  onRetry,
  className = "",
}: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className={`mx-auto max-w-lg rounded-xl border border-line bg-card p-6 text-center shadow-lg ${className}`}
    >
      <div className="mb-3 flex justify-center text-4xl text-warning">⚠️</div>
      <h3 className="text-base font-bold text-white">{title}</h3>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {onRetry && (
        <div className="mt-5 flex justify-center">
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
