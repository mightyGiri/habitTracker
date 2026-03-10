import { Injectable, signal, computed } from '@angular/core';
import { Quest, QuestTemplate } from '../models/quest.model';
import { HabitStoreService } from './habit-store.service';

const STORAGE_KEY = 'habit_quests';
/** ISO date key (YYYY-MM-DD) of the Monday on which quests were last generated. */
const GENERATION_KEY = 'quest_last_generated';

/** Rotating pool of weekly quest templates. */
const QUEST_POOL: QuestTemplate[] = [
  {
    title: 'Habit Starter',
    description: 'Complete at least 1 habit per day for 3 days',
    type: 'weekly',
    requirement: { habitCount: 1, daysRequired: 3 },
    xpReward: 50,
    badgeReward: 'starter'
  },
  {
    title: 'Consistency King',
    description: 'Complete at least 3 habits per day for 5 days',
    type: 'weekly',
    requirement: { habitCount: 3, daysRequired: 5 },
    xpReward: 150,
    badgeReward: 'consistency'
  },
  {
    title: 'Perfect Week',
    description: 'Complete all habits every day for 7 days',
    type: 'weekly',
    // habitCount: 0 is a sentinel meaning "all habits" (doneCount must equal totalCount)
    requirement: { habitCount: 0, daysRequired: 7 },
    xpReward: 300,
    badgeReward: 'perfect_week'
  },
  {
    title: 'Momentum Builder',
    description: 'Complete at least 2 habits per day for 4 days',
    type: 'weekly',
    requirement: { habitCount: 2, daysRequired: 4 },
    xpReward: 100,
    badgeReward: 'momentum'
  },
  {
    title: 'Iron Will',
    description: 'Complete at least 5 habits per day for 7 days',
    type: 'weekly',
    requirement: { habitCount: 5, daysRequired: 7 },
    xpReward: 400,
    badgeReward: 'iron_will'
  }
];

@Injectable({ providedIn: 'root' })
export class QuestService {

  /** All quests (in-progress + completed + expired). */
  readonly quests = signal<Quest[]>([]);

  /**
   * Active tab quests: in-progress + completed-but-not-yet-claimed.
   * Expired quests are hidden unless reward was claimed.
   */
  readonly activeQuests = computed(() =>
    this.quests().filter(q => !this.isExpired(q) && !q.progress.claimedReward)
  );

  /** Claimed tab: only quests where the reward has been collected. */
  readonly completedQuests = computed(() =>
    this.quests().filter(q => q.progress.claimedReward)
  );

  /** Total bonus XP accumulated from all claimed quest rewards. */
  readonly totalBonusXP = computed(() =>
    this.quests()
      .filter(q => q.progress.claimedReward)
      .reduce((sum, q) => sum + q.xpReward, 0)
  );

  private lastKnownCompleted = 0;
  private lastKnownTotal = 0;
  private backfillDone = false;

  constructor(private habitStore: HabitStoreService) {
    this.loadFromStorage();
    this.generateWeeklyQuests();

    // Backfill quest progress from full history once HabitStore is hydrated.
    // Uses a flag so it runs exactly once per app session.
    this.habitStore.getReady().subscribe(ready => {
      if (ready && !this.backfillDone) {
        this.backfillDone = true;
        this.recalculateProgressFromHistory();
      }
    });
  }

  // ─── Storage ──────────────────────────────────────────────────────────────

  loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Quest[];
        const migrated = parsed.map(q => ({
          ...q,
          progress: {
            ...q.progress,
            countedDates: q.progress.countedDates ?? [],
            lastProgressDate: q.progress.lastProgressDate ?? null
          }
        }));
        this.quests.set(migrated);
      }
    } catch {
      this.quests.set([]);
    }
  }

  saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.quests()));
    } catch {
      // localStorage unavailable (private browsing quota exceeded, etc.)
    }
  }

  // ─── Generation ───────────────────────────────────────────────────────────

  /**
   * Generates 3 weekly quests for the current week.
   *
   * Runs only when:
   *   a) No non-expired quests exist (first-time user / cleared storage), OR
   *   b) It's Monday and `quest_last_generated` predates this Monday.
   *
   * Safe to call on every app open — no-op in the common case.
   */
  generateWeeklyQuests(): void {
    const today = new Date();
    const monday = this.getWeekMonday(today);
    const mondayKey = this.toDateKey(monday);
    const isMonday = today.getDay() === 1;

    const lastGenerated = localStorage.getItem(GENERATION_KEY) ?? '';
    const hasActiveQuests = this.quests().some(q => !this.isExpired(q));

    const shouldGenerateFirstTime = !hasActiveQuests;
    const shouldGenerateNewWeek = isMonday && lastGenerated < mondayKey;

    if (!shouldGenerateFirstTime && !shouldGenerateNewWeek) {
      return;
    }

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const sundayKey = this.toDateKey(sunday);
    const weekNumber = this.getWeekNumber(today);
    const poolSize = QUEST_POOL.length;

    const newQuests: Quest[] = [0, 1, 2].map(offset => {
      const poolIndex = (weekNumber + offset) % poolSize;
      const template = QUEST_POOL[poolIndex];
      return {
        ...template,
        id: `${mondayKey}_${poolIndex}`,
        startDate: mondayKey,
        endDate: sundayKey,
        progress: {
          currentDays: 0,
          completed: false,
          claimedReward: false,
          lastProgressDate: null,
          countedDates: []
        }
      };
    });

    // Keep claimed history only; drop old unclaimed expired quests
    this.quests.update(prev => [
      ...prev.filter(q => q.progress.claimedReward),
      ...newQuests
    ]);
    localStorage.setItem(GENERATION_KEY, mondayKey);
    this.saveToStorage();
  }

  // ─── Backfill ─────────────────────────────────────────────────────────────

  /**
   * Recalculates quest progress from the full habit completion history.
   *
   * Called once per session when HabitStore signals it is ready.
   * For each active quest, iterates every date from quest.startDate to today,
   * counts completed habits against the quest requirement, and rebuilds
   * countedDates from scratch. currentDays is derived from countedDates.length
   * so it is always accurate regardless of when the app was last opened.
   *
   * Fix 1: progress now reflects past days, not just the current session.
   * Fix 4: currentDays is always derived from countedDates.length, never
   *         manually incremented.
   */
  recalculateProgressFromHistory(): void {
    const todayKey = this.toDateKey(new Date());
    const completions = this.habitStore.getCompletionsSync();

    const updatedQuests = this.quests().map(quest => {
      // Claimed quests are frozen — don't touch them
      if (quest.progress.claimedReward) return quest;
      // Expired quests are hidden — no point recalculating
      if (this.isExpired(quest)) return quest;

      const qualifyingDates: string[] = [];

      // Walk every date from quest start up to and including today
      const cursor = this.parseDateKey(quest.startDate);
      const end = this.parseDateKey(todayKey < quest.endDate ? todayKey : quest.endDate);

      while (cursor <= end) {
        const dateKey = this.toDateKey(cursor);
        const activeHabits = this.habitStore.getHabitsActiveOn(dateKey);
        const dayMap = completions[dateKey] ?? {};
        const doneCount = activeHabits.filter(h => dayMap[h.id] === true).length;
        const totalCount = activeHabits.length;

        const requirementMet = quest.requirement.habitCount === 0
          // sentinel 0 = "all habits" = perfect day
          ? doneCount === totalCount && totalCount > 0
          : doneCount >= quest.requirement.habitCount;

        if (requirementMet) {
          qualifyingDates.push(dateKey);
        }

        cursor.setDate(cursor.getDate() + 1);
      }

      // Fix 4: currentDays is derived, never manually set
      const newCurrentDays = qualifyingDates.length;
      const isComplete = newCurrentDays >= quest.requirement.daysRequired;
      const lastDate = qualifyingDates[qualifyingDates.length - 1] ?? null;

      return {
        ...quest,
        progress: {
          ...quest.progress,
          currentDays: newCurrentDays,
          completed: isComplete,
          lastProgressDate: lastDate,
          countedDates: qualifyingDates
        }
      };
    });

    this.quests.set(updatedQuests);
    this.saveToStorage();
  }

  // ─── Progress ─────────────────────────────────────────────────────────────

  /**
   * Updates quest progress for TODAY based on the current habit completion count.
   *
   * Must be called for BOTH habit completions AND uncompletions so that
   * today's progress is immediately accurate as the user toggles habits.
   *
   * Fix 2: handles removing today from countedDates when the user unchecks
   *         a habit and the count drops below the quest threshold.
   * Fix 4: currentDays is always set to countedDates.length, never incremented.
   *
   * @param completedCount  Habits completed today (from HabitStore.getDaySummary).
   * @param totalCount      Total active habits today.
   */
  checkQuestProgress(completedCount: number, totalCount: number): void {
    this.lastKnownCompleted = completedCount;
    this.lastKnownTotal = totalCount;

    const todayKey = this.toDateKey(new Date());
    let changed = false;

    this.quests.update(current =>
      current.map(quest => {
        if (quest.progress.claimedReward || this.isExpired(quest)) {
          return quest;
        }

        const requirementMet = quest.requirement.habitCount === 0
          ? completedCount === totalCount && totalCount > 0
          : completedCount >= quest.requirement.habitCount;

        const todayAlreadyCounted = quest.progress.countedDates.includes(todayKey);

        // Case 1: threshold met, today not yet in countedDates → add it
        if (requirementMet && !todayAlreadyCounted) {
          changed = true;
          const newCountedDates = [...quest.progress.countedDates, todayKey];
          const newCurrentDays = newCountedDates.length; // Fix 4
          const isNowComplete = newCurrentDays >= quest.requirement.daysRequired;
          return {
            ...quest,
            progress: {
              ...quest.progress,
              currentDays: newCurrentDays,
              completed: isNowComplete,
              lastProgressDate: todayKey,
              countedDates: newCountedDates
            }
          };
        }

        // Case 2: threshold no longer met but today was counted → remove it (Fix 2)
        if (!requirementMet && todayAlreadyCounted) {
          // Only remove today — past days' progress is preserved
          if (quest.progress.completed) {
            // Don't undo a completed quest — progress already earned
            return quest;
          }
          changed = true;
          const newCountedDates = quest.progress.countedDates.filter(d => d !== todayKey);
          const newCurrentDays = newCountedDates.length; // Fix 4
          const lastDate = newCountedDates[newCountedDates.length - 1] ?? null;
          return {
            ...quest,
            progress: {
              ...quest.progress,
              currentDays: newCurrentDays,
              completed: false,
              lastProgressDate: lastDate,
              countedDates: newCountedDates
            }
          };
        }

        return quest;
      })
    );

    if (changed) {
      this.saveToStorage();
    }
  }

  // ─── Reward ───────────────────────────────────────────────────────────────

  /**
   * Marks a quest reward as claimed.
   * Returns the XP reward amount for the caller to pass to
   * HabitStoreService.addQuestBonusXP(), or -1 if not eligible.
   */
  claimReward(questId: string): number {
    const quest = this.quests().find(q => q.id === questId);
    if (!quest || !quest.progress.completed || quest.progress.claimedReward) {
      return -1;
    }

    this.quests.update(current =>
      current.map(q =>
        q.id === questId
          ? { ...q, progress: { ...q.progress, claimedReward: true } }
          : q
      )
    );
    this.saveToStorage();

    console.log(`[QuestService] Reward claimed: +${quest.xpReward} XP for "${quest.title}"`);
    return quest.xpReward;
  }

  // ─── Debug ────────────────────────────────────────────────────────────────

  getTodayCompletionCount(): { completed: number; total: number } {
    return { completed: this.lastKnownCompleted, total: this.lastKnownTotal };
  }

  debugQuestState(): void {
    const today = new Date();
    const todayKey = this.toDateKey(today);
    const monday = this.getWeekMonday(today);
    const mondayKey = this.toDateKey(monday);
    const lastGenerated = localStorage.getItem(GENERATION_KEY) ?? 'never';
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);

    console.group('[QuestService] debugQuestState()');
    console.log('Today:', todayKey, '| Day of week:', today.getDay(), '(1 = Monday)');
    console.log('This week\'s Monday:', mondayKey);
    console.log('Next generation date (next Monday):', this.toDateKey(nextMonday));
    console.log('Last quest_last_generated value:', lastGenerated);
    console.log('Last known habit completion count:', this.getTodayCompletionCount());
    console.log('Active quests (%d):', this.activeQuests().length);
    console.log('Claimed quests (%d):', this.completedQuests().length);
    console.log('--- Quest detail ---');
    this.quests().forEach(q => {
      const claimVisible = q.progress.completed && !q.progress.claimedReward;
      const status = q.progress.claimedReward ? 'CLAIMED'
        : q.progress.completed ? 'DONE — claim button VISIBLE'
        : this.isExpired(q) ? 'EXPIRED (hidden)'
        : 'IN PROGRESS';
      console.log(
        `  [${status}] "${q.title}"`,
        `\n    Requirement: ${q.requirement.habitCount === 0 ? 'ALL habits' : q.requirement.habitCount + ' habits'} for ${q.requirement.daysRequired} days`,
        `\n    Progress   : ${q.progress.currentDays}/${q.requirement.daysRequired} days (${this.getProgressPercent(q)}%)`,
        `\n    Claim btn  : ${claimVisible ? '✅ VISIBLE' : '❌ hidden'}`,
        `\n    lastProgressDate: ${q.progress.lastProgressDate ?? 'none'}`,
        `\n    countedDates: [${q.progress.countedDates.join(', ') || 'empty'}]`,
        `\n    Expires: ${q.endDate} | expired: ${this.isExpired(q)}`
      );
    });
    console.groupEnd();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  isExpired(quest: Quest): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = quest.endDate.split('-').map(Number);
    const end = new Date(y, m - 1, d, 23, 59, 59);
    return today > end;
  }

  getDaysRemaining(quest: Quest): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = quest.endDate.split('-').map(Number);
    const end = new Date(y, m - 1, d, 23, 59, 59);
    const diff = end.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  getProgressPercent(quest: Quest): number {
    if (quest.requirement.daysRequired === 0) return 0;
    return Math.min(
      100,
      Math.round((quest.progress.currentDays / quest.requirement.daysRequired) * 100)
    );
  }

  private parseDateKey(dateKey: string): Date {
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private getWeekMonday(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86_400_000) + yearStart.getUTCDay() + 1) / 7);
  }

  private toDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
