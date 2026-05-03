import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import type { RpcSpan } from "../../../lib/rpc/tracer";
import KeepViewingButton from "./KeepViewingButton";
import TimelineGroup from "./TimelineGroup";
import TraceViewButton from "./TraceViewButton";
import TreeNode from "./TreeNode";
import WaterfallRow from "./WaterfallRow";
import { formatDuration, KEEP_VIEWING_DURATION_MS } from "./traceViewUtils";

type ViewMode = "waterfall" | "timeline" | "tree";

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
  const clearAndProceed = () => {
    if (timerIdRef.current !== null) {
      window.clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
    proceed();
  };

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
        clearAndProceed();
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

    const minStart = traces.length
      ? Math.min(...traces.map((span) => span.startTime))
      : 0;
    const maxEnd = traces.length
      ? Math.max(...traces.map((span) => span.endTime ?? now))
      : now;
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
      return (
        <div className="rounded-lg border border-white/5 bg-white/4 px-3 py-3 text-xs text-gray-500">
          No trace data yet.
        </div>
      );
    }

    if (viewMode === "waterfall") {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2 text-xs text-gray-500">
            <span className="w-32 shrink-0 text-[10px]">Span</span>
            <span className="flex-1 text-[10px] border-l pl-2 border-l-white/5">
              Duration
            </span>
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
            <TimelineGroup
              key={root.id}
              root={root}
              childrenByParent={childrenByParent}
              now={now}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {rootSpans.map((root) => (
          <TreeNode
            key={root.id}
            span={root}
            now={now}
            childrenByParent={childrenByParent}
            depth={0}
          />
        ))}
      </div>
    );
  })();

  return (
    <>
      <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-3 pb-12">
        <div className="flex justify-between items-center gap-2">
          <div>
            <div className="text-xs font-medium text-gray-300">
              Execution Trace
            </div>
            <div className="text-[10px] text-gray-500">
              {traces.length} span{traces.length !== 1 ? "s" : ""}, total
              duration {formatDuration(totalDuration)}
            </div>
          </div>
          {success ? (
            <span className="rounded-full border border-green-500/30 bg-green-500/20 px-2 py-0.5 text-[10px] text-green-400">
              Success
            </span>
          ) : loading ? (
            <span className="rounded-full border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 text-[10px] text-blue-400">
              Processing
            </span>
          ) : (
            <span className="rounded-full border border-rose-500/30 bg-rose-500/20 px-2 py-0.5 text-[10px] text-rose-400">
              Error
            </span>
          )}
        </div>
        <div className="space-y-3 text-xs text-gray-200">
          <div className="flex rounded-lg border border-white/5 bg-white/4 p-1">
            {tabs.map((tab) => {
              const active = tab.id === viewMode;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setViewMode(tab.id)}
                  className={`relative flex-1 rounded-md px-3 py-1.5 text-xs transition-colors ${active ? "text-gray-100" : "text-gray-500 hover:text-gray-200"}`}
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
            remainingMs={remainingMs}
            onClick={() => {
              setShowKeepViewing(false);
            }}
          />
        ) : (
          <TraceViewButton
            success={success}
            proceed={clearAndProceed}
            loading={loading}
          />
        )}
      </div>
    </>
  );
}
