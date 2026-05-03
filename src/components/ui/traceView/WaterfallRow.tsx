import { motion } from "motion/react";
import { ArrowBendDownRightIcon } from "@phosphor-icons/react/dist/ssr";
import type { RpcSpan } from "../../../lib/rpc/tracer";
import {
  formatTimeOffset,
  getSpanBarClass,
  getSpanDuration,
  statusLabel,
} from "./traceViewUtils";

export default function WaterfallRow({
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
  const leftPercent =
    totalDuration > 0 ? ((span.startTime - minStart) / totalDuration) * 100 : 0;
  const widthPercent =
    totalDuration > 0 ? Math.max((duration / totalDuration) * 100, 0.8) : 0.8;
  const children = childrenByParent.get(span.id) ?? [];
  const isActive = span.status === "pending";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {depth > 0 && (
          <div
            className="min-w-0 shrink-0 h-full flex justify-center items-center"
            style={{ width: `${depth * 10}px` }}
          >
            <ArrowBendDownRightIcon size={12} className="text-gray-400" />
          </div>
        )}
        <div className="shrink-0 w-32">
          <div className="truncate text-xs font-medium text-gray-100">
            {span.method}
          </div>
          <div className="text-[10px] text-gray-500">
            {statusLabel(span.status)}
          </div>
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
            <span className="truncate text-[10px] text-gray-950">
              {formatTimeOffset(duration)}
            </span>
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
