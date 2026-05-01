import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import type { RpcSpan } from "../../../lib/rpc/tracer";
import Collapsible from "../layout/Collapsible";
import Row from "../popup/signAndSendTransaction/Row";
import SectionCard from "../popup/signAndSendTransaction/SectionCard";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { ArrowBendDownRightIcon } from "@phosphor-icons/react/dist/ssr";

type ViewMode = "waterfall" | "timeline" | "tree";

function formatDuration(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return "0ms";
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  return `${(durationMs / 1000).toFixed(2)}s`;
}

function formatTimeOffset(durationMs: number) {
  return formatDuration(durationMs);
}

function getSpanDuration(span: RpcSpan, now: number) {
  return (span.endTime ?? now) - span.startTime;
}

function getSpanBarClass(status: RpcSpan["status"]) {
  if (status === "pending") return "bg-amber-400/80 border-amber-300/30";
  if (status === "success") return "bg-emerald-400/80 border-emerald-300/30";
  return "bg-rose-400/80 border-rose-300/30";
}

function getColorForStatus(status: RpcSpan["status"]) {
  if (status === "pending") return "amber";
  if (status === "success") return "emerald";
  return "rose";
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusLabel(status: RpcSpan["status"]) {
  if (status === "pending") return "Running";
  if (status === "success") return "Done";
  return "Error";
}

function TimelineEventDot({
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

function TraceViewButton({
  success,
  proceed,
  loading,
}: {
  success: boolean;
  proceed: () => void;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!loading) {
          console.log("Proceeding to next step");
          proceed()
        };
      }}
      className={`flex items-center justify-center gap-2 px-4 py-2.5  hover:gap-4 disabled:opacity-40 disabled:cursor-not-allowed transition-all rounded-full font-medium w-full text-xs ${success
        ? "bg-primary hover:bg-primary/90 text-white inset-top"
        : "border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15"
        }`}
      disabled={loading}
    >
      {loading ? "Processing..." : success ? "Proceed Next" : "An error occurred"}
      {!loading && <ArrowRightIcon size={14} />}
    </button>
  );
}

const KEEP_VIEWING_DURATION_MS = 5000;

function formatKeepViewingCountdown(durationMs: number) {
  const seconds = Math.max(durationMs, 0) / 1000;
  return seconds.toFixed(2).replace(".", ":");
}

function KeepViewingButton({
  loading,
  remainingMs,
  onClick,
}: {
  loading: boolean;
  remainingMs: number;
  onClick: () => void;
}) {
  const progress = Math.min(Math.max(remainingMs / KEEP_VIEWING_DURATION_MS, 0), 1);

  return (
    <button
      type="button"
      disabled={loading}
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

function WaterfallRow({
  span,
  depth,
  minStart,
  totalDuration,
  childrenByParent,
  now,
}: {
  span: RpcSpan;
  depth: number;
  minStart: number;
  totalDuration: number;
  childrenByParent: Map<string, RpcSpan[]>;
  now: number;
}) {
  const duration = getSpanDuration(span, now);
  const leftPercent = totalDuration > 0 ? ((span.startTime - minStart) / totalDuration) * 100 : 0;
  const widthPercent = totalDuration > 0 ? Math.max((duration / totalDuration) * 100, 0.8) : 0.8;
  const children = childrenByParent.get(span.id) ?? [];
  const isActive = span.status === "pending";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {
          depth > 0 && <div className="min-w-0 shrink-0 h-full flex justify-center items-center" style={{ width: `${depth * 10}px` }} >
            <ArrowBendDownRightIcon size={12} className={`text-gray-400`} />
          </div>
        }
        <div className="shrink-0 w-32">
          <div className="truncate text-xs font-medium text-gray-100">{span.method}</div>
          <div className="text-[10px] text-gray-500">{statusLabel(span.status)}</div>
        </div>

        <div className="relative h-8 min-w-0 flex-1 overflow-hidden rounded-md border border-white/5 bg-white/4">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[24px_100%]" />
          <motion.div
            className={`absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-md border px-2 text-[10px] text-gray-950 shadow-xs ${getSpanBarClass(span.status)}`}
            style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: `${widthPercent}%`, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 24, mass: 0.7 }}
          >
            <span className="truncate text-[10px] text-gray-950">{formatTimeOffset(duration)}</span>
          </motion.div>
          {isActive && (
            <div
              className="absolute top-1/2 h-5 -translate-y-1/2 rounded-md border border-amber-300/20 bg-amber-400/10"
              style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
            />
          )}
        </div>
      </div>

      {children.map((child) => (
        <WaterfallRow
          key={child.id}
          span={child}
          depth={depth + 1}
          minStart={minStart}
          totalDuration={totalDuration}
          childrenByParent={childrenByParent}
          now={now}
        />
      ))}
    </div>
  );
}

