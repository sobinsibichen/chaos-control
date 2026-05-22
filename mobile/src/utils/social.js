const traits = [
  "Trying to quit",
  "One last cigarette",
  "Weekend chaos",
  "Late-night spiral",
  "Budget emergency",
  "Calibration needed",
];

const moods = ["Restless", "Optimistic", "Regretful", "Hyperaware", "Suspicious", "Unstable"];

export function generateNearbySmokers() {
  return Array.from({ length: 6 }).map((_, index) => ({
    id: `nearby-${index + 1}`,
    username: `User_${420 + index * 7}`,
    avatar: String.fromCharCode(65 + index),
    distanceMeters: 60 + index * 45,
    status: traits[index % traits.length],
    mood: moods[index % moods.length],
    chaosLevel: 3 + (index % 5),
    online: index % 3 !== 0,
  }));
}
