export interface RpcSpan {
  traceId: string; // for whole flow - to create a tree structure in UI

  id: string; // unique id for this span
  parentId?: string; // to link to parent span, if any

  method: string;
  startTime: number;
  endTime?: number;

  status: "pending" | "success" | "error";
  result?: any;
  error?: any;
  attributes?: Record<string, any>;
  events?: {
    time: number;
    message: string;
  }[];
};


export type TraceContext = {
  traceId: string;
  parentId?: string;
};

type TraceListener = (trace: RpcSpan) => void;

export class RpcTracer {
  private static traces = new Map<string, RpcSpan>();
  private static listeners = new Set<TraceListener>();

  static subscribe(listener: TraceListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private static emit(trace: RpcSpan) {
    this.listeners.forEach((l) => l(trace));
  }

  static addEvent(spanId: string, message: string) {
    const span = this.traces.get(spanId);
    if (!span) return;

    if (!span.events) span.events = [];

    span.events.push({
      time: performance.now(),
      message,
    });

    this.emit(structuredClone(span));
  }

  static start(method: string, attributes?: Record<string, any>, ctx?: TraceContext): RpcSpan {
    const isRoot = !ctx;
    const trace: RpcSpan = {
      id: crypto.randomUUID(),
      method,
      attributes,
      startTime: performance.now(),
      status: "pending",
      traceId: isRoot ? crypto.randomUUID() : ctx.traceId,
      parentId: ctx?.parentId,
    };

    this.traces.set(trace.id, trace);
    this.emit(trace);

    return trace;
  }

  static success(id: string, result: any) {
    const trace = this.traces.get(id);
    if (!trace) return;

    trace.status = "success";
    trace.endTime = performance.now();
    trace.result = result;

    this.emit(trace);
  }

  static error(id: string, error: any) {
    const trace = this.traces.get(id);
    if (!trace) return;

    trace.status = "error";
    trace.endTime = performance.now();
    trace.error = error;

    this.emit(trace);
  }
}