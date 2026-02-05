import { Injectable, Inject, PLATFORM_ID, OnDestroy, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, interval, Subscription, Subject, combineLatest } from 'rxjs';
import { HabitStoreService } from './habit-store.service';
import { Habit } from '../models/habit.model';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished' | 'cancelled';

export type ActiveTimerState = {
  habitId: string;
  dateKey: string;
  durationSec: number;
  startAtEpochMs: number;
  pausedTotalMs: number;
  isPaused: boolean;
  pausedAtEpochMs?: number;
};

export type TimerSession = {
  habitId: string;
  dateKey: string;
  running: boolean;
  targetSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  status: TimerStatus;
  autoComplete: boolean;
  allowManualComplete: boolean;
  startedAtEpochMs?: number;
  lastTickEpochMs?: number;
};

const ACTIVE_TIMER_KEY = 'active_timer_state';

@Injectable({ providedIn: 'root' })
export class TimerService implements OnDestroy {
  private session$ = new BehaviorSubject<TimerSession | null>(null);
  readonly state$ = this.session$.asObservable();
  private completedEvents = new Subject<TimerSession>();
  private tickSub?: Subscription;
  private subscription = new Subscription();
  private completionGuard = new Set<string>();
  private habitMap = new Map<string, Habit>();
  private activeState: ActiveTimerState | null = null;

  constructor(
    private habitStore: HabitStoreService,
    private zone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.subscription.add(
      combineLatest([
        this.habitStore.getHabits(),
        this.habitStore.getTimerStates()
      ]).subscribe(([habits, timerStates]) => {
        this.habitMap = new Map(habits.map(habit => [habit.id, habit]));
        this.reconcileActiveTimer(timerStates);
      })
    );
    this.restoreActiveTimer();
    this.bindVisibilityResume();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.stopTicking();
  }

  getSession() {
    return this.session$.asObservable();
  }

  getCompletionEvents() {
    return this.completedEvents.asObservable();
  }

  getSessionSync(): TimerSession | null {
    return this.session$.value;
  }

  startTimer(habitId: string, dateKey: string, targetSeconds: number, autoComplete = true, allowManualComplete = false): boolean {
    const existing = this.session$.value;
    if (existing && existing.status === 'running' && (existing.habitId !== habitId || existing.dateKey !== dateKey)) {
      return false;
    }
    const habit = this.habitMap.get(habitId);
    if (habit?.timerCompleted) {
      return false;
    }
    const date = this.dateFromKey(dateKey);
    if (!date) {
      return false;
    }
    const normalizedTarget = Math.max(1, Math.floor(targetSeconds));
    const existingState = this.habitStore.getTimerState(date, habitId);
    const elapsedSeconds = Math.max(0, existingState?.elapsedSeconds ?? 0);
    const now = Date.now();
    const resumedStartAt = Math.max(0, now - elapsedSeconds * 1000);
    this.activeState = {
      habitId,
      dateKey,
      durationSec: normalizedTarget,
      startAtEpochMs: resumedStartAt,
      pausedTotalMs: 0,
      isPaused: false
    };
    this.persistActiveState();
    this.startTicking();
    this.emitSession(now, autoComplete, allowManualComplete);
    return true;
  }

  pauseTimer(): void {
    const session = this.session$.value;
    if (!session || session.status !== 'running' || !this.activeState) {
      return;
    }
    const now = Date.now();
    this.activeState.isPaused = true;
    this.activeState.pausedAtEpochMs = now;
    this.persistActiveState();
    this.stopTicking();
    this.emitSession(now, session.autoComplete, session.allowManualComplete);
  }

  resumeTimer(): void {
    const session = this.session$.value;
    if (!session || session.status !== 'paused' || !this.activeState) {
      return;
    }
    const now = Date.now();
    if (this.activeState.pausedAtEpochMs) {
      this.activeState.pausedTotalMs += Math.max(0, now - this.activeState.pausedAtEpochMs);
    }
    this.activeState.isPaused = false;
    this.activeState.pausedAtEpochMs = undefined;
    this.persistActiveState();
    this.startTicking();
    this.emitSession(now, session.autoComplete, session.allowManualComplete);
  }

  cancelTimer(): void {
    const session = this.session$.value;
    if (!session) {
      return;
    }
    this.stopTicking();
    this.clearActiveState();
    this.session$.next({
      ...session,
      running: false,
      status: 'cancelled'
    });
    this.habitStore.clearTimerState(session.dateKey, session.habitId);
    this.clearSessionSoon();
  }

