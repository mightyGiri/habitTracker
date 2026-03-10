import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AppTheme = 'dark';

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

  setTheme(theme: AppTheme = 'dark', themeKey?: string): void {
    this.theme$.next('dark');
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.remove('light-theme');
      document.documentElement.classList.add('dark-theme');
      if (typeof document.body !== 'undefined') {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
      }
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(THEME_KEY);
      localStorage.removeItem('theme');
    }
  }

  private initTheme(): void {
    this.setTheme('dark', 'dark');
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
