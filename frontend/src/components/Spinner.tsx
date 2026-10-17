interface SpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function Spinner({
  message,
  size = "md",
  className = "",
}: SpinnerProps) {
  const sizeStyles = {
    sm: "h-5 w-5 border-2",
    md: "h-8 w-8 border-3",
    lg: "h-12 w-12 border-4",
  }[size];

  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-8 ${className}`}>
      <div
        className={`${sizeStyles} animate-spin rounded-full border-accent border-t-transparent shadow-sm`}
        role="status"
        aria-label="Loading"
      />
      {message && <p className="text-sm font-medium text-muted">{message}</p>}
    </div>
  );
}
