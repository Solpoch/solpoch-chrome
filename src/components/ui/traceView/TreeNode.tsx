import type { RpcSpan } from "../../../lib/rpc/tracer";
import Collapsible from "../layout/Collapsible";
import Row from "../popup/signAndSendTransaction/Row";
import {
  formatDuration,
  getColorForStatus,
  getSpanDuration,
  normalizeEvents,
  safeJson,
  statusLabel,
} from "./traceViewUtils";

export default function TreeNode({
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
  const events = normalizeEvents(span.events);

  return (
    <Collapsible
      defaultOpen={depth === 0}
      title={
        <div className="flex min-w-0 items-center gap-3 text-left">
          <span className="truncate text-xs text-gray-100">{span.method}</span>
          <span
            className={`rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-${getColorForStatus(span.status)}-400`}
          >
            {formatDuration(duration)}
          </span>
        </div>
      }
      className="rounded-lg border border-white/5 bg-white/4"
      headerClassName="rounded-none px-3 py-2 hover:bg-white/5"
      contentClassName="border-t border-white/5 p-3 pt-0"
    >
      <div className="flex flex-col">
        <Row
          label="Status"
          value={statusLabel(span.status)}
          accent={
            span.status === "error"
              ? "red"
              : span.status === "success"
                ? "green"
                : "neutral"
          }
        />
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
            {events.length ? (
              events.map((event, index) => (
                <div key={`${event.time}-${index}`} className="text-xs text-gray-300">
                  <span className="text-gray-500">
                    [{formatDuration(event.time - span.startTime)}]
                  </span>{" "}
                  {event.message}
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
                <TreeNode
                  key={child.id}
                  span={child}
                  now={now}
                  childrenByParent={childrenByParent}
                  depth={depth + 1}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Collapsible>
  );
}
