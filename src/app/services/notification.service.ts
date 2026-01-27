import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription, combineLatest } from 'rxjs';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { HabitStoreService } from './habit-store.service';
import { SettingsService } from './settings.service';

const REMINDER_HOURS = [7, 10, 13, 16, 19, 21];
const REMINDER_BASE_ID = 1001;
const STREAK_WARNING_ID = 2001;
const LAST_HABIT_ID = 3001;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private subscription = new Subscription();
  private enabled = false;
  private midnightTimer?: ReturnType<typeof setTimeout>;
  private lastHabitScheduledKey: string | null = null;
  private initialized = false;

  constructor(
    private habitStore: HabitStoreService,
    private settingsService: SettingsService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  init(): void {
    if (this.initialized || !isPlatformBrowser(this.platformId)) {
      return;
    }
    this.initialized = true;
    this.subscription.add(
      this.settingsService.getSettings().subscribe(settings => {
        this.enabled = settings.notificationsEnabled;
        if (this.enabled) {
          void this.requestPermission();
          this.refreshSchedules();
        } else {
          this.cancelAll();
        }
      })
    );
    this.subscription.add(
      combineLatest([
        this.habitStore.getHabits(),
        this.habitStore.getCompletions(),
        this.habitStore.getSkips()
      ]).subscribe(() => {
        if (this.enabled) {
          this.refreshSchedules();
        }
      })
    );
  }

  dispose(): void {
    this.subscription.unsubscribe();
    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer);
      this.midnightTimer = undefined;
    }
  }

  private async requestPermission(): Promise<void> {
    if (!this.isNative()) {
      return;
    }
    await LocalNotifications.requestPermissions();
  }

  private refreshSchedules(): void {
    if (!this.isNative()) {
      return;
    }
    const today = this.normalizeDate(new Date());
    const todayKey = this.toIsoDateLocal(today);
    const summary = this.habitStore.getDaySummary(today);
    const remaining = Math.max(summary.totalCount - summary.handledCount, 0);
    const completed = summary.totalCount > 0 && remaining === 0;

    if (completed) {
      this.cancelDaily();
      this.cancelLastHabit();
      this.scheduleNextDayRefresh();
      return;
    }

    this.clearNextDayTimer();
    this.scheduleDailyReminders();
    this.scheduleStreakWarning();

    if (summary.totalCount > 0 && remaining === 1) {
      this.scheduleLastHabit(todayKey);
    } else {
      this.cancelLastHabit();
    }
  }

  private scheduleDailyReminders(): void {
    this.cancelDaily();
    const notifications = REMINDER_HOURS.map((hour, index) => ({
      id: REMINDER_BASE_ID + index,
      title: 'Level-Up',
      body: 'Do 1 habit now. Keep your streak alive.',
      schedule: {
        on: { hour, minute: 0 },
        repeats: true
      }
    }));
    void LocalNotifications.schedule({ notifications });
  }

  private scheduleStreakWarning(): void {
    void LocalNotifications.schedule({
      notifications: [
        {
          id: STREAK_WARNING_ID,
          title: 'Streak danger',
          body: 'Finish your habits today. Don\'t miss twice.',
          schedule: {
            on: { hour: 20, minute: 30 },
            repeats: true
          }
        }
      ]
    });
  }

  private scheduleLastHabit(todayKey: string): void {
    if (this.lastHabitScheduledKey === todayKey) {
      return;
    }
    this.cancelLastHabit();
    this.lastHabitScheduledKey = todayKey;
    const fireAt = new Date();
    fireAt.setMinutes(fireAt.getMinutes() + 20);
    void LocalNotifications.schedule({
      notifications: [
        {
          id: LAST_HABIT_ID,
          title: 'One more habit',
          body: 'One more habit = streak secured. Finish strong.',
          schedule: { at: fireAt }
        }
      ]
    });
  }

  private cancelDaily(): void {
    const notifications = REMINDER_HOURS.map((_, index) => ({ id: REMINDER_BASE_ID + index }));
    notifications.push({ id: STREAK_WARNING_ID });
    void LocalNotifications.cancel({ notifications });
  }

  private cancelLastHabit(): void {
    this.lastHabitScheduledKey = null;
    void LocalNotifications.cancel({ notifications: [{ id: LAST_HABIT_ID }] });
  }

  private cancelAll(): void {
    if (!this.isNative()) {
      return;
    }
    this.cancelDaily();
    this.cancelLastHabit();
    this.clearNextDayTimer();
  }

  private scheduleNextDayRefresh(): void {
    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer);
    }
    const now = new Date();
    const next = new Date(now);
    next.setDate(now.getDate() + 1);
    next.setHours(0, 1, 0, 0);
    const delay = Math.max(next.getTime() - now.getTime(), 60_000);
    this.midnightTimer = setTimeout(() => this.refreshSchedules(), delay);
  }

  private clearNextDayTimer(): void {
    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer);
      this.midnightTimer = undefined;
    }
  }

  private isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  private normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private toIsoDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
