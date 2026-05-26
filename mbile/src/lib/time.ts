import { useEffect, useState } from "react";

export function formatSmokeFree(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${hours}h ${minutes}m ${remainingSeconds}s`;
}

export function formatLongDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function useSmokeFreeTicker(startedAt: string | null) {
  const getValue = () => {
    if (!startedAt) {
      return 0;
    }

    return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  };

  const [seconds, setSeconds] = useState(getValue);

  useEffect(() => {
    setSeconds(getValue());

    if (!startedAt) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setSeconds(getValue());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [startedAt]);

  return seconds;
}
