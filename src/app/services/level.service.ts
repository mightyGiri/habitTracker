import { Injectable } from '@angular/core';
import { getLevelProgressFromCount, LevelProgressState } from '../shared/level.logic';

export type TodayLevelState = {
  level: number;
  nextLevel: number;
  remaining: number;
};

@Injectable({ providedIn: 'root' })
export class LevelService {
  computeTodayLevel(completedHabitsToday: number): TodayLevelState {
    const progress = getLevelProgressFromCount(completedHabitsToday);
    return {
      level: progress.level,
      nextLevel: progress.nextLevel,
      remaining: progress.remaining
    };
  }

  getProgressFromCount(count: number): LevelProgressState {
    return getLevelProgressFromCount(count);
  }

  getStoredLevelForDate(dateKey: string): number {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 0;
    }
    const raw = window.localStorage.getItem(this.getStorageKey(dateKey));
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  setStoredLevelForDate(dateKey: string, level: number): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(this.getStorageKey(dateKey), String(Math.max(0, Math.floor(level))));
  }

  private getStorageKey(dateKey: string): string {
    return `level:${dateKey}`;
  }
}
