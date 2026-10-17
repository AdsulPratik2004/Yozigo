interface ScreenProps {
  className?: string;
}

export default function Screen({ className = "" }: ScreenProps) {
  return (
    <div className={`mb-10 w-full max-w-lg px-4 text-center select-none ${className}`}>
      {/* Curved Screen Bar */}
      <div className="relative mx-auto h-3 w-full rounded-t-[100px] border-t-2 border-accent bg-gradient-to-b from-accent/30 via-accent/10 to-transparent shadow-[0_-8px_25px_rgba(244,63,94,0.35)]" />

      {/* Screen Direction Indicator */}
      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="text-xs text-accent">▲</span>
        <span className="text-xs font-black uppercase tracking-[0.35em] text-muted">
          Screen this way
        </span>
        <span className="text-xs text-accent">▲</span>
      </div>
    </div>
  );
}