function TimelineSpan({
  span,
  depth,
  now,
  childrenByParent,
}: {
  span: RpcSpan;
  depth: number;
  now: number;
  childrenByParent: Map<string, RpcSpan[]>;
}) {
  const duration = getSpanDuration(span, now);
  const children = childrenByParent.get(span.id) ?? [];
  const isActive = span.status === "pending";

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2" style={{ paddingLeft: `${depth * 10}px` }}>
        <ArrowBendDownRightIcon size={12} className={`text-gray-400`} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`truncate text-xs ${isActive ? "text-gray-100" : "text-gray-200"}`}>{span.method}</span>
            {isActive && (
              <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-100">
                Live
              </span>
            )}
            {!isActive && (
              <span className={`rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-${getColorForStatus(span.status)}-400`}>
                {formatDuration(duration)}
              </span>
            )}
          </div>
          <div className="text-[10px] text-gray-500">{statusLabel(span.status)}</div>
        </div>
      </div>

      {children.length ? (
        <div className="space-y-1">
          {children.map((child) => (
            <TimelineSpan
              key={child.id}
              span={child}
              depth={depth + 1}
              now={now}
              childrenByParent={childrenByParent}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TreeNode({
  span,
  now,
  childrenByParent,
  depth,
}: {
  span: RpcSpan;
  now: number;
  childrenByParent: Map<string, RpcSpan[]>;
  depth: number;
}) {
  const duration = getSpanDuration(span, now);
  const children = childrenByParent.get(span.id) ?? [];

  return (
    <Collapsible
      defaultOpen={depth === 0}
      title={
        <div className="flex min-w-0 items-center gap-3 text-left">
          <span className="truncate text-xs text-gray-100">{span.method}</span>
          <span className={`rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-${getColorForStatus(span.status)}-400`}>
            {formatDuration(duration)}
          </span>
        </div>
      }
      className="rounded-lg border border-white/5 bg-white/4"
      headerClassName="rounded-none px-3 py-2 hover:bg-white/5"
      contentClassName="border-t border-white/5 p-3 pt-0"
    >
      <div className="flex flex-col">
        <Row label="Status" value={statusLabel(span.status)} accent={span.status === "error" ? "red" : span.status === "success" ? "green" : "neutral"} />
        <Row label="Start" value={span.startTime.toFixed(2)} mono />
        <Row label="Duration" value={formatDuration(duration)} mono />

        <div className="px-3 py-2.5 border-b border-white/5 last:border-b-0">
          <div className="mb-1 text-xs text-gray-400">Arguments</div>
          <pre className="max-h-40 overflow-x-auto rounded-md bg-black/20 p-2 text-xs text-gray-200 scrollbar-hide">
            {span.attributes ? safeJson(span.attributes) : "No arguments"}
          </pre>
        </div>

        <div className="px-3 py-2.5 border-b border-white/5 last:border-b-0">
          <div className="mb-1 text-xs text-gray-400">Result</div>
          <pre className="max-h-40 overflow-x-auto rounded-md bg-black/20 p-2 text-xs text-gray-200 scrollbar-hide">
            {span.status === "error"
              ? safeJson(span.error ?? "No error payload")
              : span.result !== undefined
                ? safeJson(span.result)
                : "No result yet"}
          </pre>
        </div>

        <div className="px-3 py-2.5 border-b border-white/5 last:border-b-0">
          <div className="mb-1 text-xs text-gray-400">Events</div>
          <div className="space-y-1">
            {span.events?.length ? (
              span.events.map((event, index) => (
                <div key={`${event.time}-${index}`} className="text-xs text-gray-300">
                  <span className="text-gray-500">[{formatDuration(event.time - span.startTime)}]</span> {event.message}
                </div>
              ))
            ) : (
              <div className="text-xs text-gray-500">No events</div>
            )}
          </div>
        </div>

        {children.length ? (
          <div className="px-3 py-2.5">
            <div className="mb-1 text-xs text-gray-400">Children</div>
            <div className="space-y-2">
              {children.map((child) => (
                <TreeNode key={child.id} span={child} now={now} childrenByParent={childrenByParent} depth={depth + 1} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Collapsible>
  );
}

function TimelineGroup({
  root,
  childrenByParent,
  now,
}: {
  root: RpcSpan;
  childrenByParent: Map<string, RpcSpan[]>;
  now: number;
}) {
  const directChildren = childrenByParent.get(root.id) ?? [];
  const events = [...(root.events ?? [])].sort((left, right) => left.time - right.time);
  const buckets = events.map(() => [] as RpcSpan[]);

  directChildren.forEach((child) => {
    let bucketIndex = -1;
    for (let index = events.length - 1; index >= 0; index -= 1) {
      if (child.startTime >= events[index].time) {
        bucketIndex = index;
        break;
      }
    }

    if (bucketIndex === -1) {
      bucketIndex = 0;
    }

    if (bucketIndex >= 0 && buckets[bucketIndex]) {
      buckets[bucketIndex].push(child);
    }
  });

  return (
    <SectionCard>
      <div className="px-3 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-gray-100">{root.method}</div>
            <div className="text-xs text-gray-500">{statusLabel(root.status)}</div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
            {formatDuration(getSpanDuration(root, now))}
          </span>
        </div>
      </div>

      <div className="space-y-2 px-3 py-3">
        {events.length ? (
          events.map((event, index) => {
            const hasDoneChild = buckets[index]?.some((child) => child.status !== "pending") ?? false;
            const hasPendingChild = buckets[index]?.some((child) => child.status === "pending") ?? false;

            return (
              <div key={`${event.time}-${index}`} className="space-y-2">
                <div className="flex items-start gap-2">
                  <TimelineEventDot active={hasPendingChild || (root.status === "pending" && index === events.length - 1)} done={hasDoneChild} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-gray-400">{event.message}</div>
                    <div className="text-[10px] text-gray-500">{formatDuration(event.time - root.startTime)}</div>
                  </div>
                </div>

                <div className="space-y-2 pl-5">
                  {buckets[index].map((child) => (
                    <TimelineSpan
                      key={child.id}
                      span={child}
                      depth={1}
                      now={now}
                      childrenByParent={childrenByParent}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-xs text-gray-500">No events captured yet.</div>
        )}

        {!events.length && directChildren.length ? (
          <div className="space-y-2">
            {directChildren.map((child) => (
              <TimelineSpan
                key={child.id}
                span={child}
                depth={1}
                now={now}
                childrenByParent={childrenByParent}
              />
            ))}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

export default function TraceView({
  traces,
  success,
  proceed,
  loading,
}: {
  traces: RpcSpan[];
  success: boolean;
  proceed: () => void;
  loading: boolean;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("waterfall");
  const [showKeepViewing, setShowKeepViewing] = useState(true);
  const [remainingMs, setRemainingMs] = useState(KEEP_VIEWING_DURATION_MS);
  const timerIdRef = useRef<number | null>(null);
  const timerStartRef = useRef(0);
  useEffect(() => {
    if (traces.length) {
      console.log(traces);
    }
  }, [traces]);

  useEffect(() => {
    if (timerIdRef.current !== null) {
      window.clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }

    if (loading) {
      setShowKeepViewing(true);
      setRemainingMs(KEEP_VIEWING_DURATION_MS);
      return;
    }

    if (!showKeepViewing) {
      setRemainingMs(KEEP_VIEWING_DURATION_MS);
      return;
    }

    timerStartRef.current = performance.now();
    timerIdRef.current = window.setInterval(() => {
      const elapsed = performance.now() - timerStartRef.current;
      const nextRemaining = Math.max(KEEP_VIEWING_DURATION_MS - elapsed, 0);
      setRemainingMs(nextRemaining);

      if (nextRemaining <= 0 && timerIdRef.current !== null) {
        window.clearInterval(timerIdRef.current);
        timerIdRef.current = null;
        proceed();
      }
    }, 50);

    return () => {
      if (timerIdRef.current !== null) {
        window.clearInterval(timerIdRef.current);
        timerIdRef.current = null;
      }
    };
  }, [loading, proceed, showKeepViewing]);

  const now = performance.now();

  const { childrenByParent, rootSpans, minStart, totalDuration } = useMemo(() => {
    const spansById = new Map(traces.map((span) => [span.id, span]));
    const childrenByParent = new Map<string, RpcSpan[]>();

    traces.forEach((span) => {
      if (!span.parentId) return;
      const siblings = childrenByParent.get(span.parentId) ?? [];
      siblings.push(span);
      childrenByParent.set(span.parentId, siblings);
    });

    const rootSpans = traces
      .filter((span) => !span.parentId || !spansById.has(span.parentId))
      .sort((left, right) => left.startTime - right.startTime);

    const minStart = traces.length ? Math.min(...traces.map((span) => span.startTime)) : 0;
    const maxEnd = traces.length ? Math.max(...traces.map((span) => span.endTime ?? now)) : now;
    const totalDuration = Math.max(maxEnd - minStart, 1);

    return {
      childrenByParent,
      rootSpans,
      minStart,
      totalDuration,
    };
  }, [now, traces]);

  const tabs: { id: ViewMode; label: string }[] = [
    { id: "waterfall", label: "Waterfall" },
    { id: "timeline", label: "Timeline" },
    { id: "tree", label: "Tree" },
  ];

  const panel = (() => {
    if (!traces.length) {
      return <div className="rounded-lg border border-white/5 bg-white/4 px-3 py-3 text-xs text-gray-500">No trace data yet.</div>;
    }

    if (viewMode === "waterfall") {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2 text-xs text-gray-500">
            <span className="w-32 shrink-0 text-[10px]">Span</span>
            <span className="flex-1 text-[10px]">{formatTimeOffset(totalDuration)}</span>
          </div>

          <div className="space-y-3">
            {rootSpans.map((root) => (
              <WaterfallRow
                key={root.id}
                span={root}
                depth={0}
                minStart={minStart}
                totalDuration={totalDuration}
                childrenByParent={childrenByParent}
                now={now}
              />
            ))}
          </div>
        </div>
      );
    }

    if (viewMode === "timeline") {
      return (
        <div className="space-y-3">
          {rootSpans.map((root) => (
            <TimelineGroup key={root.id} root={root} childrenByParent={childrenByParent} now={now} />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {rootSpans.map((root) => (
          <TreeNode key={root.id} span={root} now={now} childrenByParent={childrenByParent} depth={0} />
        ))}
      </div>
    );
  })();

  return (
    <>
      <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-3 pb-12">
        <div className="space-y-3 text-xs text-gray-200">
          <div className="flex rounded-lg border border-white/5 bg-white/4 p-1">
            {tabs.map((tab) => {
              const active = tab.id === viewMode;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setViewMode(tab.id)}
                  className={`relative flex-1 rounded-md px-3 py-1.5 text-xs transition-colors ${active ? "text-gray-100" : "text-gray-500 hover:text-gray-200"
                    }`}
                >
                  {active && (
                    <motion.span
                      layoutId="trace-view-tab"
                      className="absolute inset-0 rounded-md bg-white/8"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <motion.div
            key={viewMode}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-3"
          >
            {panel}
          </motion.div>

        </div>
      </div>
      <div className="flex gap-3 sticky bottom-0 bg-bg/80 backdrop-blur-xs pt-2">
        {showKeepViewing ? (
          <KeepViewingButton
            loading={loading}
            remainingMs={remainingMs}
            onClick={() => {
              setShowKeepViewing(false);
            }}
          />
        ) : (
          <TraceViewButton success={success} proceed={proceed} loading={loading} />
        )}
      </div>
    </>
  );
}