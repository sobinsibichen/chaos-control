import { useEffect, useRef } from "react";

const enabled =
  typeof window !== "undefined" &&
  (import.meta.env.DEV || window.localStorage.getItem("last-puff-perf") === "1");

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function perfLog(name: string, data: Record<string, unknown> = {}) {
  if (!enabled) {
    return;
  }

  console.info("[perf]", name, {
    at: Math.round(now()),
    ...data,
  });
}

export function useScreenPerformance(screenName: string, ready: boolean) {
  const startRef = useRef(now());
  const reportedReadyRef = useRef(false);

  useEffect(() => {
    startRef.current = now();
    reportedReadyRef.current = false;
    perfLog(`${screenName}:mount`);
    return () => perfLog(`${screenName}:unmount`, { lifetimeMs: Math.round(now() - startRef.current) });
  }, [screenName]);

  useEffect(() => {
    if (!ready || reportedReadyRef.current) {
      return;
    }

    reportedReadyRef.current = true;
    perfLog(`${screenName}:ready`, { durationMs: Math.round(now() - startRef.current) });
  }, [ready, screenName]);
}

export function useRenderCounter(componentName: string) {
  const renders = useRef(0);
  renders.current += 1;

  useEffect(() => {
    if (renders.current === 1 || renders.current % 10 === 0) {
      perfLog(`${componentName}:render`, { count: renders.current });
    }
  });
}

export function sampleMemory(label: string) {
  if (!enabled || typeof performance === "undefined") {
    return;
  }

  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  if (!memory) {
    perfLog(`${label}:memory`, { available: false });
    return;
  }

  perfLog(`${label}:memory`, {
    usedMb: Math.round(memory.usedJSHeapSize / 1024 / 1024),
    totalMb: Math.round(memory.totalJSHeapSize / 1024 / 1024),
    limitMb: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
  });
}
