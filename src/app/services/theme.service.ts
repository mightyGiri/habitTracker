import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AppTheme = 'system' | 'professional' | 'minimal';

const STORAGE_KEY = 'llu_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private theme$ = new BehaviorSubject<AppTheme>('system');
  private reduceMotion$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.initTheme();
    this.initReducedMotion();
  }

  getTheme() { return this.theme$.asObservable(); }
  getThemeSync(): AppTheme { return this.theme$.value; }
  getReducedMotion() { return this.reduceMotion$.asObservable(); }
  getReducedMotionSync(): boolean { return this.reduceMotion$.value; }

  setTheme(theme: AppTheme): void {
    this.theme$.next(theme);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  }

  private initTheme(): void {
    let saved: AppTheme = 'system';
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'system' || raw === 'professional' || raw === 'minimal') {
        saved = raw;
      }
    }
    this.setTheme(saved);
  }

  private initReducedMotion(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => this.reduceMotion$.next(media.matches);
    update();
    media.addEventListener('change', update);
  }
}
