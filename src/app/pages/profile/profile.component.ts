import { Component, OnDestroy, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';

import { CommonModule, isPlatformBrowser } from '@angular/common';

import { MatIconModule } from '@angular/material/icon';

import { MatFormFieldModule } from '@angular/material/form-field';

import { MatSelectModule } from '@angular/material/select';

import { MatInputModule } from '@angular/material/input';

import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterModule } from '@angular/router';

import { Subscription, combineLatest, map } from 'rxjs';

import { BackupService } from '../../services/backup.service';

import { HabitStoreService } from '../../services/habit-store.service';

import { SettingsService, FontSizePx, AccentId, AccentSetting, FontFamilyId } from '../../services/settings.service';

import { ThemeService } from '../../services/theme.service';

import { ImportConfirmDialogComponent, ImportConfirmDialogData } from '../../shared/import-confirm-dialog.component';

import { staggerFadeUp, noopAnimation } from '../../shared/list-animations';

import { ProfileEditDialogComponent, ProfileEditResult } from './profile-edit-dialog.component';

import { ProfileSettings, UserProfile } from '../../models/habit.model';
import { ToggleComponent } from '../../shared/ui/toggle/toggle.component';

import { getLevelProgress, LevelProgress } from '../../shared/level-utils';
import { VersionService } from '../../services/version.service';
import { NotificationService } from '../../services/notification.service';



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

    MatIconModule,

    MatFormFieldModule,

    MatSelectModule,

    MatInputModule,

    MatDialogModule,

    MatSnackBarModule,
    RouterModule,
    ToggleComponent
  ],

  animations: [staggerFadeUp || noopAnimation],

  
  template: `
    <div class=\"page-container profile-page\" [@.disabled]=\"reduceMotion\">
      <h1 class=\"page-title\">Profile</h1>

      <div class=\"profile-header arcane-card\" [@staggerFadeUp]=\"animationKey\">
        <div class=\"avatar-circle\">{{ initials }}</div>
        <div class=\"profile-meta\">
          <div class=\"profile-name\">{{ displayName }}</div>
          <div class=\"profile-subtitle\">{{ profileSubtitle }}</div>
        </div>
        <button class=\"edit-pill glass-btn glass-btn--ghost\" type=\"button\" (click)=\"openEditProfileDialog()\">Edit</button>
      </div>

      <section class=\"settings-section arcane-card\" [@staggerFadeUp]=\"animationKey\">
        <div class=\"settings-list\">
          <div class=\"settings-row\">
            <div class=\"row-label\">Level</div>
            <div class=\"row-value\"><span class=\"glass-pill\">Lv {{ levelStats.level }}</span></div>
          </div>
          <div class=\"settings-row\">
            <div class=\"row-label\">Total wins</div>
            <div class=\"row-value\">{{ levelStats.totalDone }}</div>
          </div>
          <div class=\"settings-row\" *ngIf=\"personaLabel\">
            <div class=\"row-label\">Persona</div>
            <div class=\"row-value\">{{ personaLabel }}</div>
          </div>
          <div class=\"settings-row\" *ngIf=\"goalLabel\">
            <div class=\"row-label\">Goal</div>
            <div class=\"row-value\">{{ goalLabel }}</div>
          </div>
          <div class=\"settings-row\" *ngIf=\"whyStatement\">
            <div class=\"row-label\">Why</div>
            <div class=\"row-value row-wrap\">{{ whyStatement }}</div>
          </div>
        </div>
      </section>

      <section class=\"section-block arcane-card\" [@staggerFadeUp]=\"animationKey\">
        <button class=\"section-toggle glass-btn glass-btn--ghost\" type=\"button\" (click)=\"dataOpen = !dataOpen\">
          <span class=\"text-section\">Data & Backup</span>
          <mat-icon>{{ dataOpen ? 'expand_less' : 'expand_more' }}</mat-icon>
        </button>
        <div class=\"section-body\" *ngIf=\"dataOpen\">
          <div class=\"section-helper text-muted\">Offline-first. Export a backup anytime.</div>
          <div class=\"data-actions\">
            <button class=\"btn btn-outline btn-sm glass-btn glass-btn--ghost\" type=\"button\" (click)=\"exportJson()\">Export backup (JSON)</button>
            <button class=\"btn btn-outline btn-sm glass-btn glass-btn--ghost\" type=\"button\" (click)=\"triggerImportJson(importInput)\">Restore backup (JSON)</button>
            <button class=\"btn btn-outline btn-sm glass-btn glass-btn--ghost\" type=\"button\" (click)=\"exportCsv()\">Export as CSV</button>
            <button class=\"btn btn-outline btn-sm glass-btn glass-btn--ghost\" type=\"button\" (click)=\"exportXlsx()\" [disabled]=\"exportingXlsx\">
              {{ exportingXlsx ? 'Exporting...' : 'Export as Excel' }}
            </button>
          </div>
          <input
            #importInput
            type=\"file\"
            hidden
            class=\"visually-hidden\"
            accept=\".json,application/json\"
            (change)=\"onImportJson($event)\">
        </div>
      </section>

      <section class=\"section-block arcane-card\" [@staggerFadeUp]=\"animationKey\">
        <button class=\"section-toggle glass-btn glass-btn--ghost\" type=\"button\" (click)=\"personalizationOpen = !personalizationOpen\">
          <span class=\"text-section\">Personalization</span>
          <mat-icon>{{ personalizationOpen ? 'expand_less' : 'expand_more' }}</mat-icon>
        </button>
        <div class=\"section-body\" *ngIf=\"personalizationOpen\">
          <div class=\"section-helper text-muted\">Optional. Focus on habits first.</div>
          <div class=\"field-grid\">
            <div class=\"control-group\">
              <div class=\"compact-label text-label\">
                Font size: {{ fontSizeLabel }}
              </div>
              <input
                type=\"range\"
                min=\"12\"
                max=\"18\"
                step=\"1\"
                class=\"font-slider\"
                [value]=\"fontSizePx\"
                (input)=\"setFontSizeFromRange($event)\">
            </div>
            <div class=\"control-group\">
              <div class=\"compact-label text-label\">Notifications</div>
              <app-toggle [checked]=\"notificationsEnabled\" (checkedChange)=\"toggleNotifications($event)\"></app-toggle>
            </div>
          </div>
          <!-- <div class=\"font-family-row\">
            <mat-form-field appearance=\"fill\" class=\"appearance-field\">
              <mat-label>Font Family</mat-label>
              <mat-select [value]=\"fontFamily\" (selectionChange)=\"updateFontFamily($event.value)\">
                <mat-option value=\"system\">System UI</mat-option>
                <mat-option value=\"inter\">Inter</mat-option>
                <mat-option value=\"roboto\">Roboto</mat-option>
                <mat-option value=\"poppins\">Poppins</mat-option>
                <mat-option value=\"montserrat\">Montserrat</mat-option>
              </mat-select>
            </mat-form-field>
          </div> -->

          <div class=\"accent-row\">
            <div class=\"text-body\">Accent</div>
            <div class=\"accent-swatches\">
              <button
                class=\"accent-swatch\"
                *ngFor=\"let preset of accentPresets\"
                [style.background]=\"preset.color\"
                [class.is-active]=\"isAccentPresetActive(preset.id)\"
                (click)=\"setAccentPreset(preset.id)\"
                [attr.aria-label]=\"preset.name\">
                <span class=\"swatch-check\" *ngIf=\"isAccentPresetActive(preset.id)\">&#x2713;</span>
              </button>
            </div>
            <div class=\"custom-accent\" [class.is-active]=\"accent.type === 'custom'\">
              <label class=\"text-label\">Custom</label>
              <input type=\"color\" [value]=\"customAccent\" (input)=\"setCustomAccent($event)\">
            </div>
          </div>
        </div>
      </section>
      <section class="section-block arcane-card" [@staggerFadeUp]="animationKey">
        <button class="section-toggle glass-btn glass-btn--ghost" type="button" (click)="helpOpen = !helpOpen">
          <span class="text-section">Help & About</span>
          <mat-icon>{{ helpOpen ? 'expand_less' : 'expand_more' }}</mat-icon>
        </button>
        <div class="section-body" *ngIf="helpOpen">
          <div class="settings-list">
            <div class="settings-row">
              <div class="row-label">Built by</div>
              <div class="row-value">Giri</div>
            </div>
            <div class="settings-row">
              <div class="row-label">Version</div>
              <div class="row-value">{{ versionLabel$ | async }}</div>
            </div>
            <div class="settings-row">
              <div class="row-label">Privacy</div>
              <div class="row-value row-wrap">Beta version. Offline-first. No cloud. No tracking.</div>
            </div>
          </div>
          <div class="link-list">
            <button class="link" type="button" routerLink="/about">About app</button>
            <button class="link" type="button" routerLink="/terms">Terms</button>
            <button class="link" type="button" routerLink="/privacy">Privacy</button>
          </div>
        </div>
      </section>



    </div>

  `,


  styleUrls: ['./profile.component.sass']

})

