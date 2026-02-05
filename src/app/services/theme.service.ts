import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AppTheme = 'dark' | 'light';

const STORAGE_KEY = 'habit_tracker_theme';
const THEME_KEY = 'themeKey';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private theme$ = new BehaviorSubject<AppTheme>('dark');
  private reduceMotion$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.initTheme();
    this.initReducedMotion();
  }

  getTheme() {
    return this.theme$.asObservable();
  }

  getThemeSync(): AppTheme {
    return this.theme$.value;
  }

  getReducedMotion() {
    return this.reduceMotion$.asObservable();
  }

  getReducedMotionSync(): boolean {
    return this.reduceMotion$.value;
  }

  toggleTheme(): void {
    const next: AppTheme = this.theme$.value === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }

  setTheme(theme: AppTheme, themeKey?: string): void {
    this.theme$.next(theme);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, theme);
      if (themeKey) {
        localStorage.setItem(THEME_KEY, themeKey);
      }
    }
  }

  getSavedThemeKey(): string | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return localStorage.getItem(THEME_KEY);
  }

  private initTheme(): void {
    let stored: AppTheme | null = null;
    let storedKey: string | null = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      stored = (localStorage.getItem(STORAGE_KEY) as AppTheme) || null;
      storedKey = localStorage.getItem(THEME_KEY);
    }
    this.setTheme(stored || 'dark', storedKey || stored || 'dark');
  }

  private initReducedMotion(): void {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => this.reduceMotion$.next(media.matches);
    update();
    media.addEventListener('change', update);
  }
}
