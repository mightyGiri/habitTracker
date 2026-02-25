import { Injectable } from '@angular/core';

export type AchievementBadgeId =
  | 'first_habit_completed'
  | 'first_perfect_day'
  | 'perfect_days_3'
  | 'perfect_days_7'
  | 'total_completed_10'
  | 'total_completed_50'
  | 'total_completed_100'
  | 'first_level_up'
  | 'level_5_reached'
  | 'level_10_reached';

export type AchievementBadgeDef = {
  id: AchievementBadgeId;
  title: string;
  icon: string;
};

export type AchievementMetrics = {
  totalCompletedCount: number;
  perfectDayCount: number;
  level: number;
};

export const STARTER_BADGES: AchievementBadgeDef[] = [
  { id: 'first_habit_completed', title: 'First Habit Completed', icon: 'task_alt' },
  { id: 'first_perfect_day', title: 'First Perfect Day', icon: 'local_fire_department' },
  { id: 'perfect_days_3', title: '3 Perfect Days', icon: 'workspace_premium' },
  { id: 'perfect_days_7', title: '7 Perfect Days', icon: 'military_tech' },
  { id: 'total_completed_10', title: '10 Total Habits Completed', icon: 'looks_one' },
  { id: 'total_completed_50', title: '50 Total Habits Completed', icon: 'bolt' },
  { id: 'total_completed_100', title: '100 Total Habits Completed', icon: 'emoji_events' },
  { id: 'first_level_up', title: 'First Level Up', icon: 'trending_up' },
  { id: 'level_5_reached', title: 'Level 5 Reached', icon: 'stars' },
  { id: 'level_10_reached', title: 'Level 10 Reached', icon: 'auto_awesome' }
];

@Injectable({
  providedIn: 'root'
})
export class AchievementsService {
  readonly badges = STARTER_BADGES;
  private readonly badgeMap = new Map<AchievementBadgeId, AchievementBadgeDef>(
    STARTER_BADGES.map(badge => [badge.id, badge])
  );

  getBadgeTitle(id: string): string {
    return this.badgeMap.get(id as AchievementBadgeId)?.title ?? id;
  }

  getUnlockedBadgeIds(metrics: AchievementMetrics): AchievementBadgeId[] {
    const unlocked: AchievementBadgeId[] = [];
    const totalCompleted = Math.max(0, Math.floor(metrics.totalCompletedCount || 0));
    const perfectDays = Math.max(0, Math.floor(metrics.perfectDayCount || 0));
    const level = Math.max(0, Math.floor(metrics.level || 0));

    if (totalCompleted >= 1) unlocked.push('first_habit_completed');
    if (perfectDays >= 1) unlocked.push('first_perfect_day');
    if (perfectDays >= 3) unlocked.push('perfect_days_3');
    if (perfectDays >= 7) unlocked.push('perfect_days_7');
    if (totalCompleted >= 10) unlocked.push('total_completed_10');
    if (totalCompleted >= 50) unlocked.push('total_completed_50');
    if (totalCompleted >= 100) unlocked.push('total_completed_100');
    if (level >= 1) unlocked.push('first_level_up');
    if (level >= 5) unlocked.push('level_5_reached');
    if (level >= 10) unlocked.push('level_10_reached');

    return unlocked;
  }

  normalizeBadgeIds(value: unknown): AchievementBadgeId[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const seen = new Set<AchievementBadgeId>();
    const valid = new Set<AchievementBadgeId>(STARTER_BADGES.map(badge => badge.id));
    for (const item of value) {
      const id = String(item) as AchievementBadgeId;
      if (valid.has(id)) {
        seen.add(id);
      }
    }
    return Array.from(seen);
  }
}
