import {
  formatKeepViewingCountdown,
  KEEP_VIEWING_DURATION_MS,
} from "./traceViewUtils";

export default function KeepViewingButton({
  remainingMs,
  onClick,
}: {
  remainingMs: number;
  onClick: () => void;
}) {
  const progress = Math.min(
    Math.max(remainingMs / KEEP_VIEWING_DURATION_MS, 0),
    1,
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex items-center justify-center gap-2 overflow-hidden rounded-full border border-white/10 bg-primary/30 px-4 py-2.5 text-xs font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 w-full"
    >
      <span
        className="absolute left-0 top-0 h-full bg-primary transition-[width] duration-75"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative z-10">Keep viewing ({formatKeepViewingCountdown(remainingMs)})</span>
    </button>
  );
}
