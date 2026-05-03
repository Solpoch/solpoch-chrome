import type { RpcSpan } from "../../../lib/rpc/tracer";
import SectionCard from "../popup/signAndSendTransaction/SectionCard";
import TimelineEventDot from "./TimelineEventDot";
import TimelineSpan from "./TimelineSpan";
import {
  formatDuration,
  getSpanDuration,
  normalizeEvents,
  statusLabel,
} from "./traceViewUtils";

export default function TimelineGroup({
  root,
  childrenByParent,
  now,
}: {
  root: RpcSpan;
  childrenByParent: Map<string, RpcSpan[]>;
  now: number;
}) {
  const directChildren = childrenByParent.get(root.id) ?? [];
  const events = [...normalizeEvents(root.events)].sort(
    (left, right) => left.time - right.time,
  );
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
            <div className="text-xs text-gray-500">
              {statusLabel(root.status)}
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
            {formatDuration(getSpanDuration(root, now))}
          </span>
        </div>
      </div>

      <div className="space-y-2 px-3 py-3">
        {events.length ? (
          events.map((event, index) => {
            const hasDoneChild =
              buckets[index]?.some((child) => child.status !== "pending") ??
              false;
            const hasPendingChild =
              buckets[index]?.some((child) => child.status === "pending") ??
              false;

            return (
              <div key={`${event.time}-${index}`} className="space-y-2">
                <div className="flex items-start gap-2">
                  <TimelineEventDot
                    active={
                      hasPendingChild ||
                      (root.status === "pending" && index === events.length - 1)
                    }
                    done={hasDoneChild}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-gray-400">{event.message}</div>
                    <div className="text-[10px] text-gray-500">
                      {formatDuration(event.time - root.startTime)}
                    </div>
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
