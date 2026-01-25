export const DAILY_MOTIVATIONS: string[] = [
  'Start small. One tap counts.',
  'Momentum beats motivation.',
  'Show up once. Keep the chain.',
  'Do the next tiny action.',
  'Discipline beats mood today.',
  'Win the first 15 seconds.',
  'Don’t miss twice.',
  'Progress over perfection.',
  'Small reps build identity.',
  'Start where you are.',
  'One level today is enough.',
  'Keep it easy, keep it daily.',
  'Tiny actions, real change.',
  'Tap once. Move forward.',
  'Make it obvious, make it done.',
  'Today’s win is tomorrow’s streak.',
  'Consistency is the game.',
  'Show up for your future self.',
  'One action unlocks momentum.',
  'Keep the loop alive.',
  'Focus on the next habit.',
  'Your streak starts now.',
  'Build the habit, not the hype.',
  'Short effort, long reward.',
  'Be the person who shows up.',
  'Earn the next level today.',
  'Small wins compound fast.',
  'Action first, feelings later.',
  'Today decides tomorrow.',
  'Keep it light, keep it going.',
  'Level up with one small step.'
];

export function getDailyMotivation(dayOfMonth: number): string {
  const index = Math.min(Math.max(dayOfMonth, 1), 31) - 1;
  return DAILY_MOTIVATIONS[index];
}
