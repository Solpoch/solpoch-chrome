export default function TimelineEventDot({
  active,
  done,
}: {
  active: boolean;
  done: boolean;
}) {
  return (
    <span
      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full border ${active
        ? "border-amber-300 bg-amber-400 animate-pulse"
        : done
          ? "border-emerald-300 bg-emerald-400"
          : "border-white/20 bg-white/10"
        }`}
    />
  );
}
