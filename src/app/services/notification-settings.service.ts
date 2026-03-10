import { Injectable } from '@angular/core';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

type EnableResult = { ok: boolean; reason?: string };

const PREF_KEY = 'dl_notifications_enabled';

@Injectable({ providedIn: 'root' })
export class NotificationSettingsService {
  isSupported(): boolean {
    return typeof Notification !== 'undefined' && typeof window !== 'undefined' && window.isSecureContext === true;
  }

  permission(): NotificationPermissionState {
    if (typeof Notification === 'undefined') {
      return 'unsupported';
    }
    return Notification.permission;
  }

  getUserPreference(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    return window.localStorage.getItem(PREF_KEY) === 'true';
  }

  setUserPreference(value: boolean): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(PREF_KEY, value ? 'true' : 'false');
  }

  async enable(): Promise<EnableResult> {
    if (!this.isSupported()) {
      this.setUserPreference(false);
      return { ok: false, reason: 'unsupported' };
    }
    const current = this.permission();
    if (current === 'granted') {
      this.setUserPreference(true);
      return { ok: true };
    }
    if (current === 'denied') {
      this.setUserPreference(false);
      return { ok: false, reason: 'denied' };
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.setUserPreference(true);
        return { ok: true };
      }
      this.setUserPreference(false);
      return { ok: false, reason: 'denied' };
    } catch (error) {
      this.setUserPreference(false);
      return { ok: false, reason: 'failed' };
    }
  }

  async disable(): Promise<void> {
    this.setUserPreference(false);
  }
}
