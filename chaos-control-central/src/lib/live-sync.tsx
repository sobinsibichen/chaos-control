import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { useAppStore } from "@/lib/app-store";
import { API_URL } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

let socket: Socket | null = null;

export function LiveSync() {
  const queryClient = useQueryClient();
  const token = useAppStore((state) => state.auth.token);
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      socket?.disconnect();
      socket = null;
      return undefined;
    }

    socket = io(API_URL, {
      auth: { token },
      transports: ["websocket"],
    });

    const invalidateAll = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activity });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      void queryClient.invalidateQueries({ queryKey: queryKeys.achievements });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics });
      void queryClient.invalidateQueries({ queryKey: queryKeys.highlights });
      void queryClient.invalidateQueries({ queryKey: queryKeys.apps });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nearby });
    };

    socket.on("user:refresh", invalidateAll);

    return () => {
      socket?.off("user:refresh", invalidateAll);
      socket?.disconnect();
      socket = null;
    };
  }, [isAuthenticated, queryClient, token]);

  return null;
}
