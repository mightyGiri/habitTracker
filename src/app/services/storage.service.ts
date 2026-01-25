import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';
import { HabitCompletion, Habit, MonthKey, HabitSkips, UserProfile, ProfileSettings } from '../models/habit.model';
import { AppTheme } from './theme.service';

const DB_NAME = 'habit-tracker-db';
const DB_VERSION = 1;
const STORE_NAME = 'app-state';
const STATE_KEY = 'state';
const LOCAL_STORAGE_KEY = 'habit_tracker_data';

export type PersistedState = {
  schemaVersion: number;
  habits: Habit[];
  completions: HabitCompletion;
  skips?: HabitSkips;
  selectedMonthYear: MonthKey;
  onboardingCompleted?: boolean;
  userProfile?: UserProfile;
  profile?: ProfileSettings;
  defaultsSeeded?: boolean;
  settings?: {
    theme?: AppTheme;
  };
};

@Injectable({ providedIn: 'root' })
export class StorageService {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  async loadState(): Promise<PersistedState | null> {
    if (!this.isIndexedDbAvailable()) {
      return this.loadFromLocalStorage();
    }
    try {
      const db = await this.getDb();
      const state = await db.get(STORE_NAME, STATE_KEY);
      if (state && typeof state === 'object' && typeof state.schemaVersion === 'number') {
        return state as PersistedState;
      }
    } catch (error) {
      console.warn('IndexedDB load failed, falling back to localStorage.', error);
    }
    return this.loadFromLocalStorage();
  }

  async saveState(state: PersistedState): Promise<void> {
    if (this.isIndexedDbAvailable()) {
      try {
        const db = await this.getDb();
        await db.put(STORE_NAME, state, STATE_KEY);
        return;
      } catch (error) {
        console.warn('IndexedDB save failed, falling back to localStorage.', error);
      }
    }
    this.saveToLocalStorage(state);
  }

  private async getDb(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db: IDBPDatabase) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        }
      });
    }
    return this.dbPromise;
  }

  private loadFromLocalStorage(): PersistedState | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.schemaVersion === 'number') {
        return parsed as PersistedState;
      }
      if (parsed && parsed.habits && parsed.completions && parsed.selectedMonthYear) {
        return {
          schemaVersion: 1,
          habits: parsed.habits as Habit[],
          completions: parsed.completions as HabitCompletion,
          skips: (parsed.skips as HabitSkips) || {},
          selectedMonthYear: parsed.selectedMonthYear as MonthKey,
          onboardingCompleted: typeof parsed.onboardingCompleted === 'boolean' ? parsed.onboardingCompleted : undefined,
          userProfile: (parsed.userProfile as UserProfile) || undefined,
          profile: (parsed.profile as ProfileSettings) || undefined,
          defaultsSeeded: typeof parsed.defaultsSeeded === 'boolean' ? parsed.defaultsSeeded : undefined
        };
      }
    } catch (error) {
      console.warn('Failed to parse localStorage state.', error);
    }
    return null;
  }

  private saveToLocalStorage(state: PersistedState): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save state to localStorage.', error);
    }
  }

  private isIndexedDbAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
  }
}
