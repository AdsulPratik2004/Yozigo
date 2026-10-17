export type SeatState = "available" | "selected" | "held" | "booked";

export interface SeatProps {
  label: string;
  status: SeatState;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export default function Seat({
  label,
  status,
  onClick,
  disabled,
  className = "",
}: SeatProps) {
  const isClickable = status === "available" || status === "selected";
  const isDisabled = disabled || !isClickable;

  let stateStyles = "";
  if (status === "available") {
    stateStyles =
      "border border-green-500 bg-white/60 text-gray-900/90 hover:scale-110 hover:bg-green-500/20 cursor-pointer";
  } else if (status === "selected") {
    stateStyles =
      "bg-accent border border-accent text-gray-900 font-bold scale-105 shadow-md shadow-accent/30 cursor-pointer";
  } else if (status === "held") {
    stateStyles =
      "bg-amber-500/40 border border-amber-500/50 text-amber-700 cursor-not-allowed";
  } else if (status === "booked") {
    stateStyles =
      "bg-gray-300 opacity-50 border border-gray-300 text-gray-500 cursor-not-allowed";
  }

  return (
    <button
      type="button"
      id={`seat-${label}`}
      disabled={isDisabled}
      onClick={isClickable ? onClick : undefined}
      title={`Seat ${label} (${status})`}
      aria-label={`Seat ${label} (${status})`}
      className={`h-7 w-7 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold transition-all duration-150 flex-shrink-0 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent/40 ${stateStyles} ${className}`}
    >
      {label}
    </button>
  );
}

export function Legend({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-4 sm:gap-6 rounded-xl border border-line bg-white px-4 py-3 sm:px-6 text-xs text-muted ${className}`}
    >
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded-md border border-green-500 bg-white/60" />
        <span>Available</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded-md border border-accent bg-accent shadow-sm shadow-accent/30" />
        <span className="font-semibold text-gray-900">Selected</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded-md border border-amber-500/50 bg-amber-500/40" />
        <span className="text-amber-700">Held</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded-md border border-gray-300 bg-gray-300 opacity-50" />
        <span className="text-gray-400">Booked</span>
      </div>
    </div>
  );
}
