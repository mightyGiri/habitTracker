import { Component, OnDestroy, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { BackupService } from '../../services/backup.service';
import { HabitStoreService } from '../../services/habit-store.service';
import { SettingsService, ThemeMode, FontSizePx, AccentId, AccentSetting, FontFamilyId } from '../../services/settings.service';
import { ThemeService } from '../../services/theme.service';
import { ImportConfirmDialogComponent, ImportConfirmDialogData } from '../../shared/import-confirm-dialog.component';
import { staggerFadeUp, noopAnimation } from '../../shared/list-animations';
import { ProfileNameDialogComponent } from './profile-name-dialog.component';
import { ProfileSettings, UserProfile } from '../../models/habit.model';
import { getLevelProgress, LevelProgress } from '../../shared/level-utils';

type AccentPreset = { id: AccentId; name: string; color: string };
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  animations: [staggerFadeUp || noopAnimation],
  template: `
    <div class="page-container profile-page" [@.disabled]="reduceMotion">
      <h1 class="text-title page-title">Profile</h1>

      <mat-card class="aesthetic-card profile-section" [@staggerFadeUp]="animationKey">
        <div class="section-header text-section">Account</div>
        <mat-card-content class="card-body">
          <div class="row-between">
            <div>
              <div class="text-body">Your name</div>
              <div class="text-muted">{{ displayName }}</div>
              <div class="text-muted helper-text">Used for motivation messages and streaks.</div>
              <div class="text-muted helper-text">Your character name in this game.</div>
              <div class="text-muted level-row">Level {{ levelStats.level }} • {{ levelStats.totalDone }} total wins</div>
              <div class="account-meta">
                <span *ngIf="personaLabel" class="text-muted">Persona: {{ personaLabel }}</span>
                <span *ngIf="goalLabel" class="text-muted">Goal: {{ goalLabel }}</span>
                <span *ngIf="whyStatement" class="text-muted why-text">Why: {{ whyStatement }}</span>
              </div>
            </div>
            <button class="btn btn-outline btn-sm edit-button" type="button" (click)="openNameDialog()">Edit</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="aesthetic-card profile-section" [@staggerFadeUp]="animationKey">
        <button class="section-toggle" type="button" (click)="dataOpen = !dataOpen">
          <span class="text-section">Data & Backup</span>
          <mat-icon>{{ dataOpen ? 'expand_less' : 'expand_more' }}</mat-icon>
        </button>
        <mat-card-content class="card-body" *ngIf="dataOpen">
          <div class="section-helper text-muted">Offline-first. Export a backup anytime.</div>
          <div class="data-actions">
            <button class="btn btn-outline btn-sm" type="button" (click)="exportJson()">Export backup (JSON)</button>
            <button class="btn btn-outline btn-sm" type="button" (click)="triggerImportJson(importInput)">Restore backup (JSON)</button>
            <button class="btn btn-outline btn-sm" type="button" (click)="exportCsv()">Export as CSV</button>
            <button class="btn btn-outline btn-sm" type="button" (click)="exportXlsx()" [disabled]="exportingXlsx">
              {{ exportingXlsx ? 'Exporting...' : 'Export as Excel' }}
            </button>
          </div>
          <input
            #importInput
            type="file"
            hidden
            class="visually-hidden"
            accept=".json,application/json"
            (change)="onImportJson($event)">
        </mat-card-content>
      </mat-card>

      <mat-card class="aesthetic-card profile-section" [@staggerFadeUp]="animationKey">
        <button class="section-toggle" type="button" (click)="personalizationOpen = !personalizationOpen">
          <span class="text-section">Personalization</span>
          <mat-icon>{{ personalizationOpen ? 'expand_less' : 'expand_more' }}</mat-icon>
        </button>
        <mat-card-content class="card-body" *ngIf="personalizationOpen">
          <div class="section-helper text-muted">Optional. Focus on habits first.</div>
          <div class="field-grid">
            <div class="control-group">
              <mat-form-field appearance="fill" class="appearance-field">
                <mat-label>Theme</mat-label>
                <mat-select [value]="themeMode" (selectionChange)="updateThemeMode($event.value)">
                  <mat-option value="dark">Dark</mat-option>
                  <mat-option value="light">Light</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
            <div class="control-group">
              <div class="compact-label text-label">
                Font size: {{ fontSizeLabel }}
              </div>
              <input
                type="range"
                min="12"
                max="18"
                step="1"
                class="font-slider"
                [value]="fontSizePx"
                (input)="setFontSizeFromRange($event)">
            </div>
          </div>

          <div class="font-family-row">
            <mat-form-field appearance="fill" class="appearance-field">
              <mat-label>Font Family</mat-label>
              <mat-select [value]="fontFamily" (selectionChange)="updateFontFamily($event.value)">
                <mat-option value="system">System UI</mat-option>
                <mat-option value="inter">Inter</mat-option>
                <mat-option value="roboto">Roboto</mat-option>
                <mat-option value="poppins">Poppins</mat-option>
                <mat-option value="montserrat">Montserrat</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="accent-row">
            <div class="text-body">Accent</div>
            <div class="accent-swatches">
              <button
                class="accent-swatch"
                *ngFor="let preset of accentPresets"
                [style.background]="preset.color"
                [class.is-active]="isAccentPresetActive(preset.id)"
                (click)="setAccentPreset(preset.id)"
                [attr.aria-label]="preset.name">
                <span class="swatch-check" *ngIf="isAccentPresetActive(preset.id)">&#x2713;</span>
              </button>
            </div>
            <div class="custom-accent" [class.is-active]="accent.type === 'custom'">
              <label class="text-label">Custom</label>
              <input type="color" [value]="customAccent" (input)="setCustomAccent($event)">
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="aesthetic-card profile-section" [@staggerFadeUp]="animationKey">
        <div class="section-header text-section">Help & About</div>
        <mat-card-content class="card-body">
          <div class="meta-grid">
            <div class="meta-label">Built by</div>
            <div class="meta-value">Giri</div>
            <div class="meta-label">Version</div>
            <div class="meta-value">{{ appVersion }}</div>
            <div class="meta-label">Privacy</div>
            <div class="meta-value meta-privacy">Offline-first. No cloud. No tracking.</div>
            <div class="meta-label">Links</div>
            <div class="meta-value">
              <div class="help-links">
                <button class="link-button" type="button" (click)="installPwa()" [disabled]="!canInstall">Install app</button>
                <button class="link-button" type="button" disabled>Terms</button>
                <button class="link-button" type="button" disabled>Privacy</button>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrls: ['./profile.component.sass']
})
export class ProfileComponent implements OnInit, OnDestroy {
  reduceMotion = false;
  animationKey = 0;
  exportingXlsx = false;
  themeMode: ThemeMode = 'dark';
  accent: AccentSetting = { type: 'preset', value: 'orange' };
  fontSizePx: FontSizePx = 16;
  fontFamily: FontFamilyId = 'system';
  customAccent = '#f27a2a';
  appVersion = '0.1.0';
  canInstall = false;
  displayName = 'Guest';
  profile: ProfileSettings = {};
  userProfile: UserProfile | null = null;
  personaLabel = '';
  goalLabel = '';
  whyStatement = '';
  levelStats: LevelProgress = getLevelProgress(0);
  dataOpen = false;
  personalizationOpen = false;
  accentPresets: AccentPreset[] = [
    { id: 'orange', name: 'Orange', color: '#f27a2a' },
    { id: 'purple', name: 'Purple', color: '#7b68ee' },
    { id: 'green', name: 'Green', color: '#3fb57a' },
    { id: 'blue', name: 'Blue', color: '#4a90e2' },
    { id: 'pink', name: 'Pink', color: '#ff6b9a' },
    { id: 'teal', name: 'Teal', color: '#2fb6b1' },
    { id: 'red', name: 'Red', color: '#ef4444' },
    { id: 'yellow', name: 'Yellow', color: '#f4b23a' },
    { id: 'cyan', name: 'Cyan', color: '#22d3ee' },
    { id: 'violet', name: 'Violet', color: '#8b5cf6' }
  ];

  private subscription = new Subscription();
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private installListener?: (event: Event) => void;

  constructor(
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private backupService: BackupService,
    private habitStore: HabitStoreService,
    private settingsService: SettingsService,
    private themeService: ThemeService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.themeService.getReducedMotion().subscribe(reduce => {
        this.reduceMotion = reduce;
      })
    );
    this.subscription.add(
      this.settingsService.getSettings().subscribe(settings => {
        this.themeMode = settings.themeMode;
        this.accent = settings.accent;
        this.fontSizePx = settings.fontSizePx;
        this.fontFamily = settings.fontFamily;
        if (settings.accent.type === 'custom') {
          this.customAccent = settings.accent.value;
        }
      })
    );
    this.subscription.add(
      this.habitStore.getLevelStats().subscribe(levelStats => {
        this.levelStats = levelStats;
      })
    );
    this.subscription.add(
      this.habitStore.getProfile().subscribe(profile => {
        this.profile = profile;
        this.displayName = this.resolveDisplayName(profile, this.userProfile);
      })
    );
    this.subscription.add(
      this.habitStore.getUserProfile().subscribe(profile => {
        this.userProfile = profile;
        this.displayName = this.resolveDisplayName(this.profile, profile);
        this.personaLabel = profile?.persona ? String(profile.persona) : '';
        this.goalLabel = profile?.primaryGoal ? String(profile.primaryGoal) : '';
        this.whyStatement = profile?.whyStatement || profile?.why || '';
      })
    );

    if (isPlatformBrowser(this.platformId)) {
      this.installListener = (event: Event) => {
        event.preventDefault();
        this.deferredPrompt = event as BeforeInstallPromptEvent;
        this.canInstall = true;
      };
      window.addEventListener('beforeinstallprompt', this.installListener);
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    if (this.installListener) {
      window.removeEventListener('beforeinstallprompt', this.installListener);
    }
  }

  updateThemeMode(mode: ThemeMode): void {
    this.settingsService.updateSettings({ themeMode: mode });
  }

  updateFontFamily(fontFamily: FontFamilyId): void {
    this.settingsService.updateSettings({ fontFamily });
  }

  setAccentPreset(preset: AccentId): void {
    this.settingsService.updateSettings({ accent: { type: 'preset', value: preset } });
  }

  setCustomAccent(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value) {
      return;
    }
    this.customAccent = value;
    this.settingsService.updateSettings({ accent: { type: 'custom', value } });
  }

  isAccentPresetActive(preset: AccentId): boolean {
    return this.accent.type === 'preset' && this.accent.value === preset;
  }

  setFontSizeFromRange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) {
      return;
    }
    this.settingsService.updateSettings({ fontSizePx: value });
  }

  get fontSizeLabel(): string {
    return `${this.fontSizePx}px`;
  }

  installPwa(): void {
    if (!this.deferredPrompt) {
      return;
    }
    void this.deferredPrompt.prompt();
    void this.deferredPrompt.userChoice.then(() => {
      this.deferredPrompt = null;
      this.canInstall = false;
    });
  }

  openNameDialog(): void {
    const dialogRef = this.dialog.open<ProfileNameDialogComponent, { displayName: string }, string | null>(
      ProfileNameDialogComponent,
      {
        data: { displayName: this.displayName }
      }
    );
    dialogRef.afterClosed().subscribe(result => {
      if (result === null) {
        return;
      }
      this.habitStore.setProfile({ ...this.profile, displayName: result });
    });
  }

  exportJson(): void {
    try {
      this.backupService.exportJsonBackup();
      this.snackBar.open('Export completed', 'Close', { duration: 2000 });
    } catch (error) {
      console.error('Export failed', error);
      this.snackBar.open('Export failed', 'Close', { duration: 2000 });
    }
  }

  exportCsv(): void {
    try {
      this.backupService.exportDailyCountsCsv();
      this.snackBar.open('Export completed', 'Close', { duration: 2000 });
    } catch (error) {
      console.error('Export failed', error);
      this.snackBar.open('Export failed', 'Close', { duration: 2000 });
    }
  }

  exportXlsx(): void {
    this.exportingXlsx = true;
    try {
      this.backupService.exportXlsx();
      this.snackBar.open('Export completed', 'Close', { duration: 2000 });
    } catch (error) {
      console.error('Export failed', error);
      this.snackBar.open('Export failed', 'Close', { duration: 2000 });
    } finally {
      this.exportingXlsx = false;
    }
  }

  triggerImportJson(input: HTMLInputElement): void {
    input.click();
  }

  onImportJson(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files && target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result || '');
        const parsed = JSON.parse(raw);
        const validation = this.validateBackup(parsed);
        if (!validation.valid) {
          this.snackBar.open(validation.message, 'Close', { duration: 2500 });
          return;
        }

        const dialogRef = this.dialog.open<ImportConfirmDialogComponent, ImportConfirmDialogData, 'replace' | 'merge' | undefined>(
          ImportConfirmDialogComponent,
          {
            data: {
              title: 'Import backup?',
              message: 'This will replace your current data or merge it with the backup.'
            }
          }
        );

        dialogRef.afterClosed().subscribe(result => {
          if (!result) {
            return;
          }
          this.habitStore.restoreFromBackup(parsed, result);
          if (parsed.appSettings?.theme === 'dark' || parsed.appSettings?.theme === 'light') {
            this.settingsService.updateSettings({ themeMode: parsed.appSettings.theme });
          }
          if (Array.isArray(parsed.habits) && parsed.habits.length === 0) {
            this.snackBar.open('Import completed (no habits found)', 'Close', { duration: 2500 });
          } else {
            this.snackBar.open(result === 'merge' ? 'Import completed (merged)' : 'Import completed', 'Close', { duration: 2000 });
          }
        });
      } catch (error) {
        console.error('Import failed', error);
        this.snackBar.open('Invalid JSON file', 'Close', { duration: 2500 });
      }
    };
    reader.onerror = () => {
      this.snackBar.open('Failed to read file', 'Close', { duration: 2500 });
    };
    reader.readAsText(file);
    target.value = '';
  }

  private validateBackup(data: any): { valid: boolean; message: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, message: 'Invalid backup file' };
    }
    if (data.schemaVersion !== 1) {
      return { valid: false, message: 'Unsupported schema version' };
    }
    if (!data.exportedAt || typeof data.exportedAt !== 'string') {
      return { valid: false, message: 'Missing exportedAt' };
    }
    if (!Array.isArray(data.habits)) {
      return { valid: false, message: 'Missing habits list' };
    }
    if (!data.checks || typeof data.checks !== 'object') {
      return { valid: false, message: 'Missing checks data' };
    }
    return { valid: true, message: 'OK' };
  }

  private resolveDisplayName(profile: ProfileSettings, userProfile: UserProfile | null): string {
    return profile.displayName?.trim() || userProfile?.name?.trim() || 'Guest';
  }
}

// Manual test checklist:
// - Display name persists after refresh.
// - Export/restore still works.
// - Data & Backup and Personalization sections collapse/expand.
// - No overflow behind bottom nav on small screens.