  resetTimer(habitId: string, dateKey: string): void {
    if (this.activeState?.habitId === habitId && this.activeState.dateKey === dateKey) {
      this.stopTicking();
      this.activeState = {
        ...this.activeState,
        startAtEpochMs: Date.now(),
        pausedTotalMs: 0,
        isPaused: true,
        pausedAtEpochMs: Date.now()
      };
      this.persistActiveState();
      this.emitSession(Date.now(), this.session$.value?.autoComplete ?? true, this.session$.value?.allowManualComplete ?? false, 'idle');
    }
    this.habitStore.setTimerState(dateKey, habitId, { elapsedSeconds: 0, running: false });
  }

  stopAndClear(): void {
    const session = this.session$.value;
    this.stopTicking();
    if (session) {
      this.habitStore.clearTimerState(session.dateKey, session.habitId);
    }
    this.clearActiveState();
    this.session$.next(null);
  }

  private startTicking(): void {
    this.stopTicking();
    this.tickSub = interval(1000).subscribe(() => {
      // Ensure ticks run inside Angular's zone so change detection fires each second.
      this.zone.run(() => this.tick());
    });
  }

  private stopTicking(): void {
    this.tickSub?.unsubscribe();
    this.tickSub = undefined;
  }

  private tick(): void {
    const session = this.session$.value;
    if (!session || session.status !== 'running' || !this.activeState) {
      return;
    }
    const now = Date.now();
    this.emitSession(now, session.autoComplete, session.allowManualComplete);
  }

  private finish(session: TimerSession): void {
    if (this.completionGuard.has(session.habitId)) {
      return;
    }
    this.completionGuard.add(session.habitId);
    this.stopTicking();
    this.clearActiveState();
    const finished: TimerSession = {
      ...session,
      running: false,
      elapsedSeconds: session.targetSeconds,
      remainingSeconds: 0,
      status: 'finished',
      startedAtEpochMs: undefined,
      lastTickEpochMs: Date.now()
    };
    this.session$.next(finished);
    this.habitStore.setTimerState(session.dateKey, session.habitId, {
      elapsedSeconds: session.targetSeconds,
      running: false
    });
    this.habitStore.setHabitTimerCompleted(session.habitId, true);
    const date = this.dateFromKey(session.dateKey);
    if (date) {
      this.habitStore.setCompleted(session.habitId, date, true);
    }
    this.completedEvents.next(finished);
    this.clearSessionSoon();
    setTimeout(() => this.completionGuard.delete(session.habitId), 1000);
  }

  private reconcileActiveTimer(timerStates: Record<string, Record<string, { elapsedSeconds: number; running: boolean; lastStartTimestamp?: number }>>): void {
    const runningTimers: Array<{ habitId: string; dateKey: string; lastStartTimestamp?: number }> = [];
    Object.entries(timerStates).forEach(([dateKey, dayMap]) => {
      Object.entries(dayMap || {}).forEach(([habitId, state]) => {
        if (state?.running) {
          runningTimers.push({ habitId, dateKey, lastStartTimestamp: state.lastStartTimestamp });
        }
      });
    });
    if (runningTimers.length === 0) {
      if (this.session$.value?.status === 'running') {
        this.session$.next(null);
      }
      this.stopTicking();
      return;
    }
    runningTimers.sort((a, b) => (b.lastStartTimestamp ?? 0) - (a.lastStartTimestamp ?? 0));
    const [active, ...rest] = runningTimers;
    const current = this.session$.value;
    if (current && current.status === 'running' && current.habitId === active.habitId && current.dateKey === active.dateKey) {
      return;
    }
    rest.forEach(timer => {
      this.habitStore.setTimerState(timer.dateKey, timer.habitId, {
        elapsedSeconds: timerStates[timer.dateKey][timer.habitId]?.elapsedSeconds ?? 0,
        running: false
      });
    });
    const habit = this.habitMap.get(active.habitId);
    const habitType = habit?.type ?? (habit?.timerEnabled ? 'timer' : 'check');
    if (!habit || habitType !== 'timer' || habit.timerCompleted) {
      this.habitStore.clearTimerState(active.dateKey, active.habitId);
      this.stopAndClear();
      return;
    }
    const targetSeconds = Math.max(1, Math.floor(habit.targetSeconds ?? habit.timerSeconds ?? 0));
    const timerState = timerStates[active.dateKey]?.[active.habitId];
    const elapsedSeconds = Math.max(0, timerState?.elapsedSeconds ?? 0);
    const now = Date.now();
    this.activeState = {
      habitId: active.habitId,
      dateKey: active.dateKey,
      durationSec: targetSeconds,
      startAtEpochMs: Math.max(0, now - elapsedSeconds * 1000),
      pausedTotalMs: 0,
      isPaused: false
    };
    this.persistActiveState();
    this.startTicking();
    this.emitSession(now, habit.timerAutoComplete ?? true, habit.allowManualComplete ?? false);
  }

