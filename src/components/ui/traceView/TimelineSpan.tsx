import { ArrowBendDownRightIcon } from "@phosphor-icons/react/dist/ssr";
import type { RpcSpan } from "../../../lib/rpc/tracer";
import {
  formatDuration,
  getColorForStatus,
  getSpanDuration,
  statusLabel,
} from "./traceViewUtils";

export default function TimelineSpan({
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
      <div
        className="flex items-start gap-2"
        style={{ paddingLeft: `${depth * 10}px` }}
      >
        <ArrowBendDownRightIcon size={12} className="text-gray-400" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`truncate text-xs ${isActive ? "text-gray-100" : "text-gray-200"}`}
            >
              {span.method}
            </span>
            {isActive && (
              <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-100">
                Live
              </span>
            )}
            {!isActive && (
              <span
                className={`rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-${getColorForStatus(span.status)}-400`}
              >
                {formatDuration(duration)}
              </span>
            )}
          </div>
          <div className="text-[10px] text-gray-500">
            {statusLabel(span.status)}
          </div>
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
