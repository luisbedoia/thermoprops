import { useEffect, useRef, useState } from "react";
import type { ScriptResult } from "./evaluate";
import type { ScriptRequest } from "./worker";

type Reply =
  | { id: number; result: ScriptResult }
  | { id: number; unchanged: true }
  | { id: number; error: string };

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, (reply: Reply) => void>();

function run(source: string, fresh: boolean): Promise<Reply> {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
      name: "script",
    });
    worker.onmessage = (e: MessageEvent<Reply>) => {
      pending.get(e.data.id)?.(e.data);
      pending.delete(e.data.id);
    };
  }
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    worker!.postMessage({ id, source, fresh } satisfies ScriptRequest);
  });
}

/** How long an evaluation may take before the page says it is working. */
const SLOW_MS = 400;

/**
 * The evaluated script, `delay` ms after the last edit. The previous result
 * stays until the new one arrives, and stays the same object when the new
 * one is equal, so nothing downstream redraws for a comment.
 */
export function useScript(source: string, delay = 100) {
  const [answer, setAnswer] = useState<{
    source: string;
    result?: ScriptResult;
    error?: string;
    ms?: number;
  } | null>(null);
  const [slowFor, setSlowFor] = useState<string | null>(null);
  const hasResult = useRef(false);

  useEffect(() => {
    let current = true;
    const slow = setTimeout(() => setSlowFor(source), delay + SLOW_MS);
    const timer = setTimeout(() => {
      const start = performance.now();
      void run(source, !hasResult.current).then((reply) => {
        if (!current) return;
        if ("result" in reply) hasResult.current = true;
        clearTimeout(slow);
        const ms = performance.now() - start;
        setAnswer((prev) =>
          "unchanged" in reply
            ? { ...prev, source, ms }
            : "result" in reply
              ? { source, result: reply.result, ms }
              : { source, error: reply.error, ms },
        );
      });
    }, delay);
    return () => {
      current = false;
      clearTimeout(timer);
      clearTimeout(slow);
    };
  }, [source, delay]);

  const pending = answer?.source !== source;
  return {
    result: answer?.result,
    error: answer?.error,
    /** Round trip of the last evaluation, worker included. */
    ms: answer?.ms,
    /** The shown result is not of the current text yet. */
    pending,
    /** …and has not been for a while: worth a spinner. */
    slow: pending && slowFor === source,
  };
}
