# Performance Audit Phase 3

Measured on 2026-06-01 from the local workspace against the configured Supabase PostgreSQL database.

## Instrumentation Added

- Frontend API timings: `[perf] api:response` and `[perf] api:error` in `mbile/src/lib/api.ts`.
- Frontend screen timings, render counts, and memory samples: `mbile/src/lib/performance.ts`.
- Screen probes:
  - `app:bootstrap:*` in `mbile/src/routes/__root.tsx`
  - `dashboard:*` in `mbile/src/routes/index.tsx`
  - `insights:*` in `mbile/src/routes/insights.tsx`
  - `roast:*` in `mbile/src/routes/roast.tsx`
  - `control:*` in `mbile/src/routes/control.tsx`
- Backend API timings: `[perf:api]` in `chaos-control-central/backend/server.js`.
- Backend query timings: `[perf:db]` in `chaos-control-central/backend/config/db.js`.
- Android blocker timing:
  - `perf should_block ... durationMicros=...` in `BlockingEngine.java`
  - `perf accessibility_event ... durationMicros=...` in `BlockAccessibilityService.java`

Enable frontend perf logs in production-like builds with:

```js
localStorage.setItem("last-puff-perf", "1")
```

## Current Timings

| Area | Measured Result | Notes |
| --- | ---: | --- |
| Backend cold startup schema phase | 12,945 ms | `ensureSchema()` against remote DB. This is server startup, not Android app cold start. |
| API health | 393 ms | Local Express to remote DB `/api/health`. |
| Dashboard API | 608 ms | `/api/stats/dashboard`, 1,662 bytes. |
| Activity API | 167 ms | `/api/activity/recent?limit=5`, 800 bytes. |
| Control/API apps | 688 ms | `/api/apps`, 649 bytes. |
| Insights/Roast API | 1,812 ms | `/api/analytics/roast`, 461 bytes. |
| Dashboard service only | 629 ms | `getDashboardData()`, 1,647 bytes. |
| Recent activity service only | 134 ms | `getRecentActivity()`, 779 bytes. |
| Apps service only | 669 ms | `getAppsData()`, 634 bytes. |
| Roast analytics service only | 2,021 ms | `getRoastAnalytics()`, 432 bytes. |
| Node memory start | 51 MB RSS / 9 MB heap | Service probe process. |
| After dashboard | 52 MB RSS / 9 MB heap | No meaningful growth. |
| After roast analytics | 54 MB RSS / 10 MB heap | Small growth, not a leak signal by itself. |

## Not Measured Yet

- Android cold start and warm start: no Android device was attached. `adb devices` returned an empty device list.
- Dashboard, Insights, and Control visual paint times in WebView/browser: no browser automation session was available in this run. The screen probes are now in place.
- Cigarette logging latency: not executed against production data because it would create a real cigarette log. The API/client instrumentation will capture this on the next real tap.
- Blocked app detection latency and AccessibilityService processing time: no attached Android device, so the Java timing logs could not be sampled.
- Largest React rerender sources: counters are now instrumented, but need a browser/WebView session to collect counts.

## Slowest Operations

1. `getRoastAnalytics()` / `/api/analytics/roast`: 1,812-2,021 ms.
2. `getAppsData()` / `/api/apps`: 669-688 ms.
3. `getDashboardData()` / `/api/stats/dashboard`: 608-629 ms.
4. Server startup schema bootstrap: 12,945 ms.

## Database Findings

EXPLAIN ANALYZE shows the database execution itself is fast:

| Query Family | DB Execution | Planning | Plan Root |
| --- | ---: | ---: | --- |
| Recent activity | 0.073 ms | 0.438 ms | Limit |
| Daily series | 0.245 ms | 0.489 ms | Sort |
| Monthly series | 0.185 ms | 0.174 ms | Sort |
| Cigarette totals | 0.067 ms | 0.115 ms | Aggregate |

The slow user-visible timings are not from table scans in these sampled plans. They come from remote DB round trips and query fan-out. Individual `pg` calls commonly measured 110-950 ms even when EXPLAIN execution was under 1 ms.

Slowest observed DB round trips:

- Monthly cigarette series: 954 ms.
- Blocked activity count/sum: 938 ms.
- Quit count: 917 ms.
- Active quit attempt: 909 ms.
- Cigarette totals: 908 ms.
- Longest quit duration: 905 ms.
- Levels query: 804-946 ms.
- Daily series: 798 ms.

## Root Causes

- Remote Supabase latency dominates. The sampled SQL plans are fast, but each networked query costs roughly 110 ms or more.
- Roast analytics still calls `syncUserState()`, which fans out many independent database queries. Even with `Promise.all`, the pool and remote round trips make it feel slow.
- `ensureUserBootstrap()` runs during read paths and performs multiple queries plus an update. This adds avoidable read latency.
- `ensureSchema()` runs during server startup and performs many DDL/index/seed operations, producing a measured 12.9 second cold backend start.
- `/api/apps` calls bootstrap before reading apps, which explains why a small 649-byte response still takes 688 ms.
- Client-side render and Android service bottlenecks could not be ranked without runtime samples; instrumentation is now present for the next device/browser run.

## Recommended Fixes

- Move `ensureSchema()` out of runtime startup into an explicit migration/deploy step.
- Remove `ensureUserBootstrap()` from hot reads. Run bootstrap at signup/login or as a background repair job.
- Stop calling `syncUserState()` from roast analytics reads. Serve roast from precomputed `user_stats` plus a small worst-day query, or precompute worst-day too.
- Collapse analytics snapshot reads into one SQL query or one materialized/precomputed row, because DB execution is cheap but each remote trip is expensive.
- Cache static levels in memory on the backend.
- Add a read-through cache for `/api/apps` and `/api/stats/dashboard` with short TTL plus mutation invalidation.
- Capture the new frontend `[perf]` logs on a real Android device to rank React rerenders, visual screen readiness, JS heap, and AccessibilityService latency.
