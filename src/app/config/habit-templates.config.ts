import { HabitDomain } from '../models/habit.model';

export interface HabitTemplate {
  id: string;
  name: string;
  domain: HabitDomain;
  icon: string;
  difficulty: 'easy' | 'medium' | 'hard';
  frequencyType: 'daily' | 'weekly';
  weeklyTarget?: number;
  timerEnabled: boolean;
  timerSeconds?: number;
  description: string;
  tags?: string[];
}

export const HABIT_TEMPLATES: HabitTemplate[] = [
  // ── HEALTH & FITNESS (12) ────────────────────────────────────────────────────
  { id: 'ht-walk',        name: 'Daily Walk',           domain: 'health',       icon: '🚶', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Walk for at least 20 minutes' },
  { id: 'ht-workout',     name: 'Workout',              domain: 'health',       icon: '🏋️', difficulty: 'hard',   frequencyType: 'weekly', weeklyTarget: 4,     timerEnabled: false,                   description: 'Strength or cardio session' },
  { id: 'ht-water',       name: 'Drink 2L Water',       domain: 'health',       icon: '💧', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Stay hydrated throughout the day' },
  { id: 'ht-sleep',       name: 'Sleep by 11PM',        domain: 'health',       icon: '😴', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: false,                   description: 'Consistent sleep schedule' },
  { id: 'ht-stretch',     name: 'Morning Stretch',      domain: 'health',       icon: '🤸', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 300,  description: '5-minute morning stretch routine' },
  { id: 'ht-run',         name: 'Running',              domain: 'health',       icon: '🏃', difficulty: 'hard',   frequencyType: 'weekly', weeklyTarget: 3,     timerEnabled: false,                   description: 'Cardio running session' },
  { id: 'ht-supplements', name: 'Take Supplements',     domain: 'health',       icon: '💊', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Daily vitamins and supplements' },
  { id: 'ht-cold-shower', name: 'Cold Shower',          domain: 'health',       icon: '🚿', difficulty: 'hard',   frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 120,  description: '2-minute cold shower for resilience' },
  { id: 'ht-no-junk',     name: 'No Junk Food',         domain: 'health',       icon: '🥗', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: false,                   description: 'Eat clean, avoid processed food' },
  { id: 'ht-steps',       name: '10K Steps',            domain: 'health',       icon: '👣', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: false,                   description: 'Hit 10,000 steps daily' },
  { id: 'ht-yoga',        name: 'Yoga',                 domain: 'health',       icon: '🧘', difficulty: 'medium', frequencyType: 'weekly', weeklyTarget: 3,     timerEnabled: true,  timerSeconds: 1200, description: 'Yoga or flexibility training' },
  { id: 'ht-meal-prep',   name: 'Meal Prep',            domain: 'health',       icon: '🍳', difficulty: 'medium', frequencyType: 'weekly', weeklyTarget: 1,     timerEnabled: false,                   description: 'Prepare healthy meals for the week' },

  // ── MIND & LEARNING (12) ─────────────────────────────────────────────────────
  { id: 'mt-read',        name: 'Read 30 Minutes',      domain: 'mind',         icon: '📚', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 1800, description: 'Read books or articles' },
  { id: 'mt-meditate',    name: 'Meditation',           domain: 'mind',         icon: '🧘', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 600,  description: '10-minute mindfulness meditation' },
  { id: 'mt-journal',     name: 'Journal',              domain: 'mind',         icon: '📓', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Write thoughts and reflections' },
  { id: 'mt-language',    name: 'Language Practice',    domain: 'mind',         icon: '🌍', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 900,  description: 'Practice a foreign language' },
  { id: 'mt-course',      name: 'Online Course',        domain: 'mind',         icon: '🎓', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 1800, description: 'Watch or complete course lessons' },
  { id: 'mt-flashcards',  name: 'Flashcard Review',     domain: 'mind',         icon: '🃏', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 600,  description: 'Spaced repetition review' },
  { id: 'mt-podcast',     name: 'Learning Podcast',     domain: 'mind',         icon: '🎧', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Listen to an educational podcast' },
  { id: 'mt-write',       name: 'Writing Practice',     domain: 'mind',         icon: '✍️', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 1200, description: 'Write essays, stories or articles' },
  { id: 'mt-problem',     name: 'Problem Solving',      domain: 'mind',         icon: '🧩', difficulty: 'hard',   frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 1800, description: 'Solve coding, math or logic problems' },
  { id: 'mt-news',        name: 'News Digest',          domain: 'mind',         icon: '📰', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Stay informed with quality news' },
  { id: 'mt-brain',       name: 'Brain Training',       domain: 'mind',         icon: '🧠', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 600,  description: 'Mental exercises and puzzles' },
  { id: 'mt-deep-focus',  name: 'Deep Work Session',    domain: 'mind',         icon: '🎯', difficulty: 'hard',   frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 5400, description: '90-minute focused deep work' },

  // ── CREATIVE & ARTS (10) ─────────────────────────────────────────────────────
  { id: 'ct-draw',        name: 'Drawing Practice',     domain: 'creative',     icon: '✏️', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 1800, description: 'Sketching and illustration' },
  { id: 'ct-music',       name: 'Practice Instrument',  domain: 'creative',     icon: '🎸', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 1800, description: 'Practice guitar, piano or any instrument' },
  { id: 'ct-photo',       name: 'Photography',          domain: 'creative',     icon: '📸', difficulty: 'easy',   frequencyType: 'weekly', weeklyTarget: 3,     timerEnabled: false,                   description: 'Take and edit creative photos' },
  { id: 'ct-design',      name: 'Design Work',          domain: 'creative',     icon: '🎨', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 3600, description: 'UI, graphic or product design' },
  { id: 'ct-video',       name: 'Video Editing',        domain: 'creative',     icon: '🎬', difficulty: 'hard',   frequencyType: 'weekly', weeklyTarget: 2,     timerEnabled: false,                   description: 'Create and edit video content' },
  { id: 'ct-write',       name: 'Creative Writing',     domain: 'creative',     icon: '📖', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 1800, description: 'Fiction, poetry or screenwriting' },
  { id: 'ct-dance',       name: 'Dance Practice',       domain: 'creative',     icon: '💃', difficulty: 'medium', frequencyType: 'weekly', weeklyTarget: 3,     timerEnabled: false,                   description: 'Learn and practice dance moves' },
  { id: 'ct-crafts',      name: 'Crafts & Making',      domain: 'creative',     icon: '🛠️', difficulty: 'easy',   frequencyType: 'weekly', weeklyTarget: 2,     timerEnabled: false,                   description: 'Handcrafts, woodwork, or making' },
  { id: 'ct-sing',        name: 'Vocal Practice',       domain: 'creative',     icon: '🎤', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 1200, description: 'Singing and vocal exercises' },
  { id: 'ct-content',     name: 'Create Content',       domain: 'creative',     icon: '✨', difficulty: 'hard',   frequencyType: 'weekly', weeklyTarget: 3,     timerEnabled: false,                   description: 'Post content for your audience' },

  // ── CAREER & CRAFT (10) ──────────────────────────────────────────────────────
  { id: 'cr-code',         name: 'Coding Practice',     domain: 'career',       icon: '💻', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 3600, description: 'Build projects or practice algorithms' },
  { id: 'cr-network',      name: 'Networking',          domain: 'career',       icon: '🤝', difficulty: 'medium', frequencyType: 'weekly', weeklyTarget: 2,     timerEnabled: false,                   description: 'Reach out and build professional connections' },
  { id: 'cr-portfolio',    name: 'Portfolio Work',      domain: 'career',       icon: '🗂️', difficulty: 'hard',   frequencyType: 'weekly', weeklyTarget: 3,     timerEnabled: false,                   description: 'Build and improve your portfolio' },
  { id: 'cr-apply',        name: 'Job Applications',    domain: 'career',       icon: '📤', difficulty: 'medium', frequencyType: 'weekly', weeklyTarget: 5,     timerEnabled: false,                   description: 'Apply to jobs or opportunities' },
  { id: 'cr-skill',        name: 'Skill Building',      domain: 'career',       icon: '🔧', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 1800, description: 'Practice your craft daily' },
  { id: 'cr-review',       name: 'Weekly Review',       domain: 'career',       icon: '📋', difficulty: 'easy',   frequencyType: 'weekly', weeklyTarget: 1,     timerEnabled: false,                   description: 'Review goals and plan the week' },
  { id: 'cr-mentorship',   name: 'Mentorship',          domain: 'career',       icon: '🎯', difficulty: 'medium', frequencyType: 'weekly', weeklyTarget: 1,     timerEnabled: false,                   description: 'Meet with mentor or coach' },
  { id: 'cr-email',        name: 'Email Inbox Zero',    domain: 'career',       icon: '📧', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Clear and organize email inbox' },
  { id: 'cr-presentation', name: 'Presentation Prep',  domain: 'career',       icon: '📊', difficulty: 'hard',   frequencyType: 'weekly', weeklyTarget: 2,     timerEnabled: false,                   description: 'Prepare slides or speeches' },
  { id: 'cr-side-project', name: 'Side Project',        domain: 'career',       icon: '🚀', difficulty: 'hard',   frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 3600, description: 'Work on your side hustle or passion project' },

  // ── FINANCE & WEALTH (8) ─────────────────────────────────────────────────────
  { id: 'fi-budget',      name: 'Track Expenses',       domain: 'finance',      icon: '💰', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Log daily spending' },
  { id: 'fi-invest',      name: 'Review Investments',   domain: 'finance',      icon: '📈', difficulty: 'medium', frequencyType: 'weekly', weeklyTarget: 1,     timerEnabled: false,                   description: 'Review portfolio and market news' },
  { id: 'fi-save',        name: 'Save Money',           domain: 'finance',      icon: '🏦', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: false,                   description: 'Contribute to savings goal' },
  { id: 'fi-noSpend',     name: 'No Spend Day',         domain: 'finance',      icon: '🚫', difficulty: 'medium', frequencyType: 'weekly', weeklyTarget: 3,     timerEnabled: false,                   description: 'Zero non-essential spending' },
  { id: 'fi-learn',       name: 'Finance Reading',      domain: 'finance',      icon: '📘', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 900,  description: 'Learn about money and investing' },
  { id: 'fi-plan',        name: 'Financial Planning',   domain: 'finance',      icon: '🗓️', difficulty: 'medium', frequencyType: 'weekly', weeklyTarget: 1,     timerEnabled: false,                   description: 'Review financial goals and plan' },
  { id: 'fi-income',      name: 'Income Activity',      domain: 'finance',      icon: '💵', difficulty: 'hard',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Work on income-generating activity' },
  { id: 'fi-audit',       name: 'Subscription Audit',   domain: 'finance',      icon: '🔍', difficulty: 'easy',   frequencyType: 'weekly', weeklyTarget: 1,     timerEnabled: false,                   description: 'Review and cut unnecessary subscriptions' },

  // ── SOCIAL & RELATIONS (8) ───────────────────────────────────────────────────
  { id: 'so-call',        name: 'Call Someone',         domain: 'social',       icon: '📞', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Call a friend or family member' },
  { id: 'so-gratitude',   name: 'Express Gratitude',    domain: 'social',       icon: '🙏', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Tell someone you appreciate them' },
  { id: 'so-random-kind', name: 'Random Kindness',      domain: 'social',       icon: '💝', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Do something kind for someone' },
  { id: 'so-social-plan', name: 'Plan a Social Event',  domain: 'social',       icon: '🎉', difficulty: 'medium', frequencyType: 'weekly', weeklyTarget: 1,     timerEnabled: false,                   description: 'Organize or initiate a social gathering' },
  { id: 'so-no-phone',    name: 'No Phone at Dinner',   domain: 'social',       icon: '🍽️', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: false,                   description: 'Be fully present during meals' },
  { id: 'so-listen',      name: 'Active Listening',     domain: 'social',       icon: '👂', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Practice being fully present in conversations' },
  { id: 'so-volunteer',   name: 'Volunteer',            domain: 'social',       icon: '🌟', difficulty: 'hard',   frequencyType: 'weekly', weeklyTarget: 1,     timerEnabled: false,                   description: 'Give back to community' },
  { id: 'so-mentor',      name: 'Mentor Someone',       domain: 'social',       icon: '🎓', difficulty: 'medium', frequencyType: 'weekly', weeklyTarget: 1,     timerEnabled: false,                   description: 'Help and guide others' },

  // ── SPIRIT & MINDSET (8) ─────────────────────────────────────────────────────
  { id: 'sp-gratitude',   name: 'Gratitude List',       domain: 'spirit',       icon: '✨', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Write 3 things you are grateful for' },
  { id: 'sp-affirmation', name: 'Affirmations',         domain: 'spirit',       icon: '💪', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 300,  description: 'Repeat positive affirmations' },
  { id: 'sp-breathe',     name: 'Breathwork',           domain: 'spirit',       icon: '🌬️', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 300,  description: 'Box breathing or Wim Hof method' },
  { id: 'sp-prayer',      name: 'Prayer / Devotion',    domain: 'spirit',       icon: '🙏', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Spiritual practice and connection' },
  { id: 'sp-no-social',   name: 'Social Media Detox',   domain: 'spirit',       icon: '📵', difficulty: 'hard',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'No social media for the day' },
  { id: 'sp-nature',      name: 'Time in Nature',       domain: 'spirit',       icon: '🌿', difficulty: 'easy',   frequencyType: 'weekly', weeklyTarget: 3,     timerEnabled: false,                   description: 'Spend time outdoors in nature' },
  { id: 'sp-reflect',     name: 'Evening Reflection',   domain: 'spirit',       icon: '🌙', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 600,  description: 'End-of-day review and reflection' },
  { id: 'sp-stoic',       name: 'Stoic Practice',       domain: 'spirit',       icon: '⚖️', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: false,                   description: 'Practice negative visualization or memento mori' },

  // ── PRODUCTIVITY (8) ─────────────────────────────────────────────────────────
  { id: 'pr-plan',        name: 'Daily Planning',       domain: 'productivity', icon: '📋', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: true,  timerSeconds: 600,  description: 'Plan your top 3 priorities for the day' },
  { id: 'pr-pomodoro',    name: 'Pomodoro Sessions',    domain: 'productivity', icon: '🍅', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: false,                   description: 'Complete 4+ focused work sessions' },
  { id: 'pr-inbox',       name: 'Inbox Zero',           domain: 'productivity', icon: '📬', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: false,                   description: 'Clear your task inbox or messages' },
  { id: 'pr-clean',       name: 'Clean Workspace',      domain: 'productivity', icon: '🧹', difficulty: 'easy',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Keep your environment clean and organized' },
  { id: 'pr-no-scroll',   name: 'No Mindless Scroll',   domain: 'productivity', icon: '🚫', difficulty: 'hard',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Avoid aimless social media scrolling' },
  { id: 'pr-early',       name: 'Wake Up Early',        domain: 'productivity', icon: '⏰', difficulty: 'hard',   frequencyType: 'daily',                       timerEnabled: false,                   description: 'Wake up before 6:30AM' },
  { id: 'pr-shutdown',    name: 'Work Shutdown',        domain: 'productivity', icon: '🔒', difficulty: 'medium', frequencyType: 'daily',                       timerEnabled: false,                   description: 'Hard stop on work at set time' },
  { id: 'pr-review',      name: 'Weekly Review',        domain: 'productivity', icon: '🔄', difficulty: 'easy',   frequencyType: 'weekly', weeklyTarget: 1,     timerEnabled: false,                   description: 'Review wins, misses and next week plan' },
];

export function getTemplatesByDomain(domain: HabitDomain | 'all'): HabitTemplate[] {
  if (domain === 'all') return HABIT_TEMPLATES;
  return HABIT_TEMPLATES.filter(t => t.domain === domain);
}
