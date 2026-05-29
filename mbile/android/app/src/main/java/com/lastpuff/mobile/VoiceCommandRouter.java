package com.lastpuff.mobile;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.DecimalFormat;
import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public final class VoiceCommandRouter {
    private static final NumberFormat NUMBER_FORMAT = new DecimalFormat("#,##0");

    private VoiceCommandRouter() {}

    public static VoiceCommandOutcome resolve(String rawCommand, JSONObject cache, String assistantName) {
        String command = normalize(rawCommand);
        VoiceSnapshot snapshot = VoiceSnapshot.from(cache);

        if (command.isEmpty()) {
            return fallback(assistantName);
        }

        if (containsAny(command, "motivate me", "give me a reason not to smoke", "encourage me")) {
            return motivation(snapshot, assistantName);
        }

        if (containsAny(command, "how many cigarettes i smoked today", "how many cigarettes smoked today", "cigarettes i smoked today", "today cigarettes")) {
            return todaySmoking(snapshot);
        }

        if (containsAny(command, "how many cigarettes i smoked this week", "how many cigarettes smoked this week", "cigarettes i smoked this week", "this week smoking")) {
            return weeklySmoking(snapshot);
        }

        if (containsAny(command, "how many cigarettes are left today", "cigarettes left today", "how many cigarettes left")) {
            return cigarettesLeft(snapshot);
        }

        if (containsAny(command, "how many cigarettes i avoided today", "cigarettes avoided today", "how many cigarettes avoided")) {
            return avoidedToday(snapshot);
        }

        if (containsAny(command, "when was my last cigarette", "last cigarette", "how long since my last cigarette")) {
            return lastCigarette(snapshot, command.contains("how long"));
        }

        if (containsAny(command, "how much money i saved today", "money saved today", "saved today")) {
            return moneySavedToday(snapshot);
        }

        if (containsAny(command, "how much money i wasted today", "money wasted today", "wasted today")) {
            return moneyWastedToday(snapshot);
        }

        if (containsAny(command, "how much money i saved this week", "money saved this week", "saved this week")) {
            return moneySavedThisWeek(snapshot);
        }

        if (containsAny(command, "total money saved", "how much money have i saved", "money saved total")) {
            return totalMoneySaved(snapshot);
        }

        if (containsAny(command, "show today insights", "today insights", "how am i doing today", "show today stats")) {
            return todayInsights(snapshot, assistantName);
        }

        if (containsAny(command, "show my streak", "what is my streak", "current streak", "show streak")) {
            return streak(snapshot);
        }

        if (containsAny(command, "what is my progress", "show my progress", "progress")) {
            return progress(snapshot);
        }

        if (containsAny(command, "show today stats", "today stats", "show stats")) {
            return todayInsights(snapshot, assistantName);
        }

        return fallback(assistantName);
    }

    private static VoiceCommandOutcome todaySmoking(VoiceSnapshot snapshot) {
        String comparison;
        if (snapshot.dailyAverage > 0 && snapshot.todayCount <= snapshot.dailyAverage) {
            comparison = "That is below your usual baseline, so you are trending in the right direction.";
        } else if (snapshot.dailyAverage > 0) {
            comparison = "That is above your usual baseline, but the data is still moving you forward.";
        } else {
            comparison = "Keep going one choice at a time.";
        }

        return new VoiceCommandOutcome("You smoked " + snapshot.todayCount + " cigarettes today. " + comparison, "today-smoking");
    }

    private static VoiceCommandOutcome weeklySmoking(VoiceSnapshot snapshot) {
        String pace = snapshot.dailyAverage > 0
            ? "That averages about " + formatNumber(snapshot.dailyAverage) + " a day."
            : "I do not have a daily average yet, so this is based on your recent activity cache.";
        return new VoiceCommandOutcome("You smoked " + snapshot.weeklyCount + " cigarettes this week. " + pace, "weekly-smoking");
    }

    private static VoiceCommandOutcome cigarettesLeft(VoiceSnapshot snapshot) {
        int baseline = snapshot.dailyAverage > 0 ? Math.max(1, Math.round((float) snapshot.dailyAverage) ) : Math.max(1, snapshot.todayCount + 2);
        int remaining = Math.max(0, baseline - snapshot.todayCount);
        if (remaining == 0) {
            return new VoiceCommandOutcome("You are already at or below today's baseline. Nice work staying in control.", "cigarettes-left");
        }
        return new VoiceCommandOutcome("You have " + remaining + " cigarettes left against your current baseline of " + baseline + " for today.", "cigarettes-left");
    }

    private static VoiceCommandOutcome avoidedToday(VoiceSnapshot snapshot) {
        return new VoiceCommandOutcome("You avoided " + snapshot.avoidedToday + " cigarettes today. That is real progress.", "avoided-today");
    }

    private static VoiceCommandOutcome lastCigarette(VoiceSnapshot snapshot, boolean preferDuration) {
        if (snapshot.lastCigaretteAtMillis <= 0L) {
            return new VoiceCommandOutcome("I do not have a last cigarette timestamp yet.", "last-cigarette");
        }

        long elapsedSeconds = Math.max(0L, (System.currentTimeMillis() - snapshot.lastCigaretteAtMillis) / 1000L);
        String formattedTime = new SimpleDateFormat("h:mm a", Locale.getDefault()).format(new Date(snapshot.lastCigaretteAtMillis));
        if (preferDuration) {
            return new VoiceCommandOutcome("It has been " + formatDuration(elapsedSeconds) + " since your last cigarette at " + formattedTime + ".", "last-cigarette");
        }
        return new VoiceCommandOutcome("Your last cigarette was at " + formattedTime + ", about " + formatDuration(elapsedSeconds) + " ago.", "last-cigarette");
    }

    private static VoiceCommandOutcome moneySavedToday(VoiceSnapshot snapshot) {
        return new VoiceCommandOutcome(
            "You saved " + snapshot.currencySymbol + formatNumber(snapshot.todaySavings) + " today by avoiding " + snapshot.avoidedToday + " cigarettes.",
            "money-saved-today"
        );
    }

    private static VoiceCommandOutcome moneyWastedToday(VoiceSnapshot snapshot) {
        return new VoiceCommandOutcome(
            "You spent " + snapshot.currencySymbol + formatNumber(snapshot.moneyBurnedToday) + " on cigarettes today.",
            "money-wasted-today"
        );
    }

    private static VoiceCommandOutcome moneySavedThisWeek(VoiceSnapshot snapshot) {
        return new VoiceCommandOutcome("You saved " + snapshot.currencySymbol + formatNumber(snapshot.weeklySavings) + " this week.", "money-saved-week");
    }

    private static VoiceCommandOutcome totalMoneySaved(VoiceSnapshot snapshot) {
        return new VoiceCommandOutcome("You have saved " + snapshot.currencySymbol + formatNumber(snapshot.totalSavings) + " in total.", "money-saved-total");
    }

    private static VoiceCommandOutcome todayInsights(VoiceSnapshot snapshot, String assistantName) {
        String streakPart = snapshot.streak > 0 ? "Your streak is " + snapshot.streak + " days long." : "You are building your next streak now.";
        String spendingPart = "You saved " + snapshot.currencySymbol + formatNumber(snapshot.todaySavings) + " today and smoked " + snapshot.todayCount + " cigarettes.";
        String tail = assistantName + " is seeing steady progress from your latest sync.";
        return new VoiceCommandOutcome(spendingPart + " " + streakPart + " " + tail, "today-insights");
    }

    private static VoiceCommandOutcome streak(VoiceSnapshot snapshot) {
        if (snapshot.streak <= 0) {
            return new VoiceCommandOutcome("You do not have an active streak yet, but today is a fresh chance to start one.", "streak");
        }
        return new VoiceCommandOutcome("Your streak is " + snapshot.streak + " days strong. Keep it going.", "streak");
    }

    private static VoiceCommandOutcome progress(VoiceSnapshot snapshot) {
        int percent = snapshot.progressPercent > 0 ? snapshot.progressPercent : Math.min(100, Math.max(0, snapshot.score));
        return new VoiceCommandOutcome(
            "You are at " + percent + " percent progress. You have already avoided " + snapshot.avoidedTotal + " cigarettes overall.",
            "progress"
        );
    }

    private static VoiceCommandOutcome motivation(VoiceSnapshot snapshot, String assistantName) {
        List<String> lines = new ArrayList<>();
        lines.add("You have saved " + snapshot.currencySymbol + formatNumber(snapshot.totalSavings) + " so far.");
        if (snapshot.streak > 0) {
            lines.add("Your " + snapshot.streak + "-day streak is protecting the momentum you have built.");
        } else {
            lines.add("Every cigarette skipped today helps you start a cleaner streak tomorrow.");
        }
        lines.add(assistantName + " believes the strongest move is the next smoke-free choice.");
        return new VoiceCommandOutcome(String.join(" ", lines), "motivation");
    }

    private static VoiceCommandOutcome fallback(String assistantName) {
        return new VoiceCommandOutcome(
            "I did not understand that. Try asking " + assistantName + " about smoking stats, money saved, streaks, or motivation.",
            "fallback"
        );
    }

    private static boolean containsAny(String command, String... phrases) {
        for (String phrase : phrases) {
            if (command.contains(phrase)) {
                return true;
            }
        }
        return false;
    }

    private static String normalize(String command) {
        return command == null ? "" : command.trim().toLowerCase(Locale.US).replaceAll("[^a-z0-9\\s]", " ").replaceAll("\\s+", " ").trim();
    }

    private static String formatNumber(double value) {
        return NUMBER_FORMAT.format(Math.round(value));
    }

    private static String formatDuration(long seconds) {
        long hours = seconds / 3600L;
        long minutes = (seconds % 3600L) / 60L;
        long remainingSeconds = seconds % 60L;

        List<String> parts = new ArrayList<>();
        if (hours > 0) {
            parts.add(hours + (hours == 1 ? " hour" : " hours"));
        }
        if (minutes > 0) {
            parts.add(minutes + (minutes == 1 ? " minute" : " minutes"));
        }
        if (parts.isEmpty() || remainingSeconds > 0) {
            parts.add(remainingSeconds + (remainingSeconds == 1 ? " second" : " seconds"));
        }
        return String.join(" and ", parts);
    }

    private static final class VoiceSnapshot {
        final int todayCount;
        final int weeklyCount;
        final double todaySavings;
        final double weeklySavings;
        final double totalSavings;
        final int avoidedToday;
        final int avoidedTotal;
        final double moneyBurnedToday;
        final long lastCigaretteAtMillis;
        final int streak;
        final int progressPercent;
        final int score;
        final double dailyAverage;
        final String currencySymbol;

        private VoiceSnapshot(
            int todayCount,
            int weeklyCount,
            double todaySavings,
            double weeklySavings,
            double totalSavings,
            int avoidedToday,
            int avoidedTotal,
            double moneyBurnedToday,
            long lastCigaretteAtMillis,
            int streak,
            int progressPercent,
            int score,
            double dailyAverage,
            String currencySymbol
        ) {
            this.todayCount = todayCount;
            this.weeklyCount = weeklyCount;
            this.todaySavings = todaySavings;
            this.weeklySavings = weeklySavings;
            this.totalSavings = totalSavings;
            this.avoidedToday = avoidedToday;
            this.avoidedTotal = avoidedTotal;
            this.moneyBurnedToday = moneyBurnedToday;
            this.lastCigaretteAtMillis = lastCigaretteAtMillis;
            this.streak = streak;
            this.progressPercent = progressPercent;
            this.score = score;
            this.dailyAverage = dailyAverage;
            this.currencySymbol = currencySymbol;
        }

        static VoiceSnapshot from(JSONObject cache) {
            JSONObject dashboard = cache != null ? cache.optJSONObject("dashboard") : null;
            JSONObject analytics = cache != null ? cache.optJSONObject("analytics") : null;
            JSONArray activity = cache != null ? cache.optJSONArray("activity") : null;
            JSONObject level = dashboard != null ? dashboard.optJSONObject("level") : null;
            JSONObject stats = dashboard != null ? dashboard.optJSONObject("stats") : null;
            JSONObject savings = dashboard != null ? dashboard.optJSONObject("savings") : null;
            JSONObject smokeFree = dashboard != null ? dashboard.optJSONObject("smokeFree") : null;
            JSONObject streakObject = dashboard != null ? dashboard.optJSONObject("streak") : null;
            JSONObject dailyStatus = dashboard != null ? dashboard.optJSONObject("dailyStatus") : null;

            int todayCount = stats != null ? stats.optInt("todayCount", 0) : 0;
            double dailyAverage = stats != null ? stats.optDouble("dailySmokingAverage", 0) : 0;
            int avoidedToday = savings != null ? savings.optInt("avoidedToday", 0) : 0;
            int avoidedTotal = savings != null ? savings.optInt("avoidedTotal", 0) : 0;
            double todaySavings = savings != null ? savings.optDouble("today", 0) : 0;
            double weeklySavings = savings != null ? savings.optDouble("weekly", 0) : 0;
            double totalSavings = savings != null ? savings.optDouble("total", 0) : 0;
            double moneyBurnedToday = stats != null ? stats.optDouble("moneyBurned", 0) : 0;
            int streak = streakObject != null ? streakObject.optInt("current", 0) : 0;
            int progressPercent = level != null ? level.optInt("progressPercent", 0) : 0;
            int score = dailyStatus != null ? dailyStatus.optInt("score", 0) : 0;
            String currencySymbol = analytics != null ? analytics.optString("currencySymbol", "Rs") : "Rs";
            long lastCigaretteAtMillis = parseLastCigaretteAtMillis(smokeFree, activity);
            int weeklyCount = resolveWeeklyCount(todayCount, dailyAverage, activity);

            return new VoiceSnapshot(
                todayCount,
                weeklyCount,
                todaySavings,
                weeklySavings,
                totalSavings,
                avoidedToday,
                avoidedTotal,
                moneyBurnedToday,
                lastCigaretteAtMillis,
                streak,
                progressPercent,
                score,
                dailyAverage,
                currencySymbol
            );
        }

        private static long parseLastCigaretteAtMillis(JSONObject smokeFree, JSONArray activity) {
            if (smokeFree != null) {
                String startedAt = smokeFree.optString("startedAt", null);
                long parsed = parseIsoMillis(startedAt);
                if (parsed > 0L) {
                    return parsed;
                }
            }

            if (activity != null) {
                for (int index = 0; index < activity.length(); index++) {
                    JSONObject item = activity.optJSONObject(index);
                    if (item == null) {
                        continue;
                    }

                    String title = item.optString("title", "");
                    String description = item.optString("description", "");
                    String combined = (title + " " + description).toLowerCase(Locale.US);
                    if (combined.contains("cigarette")) {
                        long parsed = parseIsoMillis(item.optString("created_at", null));
                        if (parsed > 0L) {
                            return parsed;
                        }
                    }
                }
            }

            return 0L;
        }

        private static int resolveWeeklyCount(int todayCount, double dailyAverage, JSONArray activity) {
            int activityCount = 0;
            if (activity != null) {
                long weekAgo = System.currentTimeMillis() - (7L * 24L * 60L * 60L * 1000L);
                for (int index = 0; index < activity.length(); index++) {
                    JSONObject item = activity.optJSONObject(index);
                    if (item == null) {
                        continue;
                    }

                    String title = item.optString("title", "");
                    String description = item.optString("description", "");
                    String combined = (title + " " + description).toLowerCase(Locale.US);
                    if (!combined.contains("cigarette")) {
                        continue;
                    }

                    long createdAt = parseIsoMillis(item.optString("created_at", null));
                    if (createdAt == 0L || createdAt >= weekAgo) {
                        activityCount++;
                    }
                }
            }

            if (activityCount > 0) {
                return activityCount;
            }

            if (dailyAverage > 0) {
                return Math.max(todayCount, Math.round((float) (dailyAverage * 7.0)));
            }

            return todayCount;
        }

        private static long parseIsoMillis(String value) {
            if (value == null || value.trim().isEmpty()) {
                return 0L;
            }

            try {
                String normalized = value.endsWith("Z") ? value : value + "Z";
                return java.time.Instant.parse(normalized).toEpochMilli();
            } catch (Exception exception) {
                return 0L;
            }
        }
    }
}
