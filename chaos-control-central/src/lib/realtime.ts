import { API_URL } from "@/lib/api";

export interface RealtimeMessage {
  type?: string;
  event?: string;
  payload?: unknown;
  message?: string;
}

interface RealtimeHandlers {
  onOpen?: () => void;
  onMessage?: (message: RealtimeMessage) => void;
  onClose?: () => void;
}

function buildRealtimeUrl(token: string) {
  const url = new URL(API_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/realtime";
  url.searchParams.set("token", token);
  return url.toString();
}

export function connectRealtime(token: string, handlers: RealtimeHandlers = {}) {
  let socket: WebSocket | null = null;
  let shouldReconnect = true;
  let reconnectTimer: number | null = null;

  const clearReconnectTimer = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const connect = () => {
    if (!shouldReconnect) {
      return;
    }

    socket = new WebSocket(buildRealtimeUrl(token));

    socket.onopen = () => {
      handlers.onOpen?.();
    };

    socket.onmessage = (event) => {
      try {
        handlers.onMessage?.(JSON.parse(String(event.data)) as RealtimeMessage);
      } catch {
        // Ignore malformed realtime payloads.
      }
    };

    socket.onclose = () => {
      handlers.onClose?.();

      if (!shouldReconnect) {
        return;
      }

      clearReconnectTimer();
      reconnectTimer = window.setTimeout(connect, 1500);
    };
  };

  connect();

  return {
    disconnect() {
      shouldReconnect = false;
      clearReconnectTimer();
      socket?.close();
      socket = null;
    },
  };
}
