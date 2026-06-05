import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo } from "react";
import { API_BASE_URL } from "@/lib/api";
import { useAppStore } from "@/lib/app-store";
import { queryKeys } from "@/lib/query-keys";

type RealtimeMessage =
  | { type: "ready"; payload?: Record<string, unknown> }
  | { type: "pong"; payload?: { timestamp?: string } }
  | { type: "user:refresh"; payload?: Record<string, unknown> & { recentActivity?: unknown[] } }
  | { type: "social:event"; event?: string; payload?: Record<string, unknown> }
  | { type: "error"; payload?: { message?: string } };

type RealtimeEventHandler = (message: RealtimeMessage) => void;

class WebSocketManager {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private reconnectAttempt = 0;
  private shouldReconnect = false;
  private queue: string[] = [];
  private listeners = new Set<RealtimeEventHandler>();

  connect(token: string) {
    if (typeof window === "undefined") {
      return;
    }

    if (this.token === token && this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.disconnect();
    this.token = token;
    this.shouldReconnect = true;
    this.open();
  }

  disconnect() {
    this.shouldReconnect = false;
    this.token = null;
    this.clearHeartbeat();
    this.clearReconnect();
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }
  }

  subscribe(listener: RealtimeEventHandler) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  send(message: Record<string, unknown>) {
    const encoded = JSON.stringify(message);
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.queue.push(encoded);
      return;
    }
    this.socket.send(encoded);
  }

  private open() {
    if (!this.token || typeof window === "undefined") {
      return;
    }

    const wsBase = API_BASE_URL.replace(/^http/i, "ws");
    const url = `${wsBase}/realtime?token=${encodeURIComponent(this.token)}`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.flushQueue();
      this.startHeartbeat();
    };

    this.socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as RealtimeMessage;
        if (parsed.type === "pong") {
          return;
        }
        this.listeners.forEach((listener) => listener(parsed));
      } catch {
        this.listeners.forEach((listener) => listener({ type: "error", payload: { message: "Realtime payload could not be decoded." } }));
      }
    };

    this.socket.onclose = () => {
      this.clearHeartbeat();
      this.socket = null;
      if (!this.shouldReconnect) {
        return;
      }
      const delay = Math.min(15000, 1000 * 2 ** this.reconnectAttempt);
      this.reconnectAttempt += 1;
      this.clearReconnect();
      this.reconnectTimer = window.setTimeout(() => this.open(), delay);
    };

    this.socket.onerror = () => {
      this.socket?.close();
    };
  }

  private flushQueue() {
    while (this.queue.length && this.socket?.readyState === WebSocket.OPEN) {
      const payload = this.queue.shift();
      if (payload) {
        this.socket.send(payload);
      }
    }
  }

  private startHeartbeat() {
    this.clearHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      this.send({ type: "ping", timestamp: new Date().toISOString() });
    }, 20000);
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearReconnect() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

const realtimeManager = new WebSocketManager();
const RealtimeContext = createContext<WebSocketManager>(realtimeManager);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const token = useAppStore((state) => state.auth.token);
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);
  const userId = useAppStore((state) => state.auth.user?.id);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      realtimeManager.disconnect();
      return;
    }

    realtimeManager.connect(token);
    return () => {
      realtimeManager.disconnect();
    };
  }, [isAuthenticated, token]);

  useEffect(() => {
    return realtimeManager.subscribe((message) => {
      if (message.type === "user:refresh") {
        if (Array.isArray(message.payload?.recentActivity)) {
          queryClient.setQueryData(queryKeys.activity, {
            success: true,
            activity: message.payload.recentActivity,
          });
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
        void queryClient.invalidateQueries({ queryKey: queryKeys.activity });
        void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
        void queryClient.invalidateQueries({ queryKey: queryKeys.achievements });
        void queryClient.invalidateQueries({ queryKey: queryKeys.analytics });
        void queryClient.invalidateQueries({ queryKey: ["cigarettes", "history"] });
        void queryClient.invalidateQueries({ queryKey: queryKeys.highlights });
        void queryClient.invalidateQueries({ queryKey: queryKeys.apps });
        void queryClient.invalidateQueries({ queryKey: queryKeys.nearby });
        void queryClient.invalidateQueries({ queryKey: queryKeys.smokeDna });
        void queryClient.invalidateQueries({ queryKey: queryKeys.smokeReplayHistory });
        void queryClient.invalidateQueries({ queryKey: queryKeys.cravingHistory });
        void queryClient.invalidateQueries({ queryKey: queryKeys.cravingLive });
        void queryClient.invalidateQueries({ queryKey: queryKeys.voiceCommands });
        void queryClient.invalidateQueries({ queryKey: queryKeys.favoriteStores(userId) });
      }
    });
  }, [queryClient, userId]);

  const value = useMemo(() => realtimeManager, []);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
