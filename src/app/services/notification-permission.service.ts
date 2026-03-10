import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Capacitor, registerPlugin } from '@capacitor/core';

type PermissionStateLike = 'granted' | 'denied' | 'prompt' | string;
type PushPermissionStatus = { receive?: PermissionStateLike };
type PushNotificationsPluginLike = {
  checkPermissions: () => Promise<PushPermissionStatus>;
  requestPermissions: () => Promise<PushPermissionStatus>;
  register: () => Promise<void>;
};

const PushNotifications = registerPlugin<PushNotificationsPluginLike>('PushNotifications');

@Injectable({ providedIn: 'root' })
export class NotificationPermissionService {
  private deniedThisSession = false;
  private requestedThisSession = false;
  private inFlightCheck: Promise<boolean> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  async ensurePermission(userInitiated = false): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    if (this.inFlightCheck) {
      return this.inFlightCheck;
    }

    this.inFlightCheck = this.ensurePermissionInternal(userInitiated)
      .catch(error => {
        console.error('[NotificationPermission] ensurePermission failed', error);
        return false;
      })
      .finally(() => {
        this.inFlightCheck = null;
      });

    return this.inFlightCheck;
  }

  private async ensurePermissionInternal(userInitiated: boolean): Promise<boolean> {
    try {
      console.log('[NotificationPermission] check:start');
      const checked = await this.withTimeout(PushNotifications.checkPermissions(), 6000, 'check timeout');
      const current = checked?.receive ?? 'prompt';
      console.log('[NotificationPermission] check:result', current);

      if (current === 'granted') {
        await this.tryRegister();
        return true;
      }

      if (!userInitiated && (this.deniedThisSession || this.requestedThisSession)) {
        return false;
      }

      this.requestedThisSession = true;
      console.log('[NotificationPermission] request:start');
      const requested = await this.withTimeout(PushNotifications.requestPermissions(), 6000, 'request timeout');
      const result = requested?.receive ?? 'prompt';
      console.log('[NotificationPermission] request:result', result);

      if (result === 'granted') {
        this.deniedThisSession = false;
        await this.tryRegister();
        return true;
      }

      if (result === 'denied') {
        this.deniedThisSession = true;
      }
      return false;
    } catch (error) {
      console.error('[NotificationPermission] ensurePermissionInternal error', error);
      return false;
    }
  }

  private async tryRegister(): Promise<void> {
    try {
      await this.withTimeout(PushNotifications.register(), 6000, 'register timeout');
    } catch (error) {
      // Registration can fail if push plugin/native config is absent; permission may still be granted.
      console.warn('[NotificationPermission] register skipped/failed', error);
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(label)), timeoutMs);
      promise.then(
        value => {
          clearTimeout(timer);
          resolve(value);
        },
        error => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }
}
