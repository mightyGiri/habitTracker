import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { HabitStoreService } from './habit-store.service';
import { SettingsService } from './settings.service';

const REMINDER_HOURS = [7, 10, 13, 16, 19];
const REMINDER_BASE_ID = 51000;
const STREAK_WARNING_ID = 51050;
const CONGRATS_ID = 51999;
const PREF_KEY = 'notificationsEnabled';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private enabled = false;
  private initialized = false;
  private lastError: string | null = null;

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
    this.enabled = this.isEnabled();
    if (this.enabled) {
      void this.resyncForToday();
    }
  }

  dispose(): void {
    // no-op for now
  }

  isEnabled(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    return window.localStorage.getItem(PREF_KEY) === 'true';
  }

  isSupported(): boolean {
    if (this.isNative()) {
      return true;
    }
    return typeof Notification !== 'undefined' && typeof window !== 'undefined' && window.isSecureContext === true;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  async setEnabled(value: boolean): Promise<void> {
    this.enabled = value;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(PREF_KEY, value ? 'true' : 'false');
    }
    this.settingsService.updateSettings({ notificationsEnabled: value });
  }

  async enableForToday(): Promise<void> {
    this.lastError = null;
    try {
      if (this.isNative()) {
        const permission = await LocalNotifications.requestPermissions();
        if (permission.display !== 'granted') {
          this.lastError = 'denied';
          await this.setEnabled(false);
          return;
        }
        await this.setEnabled(true);
        await this.resyncForToday();
        return;
      }
      if (typeof Notification === 'undefined' || !window.isSecureContext) {
        this.lastError = 'unsupported';
        await this.setEnabled(false);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.lastError = 'denied';
        await this.setEnabled(false);
        return;
      }
      await this.setEnabled(true);
    } catch (error) {
      this.lastError = 'failed';
      await this.setEnabled(false);
    }
  }

  async disableAll(): Promise<void> {
    this.lastError = null;
    await this.setEnabled(false);
    await this.cancelAll();
  }

  async resyncForToday(): Promise<void> {
    this.lastError = null;
    if (!this.enabled || !this.isNative()) {
      return;
    }
    try {
      const pendingCount = this.getPendingCount();
      if (pendingCount <= 0) {
        await this.cancelAll();
        await this.showCongratsNow();
        return;
      }
      await this.cancelAll();
      const notifications = this.buildReminderNotifications(pendingCount);
      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
      }
      await this.scheduleStreakWarning(pendingCount);
    } catch (error) {
      this.lastError = 'failed';
    }
  }

  async showCongratsNow(): Promise<void> {
    if (!this.isNative()) {
      return;
    }
    try {
      const fireAt = new Date(Date.now() + 1000);
      await LocalNotifications.schedule({
        notifications: [
          {
            id: CONGRATS_ID,
            title: 'Leveled Up',
            body: 'Won today! Streak saved.',
            schedule: { at: fireAt }
          }
        ]
      });
    } catch {
      // ignore
    }
  }

  private buildReminderNotifications(pendingCount: number) {
    const now = new Date();
    const today = this.normalizeDate(now);
    return REMINDER_HOURS.flatMap((hour, index) => {
      const fireAt = new Date(today);
      fireAt.setHours(hour, 0, 0, 0);
      if (fireAt <= now) {
        return [];
      }
      return [{
        id: REMINDER_BASE_ID + index,
        title: 'Level Up',
        body: `${pendingCount} habits pending. Don't miss your streak.`,
        schedule: { at: fireAt }
      }];
    });
  }

  private async scheduleStreakWarning(pendingCount: number): Promise<void> {
    if (pendingCount <= 0) {
      return;
    }
    const now = new Date();
    const today = this.normalizeDate(now);
    const fireAt = new Date(today);
    fireAt.setHours(19, 0, 0, 0);
    if (fireAt <= now) {
      return;
    }
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: STREAK_WARNING_ID,
            title: 'Level Up',
            body: 'You are about to miss your streak. Finish now.',
            schedule: { at: fireAt }
          }
        ]
      });
    } catch {
      // ignore
    }
  }

  private async cancelAll(): Promise<void> {
    if (!this.isNative()) {
      return;
    }
    const notifications = REMINDER_HOURS.map((_, index) => ({ id: REMINDER_BASE_ID + index }));
    notifications.push({ id: STREAK_WARNING_ID });
    notifications.push({ id: CONGRATS_ID });
    try {
      await LocalNotifications.cancel({ notifications });
    } catch {
      // ignore
    }
  }

  private getPendingCount(): number {
    const summary = this.habitStore.getDaySummary(new Date());
    return Math.max(summary.totalCount - summary.handledCount, 0);
  }

  private isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  private normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }
}
