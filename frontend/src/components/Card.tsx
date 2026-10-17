import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hoverLift?: boolean;
}

export default function Card({
  children,
  className = "",
  hoverLift = true,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-xl border border-line bg-white ${
        hoverLift
          ? "transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-line/80"
          : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
