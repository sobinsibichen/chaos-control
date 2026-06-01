import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { queryCacheTimes } from "@/lib/query-cache";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        staleTime: queryCacheTimes.dashboard.staleTime,
        gcTime: queryCacheTimes.dashboard.gcTime,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
      mutations: {
        retry: 1,
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