  private clearSessionSoon(): void {
    setTimeout(() => {
      const current = this.session$.value;
      if (current?.status === 'finished' || current?.status === 'cancelled') {
        this.session$.next(null);
      }
    }, 200);
  }

  private getElapsedSeconds(now: number): number {
    if (!this.activeState) {
      return 0;
    }
    const { startAtEpochMs, pausedTotalMs, isPaused, pausedAtEpochMs } = this.activeState;
    const effectivePausedMs = isPaused && pausedAtEpochMs ? pausedTotalMs + Math.max(0, now - pausedAtEpochMs) : pausedTotalMs;
    const elapsedMs = Math.max(0, now - startAtEpochMs - effectivePausedMs);
    return Math.floor(elapsedMs / 1000);
  }

  private emitSession(now: number, autoComplete: boolean, allowManualComplete: boolean, forceStatus?: TimerStatus): void {
    if (!this.activeState) {
      return;
    }
    const elapsedSeconds = this.getElapsedSeconds(now);
    const remainingSeconds = Math.max(this.activeState.durationSec - elapsedSeconds, 0);
    const status: TimerStatus = forceStatus ?? (this.activeState.isPaused ? 'paused' : 'running');
    const session: TimerSession = {
      habitId: this.activeState.habitId,
      dateKey: this.activeState.dateKey,
      running: status === 'running',
      targetSeconds: this.activeState.durationSec,
      elapsedSeconds,
      remainingSeconds,
      status,
      autoComplete,
      allowManualComplete,
      startedAtEpochMs: this.activeState.startAtEpochMs,
      lastTickEpochMs: now
    };
    this.session$.next(session);
    this.habitStore.setTimerState(session.dateKey, session.habitId, {
      elapsedSeconds,
      running: status === 'running',
      lastStartTimestamp: status === 'running' ? now : undefined
    });
    if (remainingSeconds <= 0) {
      this.finish(session);
    }
  }

  private bindVisibilityResume(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.zone.run(() => this.tick());
      }
    });
    this.bindCapacitorAppState();
  }

  private bindCapacitorAppState(): void {
    try {
      const app = (window as unknown as { Capacitor?: { Plugins?: { App?: { addListener: (event: string, cb: (state: { isActive: boolean }) => void) => void } } } })
        ?.Capacitor?.Plugins?.App;
      if (!app) {
        return;
      }
      app.addListener('appStateChange', (state: { isActive: boolean }) => {
        if (state.isActive) {
          this.zone.run(() => this.tick());
        }
      });
    } catch {
      // Optional on web builds without Capacitor App plugin.
    }
  }

  private persistActiveState(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (!this.activeState) {
      window.localStorage.removeItem(ACTIVE_TIMER_KEY);
      return;
    }
    window.localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(this.activeState));
  }

  private restoreActiveTimer(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const raw = window.localStorage.getItem(ACTIVE_TIMER_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as ActiveTimerState;
      if (!parsed?.habitId || !parsed?.dateKey || !parsed?.startAtEpochMs || !parsed?.durationSec) {
        return;
      }
      this.activeState = {
        habitId: parsed.habitId,
        dateKey: parsed.dateKey,
        durationSec: Math.max(1, Number(parsed.durationSec) || 1),
        startAtEpochMs: Number(parsed.startAtEpochMs) || Date.now(),
        pausedTotalMs: Math.max(0, Number(parsed.pausedTotalMs) || 0),
        isPaused: Boolean(parsed.isPaused),
        pausedAtEpochMs: Number(parsed.pausedAtEpochMs) || undefined
      };
      this.startTicking();
      this.emitSession(Date.now(), true, false);
    } catch {
      window.localStorage.removeItem(ACTIVE_TIMER_KEY);
    }
  }

  private clearActiveState(): void {
    this.activeState = null;
    if (isPlatformBrowser(this.platformId)) {
      window.localStorage.removeItem(ACTIVE_TIMER_KEY);
    }
  }

  private dateFromKey(dateKey: string): Date | null {
    const parts = dateKey.split('-');
    if (parts.length !== 3) {
      return null;
    }
    const year = Number(parts[0]);
    const monthIndex = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) {
      return null;
    }
    const date = new Date(year, monthIndex, day);
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
