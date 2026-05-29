import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAppStore } from "@/lib/app-store";
import { queryKeys } from "@/lib/query-keys";
import { connectRealtime } from "@/lib/realtime";

let realtimeConnection: { disconnect: () => void } | null = null;

export function LiveSync() {
  const queryClient = useQueryClient();
  const token = useAppStore((state) => state.auth.token);
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      realtimeConnection?.disconnect();
      realtimeConnection = null;
      return undefined;
    }

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

    realtimeConnection = connectRealtime(token, {
      onMessage: (message) => {
        if (message.type === "user:refresh") {
          invalidateAll();
        }
      },
    });

    return () => {
      realtimeConnection?.disconnect();
      realtimeConnection = null;
    };
  }, [isAuthenticated, queryClient, token]);

  return null;
}
