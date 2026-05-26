import type { NearbySmoker } from "@/lib/app-store";

const statuses = [
  "Currently regretting life.",
  "Counting coins for nicotine.",
  "Outside pretending to be fine.",
  "On a terrace making bad choices.",
  "Emotionally buffering near the hostel gate.",
  "One lighter away from healing.",
];

const moods = [
  "life collapsing rn",
  "chai-compatible",
  "post-meeting ruin",
  "night-shift feral",
  "just one last cig liar",
  "romantically unwell",
];

const names = [
  "Rohan_420",
  "AnanyaAsh",
  "Karan_404",
  "NicotineNinja",
  "BalconyGhost",
  "Exhale.exe",
  "DartDealer",
  "SadSuttaClub",
];

const avatars = ["R", "A", "K", "N", "B", "E", "D", "S"];

export function generateNearbySmokers(): NearbySmoker[] {
  return names.slice(0, 5 + Math.floor(Math.random() * 3)).map((username, index) => ({
    id: `${username.toLowerCase()}-${index}`,
    username,
    avatar: avatars[index] ?? username.slice(0, 1),
    distanceMeters: 8 + Math.floor(Math.random() * 210),
    status: statuses[Math.floor(Math.random() * statuses.length)]!,
    mood: moods[Math.floor(Math.random() * moods.length)]!,
    chaosLevel: 45 + Math.floor(Math.random() * 54),
    online: Math.random() > 0.28,
  }));
}

export const fakeReplies = [
  "bro got lighter?",
  "last cigarette fr",
  "outside hostel?",
  "life collapsing rn",
  "need chai and a bad decision",
  "roof access unlocked?",
];
