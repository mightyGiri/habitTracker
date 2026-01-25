import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ThemeService, AppTheme } from './theme.service';

export type ThemeMode = 'light' | 'dark';
export type FontSizePx = number;
export type AccentId =
  | 'orange'
  | 'purple'
  | 'green'
  | 'teal'
  | 'blue'
  | 'pink'
  | 'red'
  | 'yellow'
  | 'cyan'
  | 'violet';
export type AccentSetting = { type: 'preset'; value: AccentId } | { type: 'custom'; value: string };
export type FontFamilyId = 'system' | 'inter' | 'roboto' | 'poppins' | 'montserrat';

export type AppSettings = {
  themeMode: ThemeMode;
  accent: AccentSetting;
  fontSizePx: FontSizePx;
  fontFamily: FontFamilyId;
  notificationsEnabled: boolean;
  notificationTime: string;
};

const STORAGE_KEY = 'habit_tracker_settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private settings$ = new BehaviorSubject<AppSettings>(this.getDefaults());
  private mediaQuery?: MediaQueryList;
  private presetMap: Record<AccentId, string> = {
    orange: '#f27a2a',
    purple: '#7b68ee',
    green: '#3fb57a',
    teal: '#2fb6b1',
    blue: '#4a90e2',
    pink: '#ff6b9a',
    red: '#ef4444',
    yellow: '#f4b23a',
    cyan: '#22d3ee',
    violet: '#8b5cf6'
  };
  private fontMap: Record<FontFamilyId, string> = {
    system: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    inter: '"Inter", system-ui, sans-serif',
    roboto: '"Roboto", system-ui, sans-serif',
    poppins: '"Poppins", system-ui, sans-serif',
    montserrat: '"Montserrat", system-ui, sans-serif'
  };

  constructor(private themeService: ThemeService) {
    const loaded = this.load();
    this.settings$.next(loaded);
    this.applySettings(loaded);
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    }
  }

  getSettings() {
    return this.settings$.asObservable();
  }

  getSettingsSync(): AppSettings {
    return this.settings$.value;
  }

  updateSettings(patch: Partial<AppSettings>): void {
    const next = { ...this.settings$.value, ...patch };
    this.settings$.next(next);
    this.save(next);
    this.applySettings(next);
  }

  private applySettings(settings: AppSettings): void {
    this.applyThemeMode(settings.themeMode);
    this.applyAccent(settings.accent);
    this.applyFontSize(settings.fontSizePx);
    this.applyFontFamily(settings.fontFamily);
  }

  private applyThemeMode(mode: ThemeMode): void {
    this.themeService.setTheme(mode as AppTheme);
    this.setRootAttribute('data-theme', mode);
    this.setBodyClass(mode);
  }

  private applyAccent(accent: AccentSetting): void {
    if (accent.type === 'custom') {
      this.setRootAttribute('data-accent', 'custom');
      this.applyAccentTokens(accent.value);
      return;
    }
    this.setRootAttribute('data-accent', accent.value);
    const hex = this.presetMap[accent.value];
    this.applyAccentTokens(hex);
  }

  private applyFontSize(sizePx: FontSizePx): void {
    const clamped = Math.min(18, Math.max(12, sizePx));
    const scale = clamped / 16;
    this.setRootStyle('--font-scale', String(scale));
    this.setRootStyle('--app-font-size', `${clamped}px`);
    this.setRootStyle('--font-size', `${clamped}px`);
  }

  private applyFontFamily(family: FontFamilyId): void {
    const stack = this.fontMap[family] ?? this.fontMap.system;
    this.setRootAttribute('data-font', family);
    this.setRootStyle('--font-family', stack);
    this.setRootStyle('--app-font-family', stack);
    this.setRootStyle('--app-font', stack);
  }

  private load(): AppSettings {
    if (typeof window === 'undefined' || !window.localStorage) {
      return this.getDefaults();
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return this.getDefaults();
    }
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.accent === 'string') {
        const legacyAccent = parsed.accent === 'teal' ? 'green' : parsed.accent;
        parsed.accent = { type: 'preset', value: legacyAccent };
      }
      if (parsed.accent?.type === 'custom' && typeof parsed.accent?.value !== 'string') {
        parsed.accent = { type: 'preset', value: 'orange' };
      }
      if (parsed.themeMode === 'system') {
        const prefersDark = typeof window !== 'undefined' && window.matchMedia
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
          : true;
        parsed.themeMode = prefersDark ? 'dark' : 'light';
      }
      if (parsed.fontSizePx === undefined && parsed.fontScale !== undefined) {
        parsed.fontSizePx = Number(parsed.fontScale);
      }
      if (parsed.fontScale === 'sm') {
        parsed.fontSizePx = 14;
      }
      if (parsed.fontScale === 'md') {
        parsed.fontSizePx = 16;
      }
      if (parsed.fontScale === 'lg') {
        parsed.fontSizePx = 18;
      }
      if (typeof parsed.fontSizePx === 'string') {
        parsed.fontSizePx = Number(parsed.fontSizePx);
      }
      if (!Number.isFinite(parsed.fontSizePx)) {
        parsed.fontSizePx = 16;
      }
      if (!parsed.fontFamily) {
        parsed.fontFamily = 'system';
      }
      return { ...this.getDefaults(), ...parsed } as AppSettings;
    } catch {
      return this.getDefaults();
    }
  }

  private save(settings: AppSettings): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  private getDefaults(): AppSettings {
    return {
      themeMode: 'dark',
      accent: { type: 'preset', value: 'blue' },
      fontSizePx: 16,
      fontFamily: 'system',
      notificationsEnabled: false,
      notificationTime: '08:00'
    };
  }

  private setRootAttribute(name: string, value: string): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.setAttribute(name, value);
  }

  private setBodyClass(mode: ThemeMode): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(mode === 'dark' ? 'theme-dark' : 'theme-light');
  }

  private setRootStyle(name: string, value: string): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.style.setProperty(name, value);
  }

  private applyAccentTokens(hex: string): void {
    const rgb = this.hexToRgb(hex) ?? { r: 242, g: 122, b: 42 };
    const contrast = this.getContrastColor(rgb);
    const strong = this.mixWithBlack(rgb, 0.3);
    this.setRootStyle('--theme-accent', hex);
    this.setRootStyle('--accent', hex);
    this.setRootStyle('--app-accent', hex);
    this.setRootStyle('--theme-accent-soft', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`);
    this.setRootStyle('--theme-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`);
    this.setRootStyle('--accent-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`);
    this.setRootStyle('--accent-weak', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);
    this.setRootStyle('--accent-strong', `rgb(${strong.r}, ${strong.g}, ${strong.b})`);
    this.setRootStyle('--glow', `0 0 0 1px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2), 0 0 18px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);
    this.setRootStyle('--accent-contrast', contrast);
    this.setRootStyle('--theme-input-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);
    this.setRootStyle('--theme-input-border-hover', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55)`);
    this.setRootStyle('--accent-10', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
    this.setRootStyle('--accent-20', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);
    this.setRootStyle('--accent-28', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`);
    this.setRootStyle('--accent-35', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);
    this.setRootStyle('--accent-45', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`);
    this.setRootStyle('--accent-60', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const cleaned = hex.replace('#', '').trim();
    if (cleaned.length !== 6) {
      return null;
    }
    const r = Number.parseInt(cleaned.slice(0, 2), 16);
    const g = Number.parseInt(cleaned.slice(2, 4), 16);
    const b = Number.parseInt(cleaned.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) {
      return null;
    }
    return { r, g, b };
  }

  private getContrastColor(rgb: { r: number; g: number; b: number }): string {
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.6 ? '#1f1b16' : '#ffffff';
  }

  private mixWithBlack(
    rgb: { r: number; g: number; b: number },
    amount: number
  ): { r: number; g: number; b: number } {
    const factor = 1 - Math.min(Math.max(amount, 0), 1);
    return {
      r: Math.round(rgb.r * factor),
      g: Math.round(rgb.g * factor),
      b: Math.round(rgb.b * factor)
    };
  }
}
