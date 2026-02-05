import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AchievementType =
  | 'HABIT_WIN'
  | 'LEVEL_UP'
  | 'STREAK_PLUS'
  | 'PERFECT_DAY'
  | 'WEEK_MILESTONE';

export type AchievementPayload = {
  type: AchievementType;
  title: string;
  subtitle: string;
  statLine: string;
  highlightText: string;
  dateLabel: string;
  personaName?: string;
};

@Injectable({ providedIn: 'root' })
export class AchievementQueueService {
  private queue: AchievementPayload[] = [];
  private current$ = new BehaviorSubject<AchievementPayload | null>(null);
  private showActions$ = new BehaviorSubject<boolean>(false);
  private actionTimer?: ReturnType<typeof setTimeout>;

  getCurrent() {
    return this.current$.asObservable();
  }

  getShowActions() {
    return this.showActions$.asObservable();
  }

  enqueue(payload: AchievementPayload): void {
    this.queue.push(payload);
    if (!this.current$.value) {
      this.playNext();
    }
  }

  closeCurrent(): void {
    this.clearActionTimer();
    this.current$.next(null);
    this.showActions$.next(false);
    this.playNext();
  }

  private playNext(): void {
    if (this.current$.value || this.queue.length === 0) {
      return;
    }
    const next = this.queue.shift()!;
    this.current$.next(next);
    this.showActions$.next(false);
    this.clearActionTimer();
    this.actionTimer = setTimeout(() => {
      this.showActions$.next(true);
    }, 2000);
  }

  private clearActionTimer(): void {
    if (this.actionTimer) {
      clearTimeout(this.actionTimer);
      this.actionTimer = undefined;
    }
  }
}
