export const DAILY_MOTIVATIONS: string[] = [
  'Show up first. Results come later.',
  'One win today beats perfect plans.',
  'Do the smallest version—it counts.',
  'Momentum starts with one checkbox.',
  'Don’t negotiate with your goals.',
  'Make it easy, then make it consistent.',
  'Future you is built by today you.',
  'Just begin. The rest follows.',
  'Progress loves repetition.',
  'Win the next 5 minutes.',
  'Do it tired. Do it anyway.',
  'Keep promises to yourself.',
  'Start messy. Stay consistent.',
  'One habit is a vote for your identity.',
  'You don’t need motivation—start.',
  'Small actions compound quietly.',
  'Today is a training session.',
  'Make “done” your default.',
  'Don’t miss twice. Protect the chain.',
  'Action first. Feelings later.',
  'Be the person who shows up.',
  'Consistency beats intensity.',
  'One more habit = more momentum.',
  'Keep it simple. Keep it moving.',
  'Your standards are built daily.',
  'No zero days. Just one thing.',
  'You’re closer than you think.',
  'Start now. Adjust later.',
  'Build the streak, build the self.',
  'Earn tomorrow by finishing today.',
  'You leveled up by showing up.'
];

export function getDailyMotivation(dayOfMonth: number): string {
  const index = Math.min(Math.max(dayOfMonth, 1), 31) - 1;
  return DAILY_MOTIVATIONS[index];
}
