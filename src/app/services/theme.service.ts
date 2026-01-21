import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AppTheme = 'dark' | 'light';

const STORAGE_KEY = 'habit_tracker_theme';

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

  setTheme(theme: AppTheme): void {
    this.theme$.next(theme);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  }

  private initTheme(): void {
    let stored: AppTheme | null = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      stored = (localStorage.getItem(STORAGE_KEY) as AppTheme) || null;
    }
    this.setTheme(stored || 'dark');
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
