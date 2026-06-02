import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function queryRetryDelay(attemptIndex: number) {
  return Math.min(1200 * 2 ** attemptIndex, 10_000);
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 3,
        retryDelay: queryRetryDelay,
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnMount: false,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 1,
        retryDelay: queryRetryDelay,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