export class ProfileComponent implements OnInit, OnDestroy {

  reduceMotion = false;

  animationKey = 0;

  exportingXlsx = false;

  accent: AccentSetting = { type: 'preset', value: 'orange' };

  fontSizePx: FontSizePx = 16;

  fontFamily: FontFamilyId = 'system';
  notificationsEnabled = false;
  notificationsSupported = false;
  notificationsLoading = false;

  customAccent = '#f27a2a';

  readonly versionLabel$;

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
  helpOpen = false;

  accentPresets: AccentPreset[] = [

    { id: 'orange', name: 'Orange', color: '#f27a2a' },

    { id: 'green', name: 'Green', color: '#3fb57a' },

    { id: 'blue', name: 'Blue', color: '#4a90e2' },

    { id: 'pink', name: 'Pink', color: '#ff6b9a' },

    { id: 'teal', name: 'Teal', color: '#2fb6b1' },

    { id: 'red', name: 'Red', color: '#ef4444' },

    { id: 'yellow', name: 'Yellow', color: '#f4b23a' },

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

    private versionService: VersionService,

    private notificationService: NotificationService,

    private cdr: ChangeDetectorRef,

    @Inject(PLATFORM_ID) private platformId: Object

  ) {
    this.versionLabel$ = combineLatest([
      this.versionService.getVersion$(),
      this.versionService.getBuild$()
    ]).pipe(
      map(([version, build]) => build !== null ? `Version ${version} (Build ${build})` : `Version ${version}`)
    );
  }



