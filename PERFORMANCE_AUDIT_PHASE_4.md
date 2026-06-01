# Performance Optimization Phase 4 Report

Measured on 2026-06-01 against the local backend process connected to Supabase.

## Summary

| Metric | Before | After | Result |
| --- | ---: | ---: | --- |
| Dashboard API | ~608ms | 131ms | 78% faster |
| Control Apps API | ~688ms | 130ms | 81% faster |
| Roast API | ~1812ms | 129ms | 93% faster |
| Insights API | not separately provided | 127ms | under 500ms target |
| Backend available | ~12.9s | 611ms | under 3s target |
| Roast DB round trips | full snapshot fan-out + write + worst-day query | 1 query | fan-out removed |
| Control DB round trips | bootstrap + apps + schedule | 1 warm query | batched |
| Dashboard DB round trips | multiple bootstrap/read paths | 2 warm queries | reduced |
| Memory usage during measurement | not captured | RSS 53.5MB, heap used 9.7MB | no leak observed in run |
| Android cold start | no device attached | not measured | adb returned no devices |
| Android warm start | no device attached | not measured | adb returned no devices |
| Block detection latency | code hot path optimized, build passed | device latency not measured | adb returned no devices |

## Real Measurements

Command:

```bash
node chaos-control-central/backend/scripts/measure-phase4.js
```

Measured median of three warm authenticated requests:

| Endpoint | Duration | DB queries | Payload |
| --- | ---: | ---: | ---: |
| `/api/stats/dashboard` | 131ms | 2 | 727 bytes gzip |
| `/api/apps` | 130ms | 1 | 654 bytes |
| `/api/analytics/roast` | 129ms | 1 | 644 bytes |
| `/api/analytics/highlights` | 127ms | 2 | 662 bytes |

Startup availability:

```text
startupAvailableMs: 611
```

## Changes Made

- Added request-scoped DB tracing with query count, total DB time, and duplicate-query detection.
- Changed API perf logs to include DB query counts and duplicate query summaries.
- Moved schema/index/seed initialization out of the blocking startup path.
- Delayed background schema maintenance so early API requests are not blocked by startup DDL.
- Batched achievement and level seed upserts into single multi-row queries.
- Added precomputed analytics columns to `user_stats`.
- Updated `syncUserState` to store daily/monthly/trend/health/roast analytics.
- Changed Roast analytics to read precomputed values instead of rebuilding full snapshots during requests.
- Changed Roast highlights to parallelize analytics and blocked-log reads.
- Batched Control apps and schedule into one query.
- Added bootstrap caching for frequently accessed user defaults.
- Added async analytics refresh invalidation for schedule/preference changes.
- Batched radar scan inserts.
- Removed duplicate Android accessibility block checks on the hot path.

## Verification

- `node --check` passed for modified backend files.
- `npm run build` passed for `mbile`.
- `mbile/android/gradlew.bat assembleDebug` passed.
- `adb devices` returned no attached devices, so cold/warm start and real block latency could not be measured on hardware.

## Remaining Risk

- First authenticated request after a completely cold process can still include Supabase connection warmup. Warm endpoint timings are the user-visible steady-state numbers.
- Vite still reports chunk-size warnings and ineffective dynamic imports because generated route-tree imports are static.
