import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type AchievementEvent =
  | { type: 'HABIT_WIN'; habitId: string; title: string; xpDelta: number; date: string }
  | { type: 'DAY_WIN'; date: string; title: string }
  | { type: 'LEVEL_UP'; fromLevel: number; toLevel: number; date: string; title: string }
  | { type: 'STREAK_UP'; fromStreak: number; toStreak: number; date: string; title: string };

@Injectable({ providedIn: 'root' })
export class AchievementEventsService {
  private readonly events$ = new Subject<AchievementEvent>();
  debug = false;

  getEvents() {
    return this.events$.asObservable();
  }

  emit(event: AchievementEvent): void {
    if (this.debug) {
      console.log('[achievement]', event);
    }
    this.events$.next(event);
  }
}
