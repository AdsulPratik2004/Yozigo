import type { HTMLAttributes, ReactNode } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  rating?: string | number | null;
  children?: ReactNode;
}

export default function Badge({ rating, children, className = "", ...props }: BadgeProps) {
  const content = children ?? rating ?? "U";
  const ratingStr = String(content).toUpperCase().trim();

  let colorStyles = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"; // default U
  if (ratingStr.includes("UA")) {
    colorStyles = "bg-amber-500/15 text-amber-400 border-amber-500/30";
  } else if (ratingStr === "A" || ratingStr.includes("18") || ratingStr.includes("R")) {
    colorStyles = "bg-rose-500/15 text-rose-400 border-rose-500/30";
  } else if (ratingStr === "U") {
    colorStyles = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-bold uppercase tracking-wider backdrop-blur-sm ${colorStyles} ${className}`}
      {...props}
    >
      {content}
    </span>
  );
}
