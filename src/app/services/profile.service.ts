import { Injectable } from '@angular/core';
import { UserProfile } from '../models/habit.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private storageKey = 'levelup_profile';

  loadProfile(): UserProfile | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    const raw = window.localStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as UserProfile;
      if (!parsed || typeof parsed.persona !== 'string' || typeof parsed.primaryGoal !== 'string') {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  saveProfile(profile: UserProfile): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(this.storageKey, JSON.stringify(profile));
  }

  isOnboarded(): boolean {
    return Boolean(this.loadProfile());
  }
}
