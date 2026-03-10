import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Subscription, combineLatest, debounceTime, filter } from 'rxjs';
import { HabitStoreService } from './habit-store.service';
import { NotificationPermissionService } from './notification-permission.service';

const DAILY_NOTIFICATION_ID = 1000;
const HABIT_NOTIFICATION_ID_BASE = 2000;
const HABIT_NOTIFICATION_ID_SPAN = 50000;
const DEFAULT_DAILY_TIME = '20:30';

type ReminderPermissionState = 'granted' | 'denied' | 'unsupported';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private initialized = false;
  private subscriptions = new Subscription();
  private lastError: string | null = null;

  constructor(
    private habitStore: HabitStoreService,
    private notificationPermissionService: NotificationPermissionService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  init(): void {
    if (this.initialized || !isPlatformBrowser(this.platformId)) {
      return;
    }
    this.initialized = true;
    this.subscriptions.add(
      combineLatest([
        this.habitStore.getReady(),
        this.habitStore.getHabits(),
        this.habitStore.getCompletions(),
        this.habitStore.getSkips(),
        this.habitStore.getNotificationSettings$()
      ]).pipe(
        filter(([ready]) => ready),
        debounceTime(300)
      ).subscribe(() => {
        void this.syncFromStore();
      })
    );
  }

  dispose(): void {
    this.subscriptions.unsubscribe();
    this.subscriptions = new Subscription();
    this.initialized = false;
  }

  isSupported(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return this.isNative();
  }

  isNativeSchedulingAvailable(): boolean {
    return this.isSupported();
  }

  isEnabled(): boolean {
    return this.habitStore.getNotificationSettingsSync().dailyEnabled;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  async requestPermissionIfNeeded(): Promise<ReminderPermissionState> {
    this.lastError = null;
    if (!this.isNative()) {
      this.lastError = 'unsupported';
      return 'unsupported';
    }
    try {
      const granted = await this.notificationPermissionService.ensurePermission(true);
      if (!granted) {
        this.lastError = 'denied';
        return 'denied';
      }
      // Push notification permission covers Android 13 POST_NOTIFICATIONS; keep local plugin check as a scheduling fallback.
      const local = await LocalNotifications.checkPermissions();
      if (local.display === 'granted') {
        return 'granted';
      }
      const localRequested = await LocalNotifications.requestPermissions();
      if (localRequested.display === 'granted') {
        return 'granted';
      }
      this.lastError = 'denied';
      return 'denied';
    } catch {
      this.lastError = 'failed';
      return 'denied';
    }
  }

  async setEnabled(value: boolean): Promise<void> {
    this.habitStore.updateNotificationSettings({ dailyEnabled: value });
    if (!value) {
      await this.cancelAllManaged();
    }
  }

  async setDailyTime(time: string): Promise<void> {
    this.habitStore.updateNotificationSettings({ dailyTime: this.normalizeTime(time) });
    await this.syncFromStore();
  }

  async enableForToday(): Promise<void> {
    const permission = await this.requestPermissionIfNeeded();
    if (permission !== 'granted') {
      await this.setEnabled(false);
      return;
    }
    await this.setEnabled(true);
    await this.syncFromStore();
  }

  async disableAll(): Promise<void> {
    await this.setEnabled(false);
    await this.cancelAllManaged();
  }

  async resyncForToday(): Promise<void> {
    await this.syncFromStore();
  }

  async syncFromStore(): Promise<void> {
    this.lastError = null;
    if (!this.isNative()) {
      return;
    }
    const ready = this.habitStore.getReady();
    // guard against sync running before store hydration completes
    // getReady() is already in init subscription; direct calls may happen earlier.
    let storeReady = false;
    const sub = ready.subscribe(v => { storeReady = v; });
    sub.unsubscribe();
    if (!storeReady) {
      return;
    }

    try {
      // Do not prompt automatically here; just skip scheduling when permission is missing.
      const hasPermission = await this.notificationPermissionService.ensurePermission(false);
      if (!hasPermission) {
        return;
      }
      await this.cancelAllManaged();
      const notifications = this.buildNotificationsFromState();
      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications: notifications as any });
      }
    } catch (error) {
      this.lastError = 'failed';
    }
  }

  async cancelAllManaged(): Promise<void> {
    if (!this.isNative()) {
      return;
    }
    try {
      const ids = await this.getManagedNotificationIdsToCancel();
      if (ids.length === 0) {
        return;
      }
      await LocalNotifications.cancel({
        notifications: ids.map(id => ({ id }))
      });
    } catch {
      // ignore cancellation failures
    }
  }

  private buildNotificationsFromState(): any[] {
    const notifications: any[] = [];
    const today = new Date();
    const daily = this.habitStore.getNotificationSettingsSync();
    const summary = this.habitStore.getDaySummary(today);
    const pending = Math.max(summary.totalCount - summary.handledCount, 0);
    const isPerfect = summary.totalCount > 0 && summary.doneCount === summary.totalCount;

    if (daily.dailyEnabled && !isPerfect && pending > 0) {
      const { hour, minute } = this.parseTime(daily.dailyTime || DEFAULT_DAILY_TIME);
      notifications.push({
        id: DAILY_NOTIFICATION_ID,
        title: 'Level Up',
        body: `You have ${pending} ${pending === 1 ? 'habit' : 'habits'} left today.`,
        schedule: {
          on: { hour, minute },
          repeats: true
        }
      });
    }

    const habits = this.habitStore.getHabitsSync();
    for (const habit of habits) {
      if (!habit.isActive || !habit.reminderEnabled) {
        continue;
      }
      const reminderTime = this.normalizeTime(habit.reminderTime);
      const { hour, minute } = this.parseTime(reminderTime);
      const id = this.getHabitReminderId(habit.id);
      notifications.push({
        id,
        title: 'Level Up',
        body: `Habit: ${habit.name} - don't break the streak.`,
        schedule: {
          on: { hour, minute },
          repeats: true
        }
      });
    }

    return notifications;
  }

  private getManagedNotificationIds(): number[] {
    const ids = [DAILY_NOTIFICATION_ID];
    for (const habit of this.habitStore.getHabitsSync()) {
      ids.push(this.getHabitReminderId(habit.id));
    }
    return Array.from(new Set(ids));
  }

  private async getManagedNotificationIdsToCancel(): Promise<number[]> {
    const ids = new Set<number>(this.getManagedNotificationIds());
    try {
      const pending = await LocalNotifications.getPending();
      for (const notification of pending.notifications ?? []) {
        const id = Number(notification.id);
        if (!Number.isFinite(id)) {
          continue;
        }
        if (id === DAILY_NOTIFICATION_ID || (id >= HABIT_NOTIFICATION_ID_BASE && id < HABIT_NOTIFICATION_ID_BASE + HABIT_NOTIFICATION_ID_SPAN)) {
          ids.add(id);
        }
      }
    } catch {
      // fall back to current-state IDs only
    }
    return Array.from(ids);
  }

  private getHabitReminderId(habitId: string): number {
    return HABIT_NOTIFICATION_ID_BASE + (this.hashString(habitId) % HABIT_NOTIFICATION_ID_SPAN);
  }

  private hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  private parseTime(time: string): { hour: number; minute: number } {
    const normalized = this.normalizeTime(time);
    const [hourStr, minuteStr] = normalized.split(':');
    return {
      hour: Number(hourStr),
      minute: Number(minuteStr)
    };
  }

  private normalizeTime(time: string | undefined | null): string {
    const raw = String(time || '').trim();
    if (!/^\d{2}:\d{2}$/.test(raw)) {
      return DEFAULT_DAILY_TIME;
    }
    const [h, m] = raw.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) {
      return DEFAULT_DAILY_TIME;
    }
    const hour = Math.min(23, Math.max(0, h));
    const minute = Math.min(59, Math.max(0, m));
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  private isNative(): boolean {
    return isPlatformBrowser(this.platformId) && Capacitor.isNativePlatform();
  }
}

