import type { RpcSpan } from "../../../lib/rpc/tracer";

export const KEEP_VIEWING_DURATION_MS = 4000;

export function formatDuration(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return "0ms";
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  return `${(durationMs / 1000).toFixed(2)}s`;
}

export function formatTimeOffset(durationMs: number) {
  return formatDuration(durationMs);
}

export function getSpanDuration(span: RpcSpan, now: number) {
  return (span.endTime ?? now) - span.startTime;
}

export function getSpanBarClass(status: RpcSpan["status"]) {
  if (status === "pending") return "bg-amber-400/80 border-amber-300/30";
  if (status === "success") return "bg-emerald-400/80 border-emerald-300/30";
  return "bg-rose-400/80 border-rose-300/30";
}

export function getColorForStatus(status: RpcSpan["status"]) {
  if (status === "pending") return "amber";
  if (status === "success") return "emerald";
  return "rose";
}

export function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function normalizeEvents(events: RpcSpan["events"]) {
  if (!Array.isArray(events)) return [] as NonNullable<RpcSpan["events"]>;
  return events;
}

export function statusLabel(status: RpcSpan["status"]) {
  if (status === "pending") return "Running";
  if (status === "success") return "Done";
  return "Error";
}

export function formatKeepViewingCountdown(durationMs: number) {
  const seconds = Math.max(durationMs, 0) / 1000;
  return seconds.toFixed(2).replace(".", ":");
}
