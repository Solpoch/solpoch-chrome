import type { RpcSpan } from "../../../../lib/rpc/tracer";

export default function TraceView({
  traces,
  success,
  proceed,
}: {
  traces: RpcSpan[];
  success: boolean;
  proceed: () => void;
}) {
  return (
    <div>
      {traces.map((trace) => (
        <div key={trace.id} className="mb-4 p-2 border rounded">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`h-3 w-3 rounded-full ${trace.status === "pending"
                ? "bg-yellow-500 animate-pulse"
                : trace.status === "success"
                  ? "bg-green-500"
                  : "bg-red-500"
                }`}
            />
            <span className="font-mono text-sm">{trace.method}</span>
          </div>
          {trace.attributes && (
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
              {JSON.stringify(trace.attributes, null, 2)}
            </pre>
          )}
          {trace.events && (
            <div className="mt-2">
              {trace.events.map((event, idx) => (
                <div key={idx} className="text-xs text-gray-500">
                  [{((event.time - trace.startTime) / 1000).toFixed(2)}s]{" "}
                  {event.message}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <button onClick={proceed} className={`bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded ${success ? "" : "bg-red-500 hover:bg-red-600"}`}>
        View Details
      </button>
    </div>
  )
}