  ngOnInit(): void {

    this.subscription.add(

      this.themeService.getReducedMotion().subscribe(reduce => {

        this.reduceMotion = reduce;

      })

    );

    this.subscription.add(

      this.settingsService.getSettings().subscribe(settings => {

        this.accent = settings.accent;

        this.fontSizePx = settings.fontSizePx;

        this.fontFamily = settings.fontFamily;
        this.notificationsEnabled = settings.notificationsEnabled;

        if (settings.accent.type === 'custom') {

          this.customAccent = settings.accent.value;

        }
        this.notificationsSupported = this.notificationService.isSupported();
        if (!this.notificationsSupported) {
          this.notificationsEnabled = false;
          this.settingsService.updateSettings({ notificationsEnabled: false });
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



  openEditProfileDialog(): void {
    const dialogRef = this.dialog.open<ProfileEditDialogComponent, {
      displayName: string;
      persona: string;
      goal: string;
      why: string;
    }, ProfileEditResult | null>(ProfileEditDialogComponent, {
      data: {
        displayName: this.displayName,
        persona: this.personaLabel,
        goal: this.goalLabel,
        why: this.whyStatement
      },
      panelClass: ['profile-edit-modal']
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) {
        return;
      }
      const displayName = result.displayName.trim();
      const persona = result.persona.trim();
      const goal = result.goal.trim();
      const why = result.why.trim();

      this.displayName = displayName || this.displayName;
      this.personaLabel = persona || '';
      this.goalLabel = goal || '';
      this.whyStatement = why || '';

      this.profile = { ...this.profile, displayName: displayName || undefined };
      const baseProfile = this.userProfile ?? { name: 'Guest', createdAt: Date.now() };
      this.userProfile = {
        ...baseProfile,
        name: displayName || baseProfile.name || 'Guest',
        persona: persona || undefined,
        primaryGoal: goal || undefined,
        whyStatement: why || undefined,
        why: why || undefined
      };

      this.habitStore.setProfile(this.profile);

      const existing = this.userProfile;
      this.habitStore.setUserProfile({
        name: displayName || existing?.name || 'Guest',
        persona: persona || undefined,
        primaryGoal: goal || undefined,
        whyStatement: why || undefined,
        why: why || undefined,
        createdAt: existing?.createdAt ?? Date.now()
      });
      this.cdr.detectChanges();
    });
  }



  async exportJson(): Promise<void> {
    try {
      const result = await this.backupService.exportBackup();
      if (result.status === 'success') {
        const locationSuffix = result.location ? ` (${result.location})` : '';
        this.snackBar.open(`Backup exported successfully${locationSuffix}`, 'Close', { duration: 3000 });
        return;
      }
      if (result.status === 'cancelled') {
        this.snackBar.open('Export cancelled', 'Close', { duration: 2000 });
        return;
      }
      console.error('Export failed', result.error);
      this.snackBar.open('Export failed', 'Close', { duration: 2500 });
    } catch (error) {
      console.error('Export failed', error);
      this.snackBar.open('Export failed', 'Close', { duration: 2500 });
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



  async toggleNotifications(enabled: boolean): Promise<void> {
    if (this.notificationsLoading) {
      return;
    }
    this.notificationsSupported = this.notificationService.isSupported();
    if (!this.notificationsSupported) {
      this.notificationsEnabled = false;
      this.settingsService.updateSettings({ notificationsEnabled: false });
      this.snackBar.open('Notifications require HTTPS and a supported browser.', 'Close', { duration: 2500 });
      return;
    }
    this.notificationsLoading = true;
    if (enabled) {
      await this.notificationService.setEnabled(true);
      await this.notificationService.enableForToday();
      const error = this.notificationService.getLastError();
      if (error) {
        this.notificationsEnabled = false;
        this.settingsService.updateSettings({ notificationsEnabled: false });
        const message = error === 'denied'
          ? 'Permission denied. Enable from browser settings.'
          : 'Notifications not supported on this device.';
        this.snackBar.open(message, 'Close', { duration: 3000 });
      } else {
        this.notificationsEnabled = true;
        this.snackBar.open('Notifications enabled ✅', 'Close', { duration: 2000 });
      }
    } else {
      await this.notificationService.setEnabled(false);
      await this.notificationService.disableAll();
      this.notificationsEnabled = false;
      this.snackBar.open('Notifications off', 'Close', { duration: 1500 });
    }
    this.notificationsLoading = false;
    this.cdr.markForCheck();
  }

  get initials(): string {
    const name = (this.displayName || 'Player').trim();
    if (!name) {
      return 'P';
    }
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 1).toUpperCase();
    }
    const first = parts[0].slice(0, 1);
    const last = parts[parts.length - 1].slice(0, 1);
    return `${first}${last}`.toUpperCase();
  }

  get profileSubtitle(): string {
    return this.personaLabel || this.goalLabel || this.whyStatement || 'Build consistency';
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












































