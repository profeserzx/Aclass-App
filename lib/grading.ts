// Standard KCSE-style 12-point grading scale, based on percentage score.
// Used purely for display — the stored score/maxScore stay the source of truth.
const SCALE: { min: number; letter: string; points: number }[] = [
  { min: 80, letter: "A", points: 12 },
  { min: 75, letter: "A-", points: 11 },
  { min: 70, letter: "B+", points: 10 },
  { min: 65, letter: "B", points: 9 },
  { min: 60, letter: "B-", points: 8 },
  { min: 55, letter: "C+", points: 7 },
  { min: 50, letter: "C", points: 6 },
  { min: 45, letter: "C-", points: 5 },
  { min: 40, letter: "D+", points: 4 },
  { min: 35, letter: "D", points: 3 },
  { min: 30, letter: "D-", points: 2 },
  { min: 0, letter: "E", points: 1 },
];

export function kcseGrade(percentage: number): { letter: string; points: number } {
  const clamped = Math.max(0, Math.min(100, percentage));
  const match = SCALE.find((tier) => clamped >= tier.min);
  return match ?? { letter: "E", points: 1 };
}

export function meanGrade(pointsList: number[]): { letter: string; points: number } | null {
  if (pointsList.length === 0) return null;
  const avg = pointsList.reduce((sum, p) => sum + p, 0) / pointsList.length;
  // Find the closest scale tier to the average point value.
  const closest = SCALE.reduce((best, tier) =>
    Math.abs(tier.points - avg) < Math.abs(best.points - avg) ? tier : best
  );
  return { letter: closest.letter, points: Math.round(avg * 10) / 10 };
}
