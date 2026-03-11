import { Component, OnDestroy, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';

import { CommonModule, isPlatformBrowser } from '@angular/common';

import { MatIconModule } from '@angular/material/icon';

import { MatFormFieldModule } from '@angular/material/form-field';

import { MatSelectModule } from '@angular/material/select';

import { MatInputModule } from '@angular/material/input';

import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterModule } from '@angular/router';

import { Subscription } from 'rxjs';

import { BackupService } from '../../services/backup.service';

import { HabitStoreService } from '../../services/habit-store.service';

import { SettingsService, FontSizePx, AccentId, AccentSetting, FontFamilyId } from '../../services/settings.service';

import { ThemeService, AppTheme } from '../../services/theme.service';

import { staggerFadeUp, noopAnimation } from '../../shared/list-animations';

import { ProfileEditDialogComponent, ProfileEditResult } from './profile-edit-dialog.component';

import { ProfileSettings, UserProfile } from '../../models/habit.model';
import { ToggleComponent } from '../../shared/ui/toggle/toggle.component';

import { getLevelProgress, LevelProgress } from '../../shared/level-utils';
import { NotificationService } from '../../services/notification.service';
import { ShadowMonarchModalComponent } from '../../shared/shadow-monarch-modal/shadow-monarch-modal.component';
import { STARTER_BADGES, type AchievementBadgeDef } from '../../services/achievements.service';
import { environment } from '../../../environments/environment';



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
    ToggleComponent,
    ShadowMonarchModalComponent
  ],

  animations: [staggerFadeUp || noopAnimation],

  
  template: `
    <div class=\"page-container profile-page\" [@.disabled]=\"reduceMotion\">

      <!-- Quest-style page header -->
      <header class=\"profile-page-header\">
        <div class=\"profile-page-header__title-row\">
          <div class=\"profile-page-header__icon-wrap\">
            <mat-icon>person</mat-icon>
          </div>
          <div>
            <h1 class=\"profile-page-header__title\">Profile</h1>
            <p class=\"profile-page-header__subtitle\">Your identity &amp; progress</p>
          </div>
        </div>
        <div class=\"profile-page-header__chips\">
          <div class=\"profile-stat-chip\">
            <mat-icon>bolt</mat-icon>
            <span>Lv {{ levelStats.level }}</span>
          </div>
          <div class=\"profile-stat-chip profile-stat-chip--xp\">
            <mat-icon>star</mat-icon>
            <span>{{ levelStats.totalXp }} XP</span>
          </div>
        </div>
      </header>

      <!-- Identity card -->
      <div class=\"profile-identity-card\" [@staggerFadeUp]=\"animationKey\">
        <div class=\"profile-identity__avatar\">{{ initials }}</div>
        <div class=\"profile-identity__info\">
          <div class=\"profile-identity__name\">{{ displayName }}</div>
          <div class=\"profile-identity__sub\">{{ profileSubtitle }}</div>
          <div class=\"profile-identity__stats\" *ngIf=\"personaLabel || goalLabel\">
            <span class=\"profile-tag\" *ngIf=\"personaLabel\">{{ personaLabel }}</span>
            <span class=\"profile-tag profile-tag--goal\" *ngIf=\"goalLabel\">{{ goalLabel }}</span>
          </div>
        </div>
        <button class=\"profile-edit-btn\" type=\"button\" (click)=\"openEditProfileDialog()\">
          <mat-icon>edit</mat-icon>
          Edit
        </button>
      </div>

      <!-- Why statement -->
      <div class=\"profile-why-card\" *ngIf=\"whyStatement\" [@staggerFadeUp]=\"animationKey\">
        <div class=\"profile-why-card__label\">WHY I DO THIS</div>
        <div class=\"profile-why-card__text\">{{ whyStatement }}</div>
      </div>

      <!-- ── Achievements ─────────────────────────────────────────────────── -->
      <div class=\"pf-section\" [@staggerFadeUp]=\"animationKey\">
        <button class=\"pf-section__toggle\" type=\"button\" [attr.aria-expanded]=\"achievementsOpen\" (click)=\"toggleAchievementsOpen()\">
          <div class=\"pf-section__icon-wrap\"><mat-icon>emoji_events</mat-icon></div>
          <div class=\"pf-section__title-group\">
            <span class=\"pf-section__title\">Achievements</span>
            <span class=\"pf-section__sub\">Unlock by showing up consistently</span>
          </div>
          <mat-icon class=\"pf-section__chevron\" [class.is-open]=\"achievementsOpen\">expand_more</mat-icon>
        </button>
        <div class=\"pf-section__body\" [class.is-open]=\"achievementsOpen\">
          <div class=\"badge-grid\">
            <button class=\"badge-tile\" type=\"button\" *ngFor=\"let badge of achievementBadges\"
              [class.is-locked]=\"!isBadgeUnlocked(badge.id)\"
              (click)=\"openBadgeDetail(badge)\">
              <div class=\"badge-icon\"><mat-icon>{{ isBadgeUnlocked(badge.id) ? badge.icon : 'lock' }}</mat-icon></div>
              <div class=\"badge-title\">{{ isBadgeUnlocked(badge.id) ? badge.title : '???' }}</div>
            </button>
          </div>
        </div>
      </div>

      <!-- ── Data & Backup ──────────────────────────────────────────────── -->
      <div class=\"pf-section\" [@staggerFadeUp]=\"animationKey\">
        <button class=\"pf-section__toggle\" type=\"button\" (click)=\"dataOpen = !dataOpen\">
          <div class=\"pf-section__icon-wrap pf-section__icon-wrap--green\"><mat-icon>save</mat-icon></div>
          <div class=\"pf-section__title-group\">
            <span class=\"pf-section__title\">Data &amp; Backup</span>
            <span class=\"pf-section__sub\">Offline-first — export anytime</span>
          </div>
          <mat-icon class=\"pf-section__chevron\" [class.is-open]=\"dataOpen\">expand_more</mat-icon>
        </button>
        <div class=\"pf-section__body\" [class.is-open]=\"dataOpen\">
          <div class=\"pf-section__inner\">
            <div class=\"pf-action-grid\">
              <button class=\"pf-action-btn\" type=\"button\" (click)=\"exportJson()\">
                <mat-icon>download</mat-icon>Export backup
              </button>
              <button class=\"pf-action-btn\" type=\"button\" (click)=\"triggerImportJson(importInput)\">
                <mat-icon>upload</mat-icon>Restore backup
              </button>
            </div>
          </div>
          <input #importInput type=\"file\" hidden class=\"visually-hidden\" accept=\".json,application/json\" (change)=\"onImportJson($event)\">
        </div>
      </div>

      <!-- ── Personalization ────────────────────────────────────────────── -->
      <div class=\"pf-section\" [@staggerFadeUp]=\"animationKey\">
        <button class=\"pf-section__toggle\" type=\"button\" (click)=\"personalizationOpen = !personalizationOpen\">
          <div class=\"pf-section__icon-wrap pf-section__icon-wrap--purple\"><mat-icon>tune</mat-icon></div>
          <div class=\"pf-section__title-group\">
            <span class=\"pf-section__title\">Personalization</span>
            <span class=\"pf-section__sub\">Theme, fonts &amp; reminders</span>
          </div>
          <mat-icon class=\"pf-section__chevron\" [class.is-open]=\"personalizationOpen\">expand_more</mat-icon>
        </button>
        <div class=\"pf-section__body\" [class.is-open]=\"personalizationOpen\">
          <div class=\"pf-section__inner\">
          <div class=\"pf-control-group\">
            <div class=\"pf-control-label\">Font size: {{ fontSizeLabel }}</div>
            <input type=\"range\" min=\"12\" max=\"18\" step=\"1\" class=\"font-slider\" [value]=\"fontSizePx\" (input)=\"setFontSizeFromRange($event)\">
          </div>
          <div class=\"pf-control-row\">
            <div class=\"pf-control-label\">Daily reminder</div>
            <app-toggle [checked]=\"dailyReminderEnabled\" [disabled]=\"notificationsLoading || !remindersNativeSupported\" (checkedChange)=\"toggleNotifications($event)\"></app-toggle>
          </div>
          <div class=\"pf-control-row\" *ngIf=\"dailyReminderEnabled && remindersNativeSupported\">
            <div class=\"pf-control-label\">Reminder time</div>
            <input class=\"reminder-time-input\" type=\"time\" [value]=\"dailyReminderTime\" [disabled]=\"notificationsLoading\" (change)=\"onDailyReminderTimeChange($event)\">
          </div>
          <div class=\"pf-control-row\">
            <div class=\"pf-control-label\">Sounds</div>
            <app-toggle [checked]=\"soundsEnabled\" (checkedChange)=\"toggleSounds($event)\"></app-toggle>
          </div>
          <div class=\"pf-section-divider\"></div>
          <div class=\"pf-control-label pf-control-label--section\">Theme</div>
          <div class=\"theme-picker\">
            <button class=\"theme-btn\" type=\"button\" [class.active]=\"currentTheme === 'system'\" (click)=\"setTheme('system')\">
              <span class=\"theme-preview system-preview\"></span>
              <span class=\"theme-name\">System</span><span class=\"theme-desc\">Solo Leveling</span>
            </button>
            <button class=\"theme-btn\" type=\"button\" [class.active]=\"currentTheme === 'professional'\" (click)=\"setTheme('professional')\">
              <span class=\"theme-preview professional-preview\"></span>
              <span class=\"theme-name\">Pro</span><span class=\"theme-desc\">Clean dark</span>
            </button>
            <button class=\"theme-btn\" type=\"button\" [class.active]=\"currentTheme === 'minimal'\" (click)=\"setTheme('minimal')\">
              <span class=\"theme-preview minimal-preview\"></span>
              <span class=\"theme-name\">Minimal</span><span class=\"theme-desc\">Monochrome</span>
            </button>
          </div>
          <div class=\"pf-section-divider\"></div>
          <div class=\"pf-control-label pf-control-label--section\">Accent color</div>
          <div class=\"accent-swatches\">
            <button class=\"accent-swatch\" *ngFor=\"let preset of accentPresets\"
              [style.background]=\"preset.color\" [class.is-active]=\"isAccentPresetActive(preset.id)\"
              (click)=\"setAccentPreset(preset.id)\" [attr.aria-label]=\"preset.name\">
              <span class=\"swatch-check\" *ngIf=\"isAccentPresetActive(preset.id)\">&#x2713;</span>
            </button>
          </div>
          <div class=\"custom-accent\" [class.is-active]=\"accent.type === 'custom'\">
            <label class=\"pf-control-label\">Custom color</label>
            <input type=\"color\" [value]=\"customAccent\" (input)=\"setCustomAccent($event)\">
          </div>
          </div>
        </div>
      </div>

      <!-- ── Help & About ────────────────────────────────────────────────── -->
      <div class=\"pf-section\" [@staggerFadeUp]=\"animationKey\">
        <button class=\"pf-section__toggle\" type=\"button\" (click)=\"helpOpen = !helpOpen\">
          <div class=\"pf-section__icon-wrap pf-section__icon-wrap--muted\"><mat-icon>info</mat-icon></div>
          <div class=\"pf-section__title-group\">
            <span class=\"pf-section__title\">Help &amp; About</span>
            <span class=\"pf-section__sub\">{{ versionLabel }}</span>
          </div>
          <mat-icon class=\"pf-section__chevron\" [class.is-open]=\"helpOpen\">expand_more</mat-icon>
        </button>
        <div class=\"pf-section__body\" [class.is-open]=\"helpOpen\">
          <div class=\"pf-section__inner\">
          <div class=\"pf-info-rows\">
            <div class=\"pf-info-row\">
              <span class=\"pf-info-label\">Built by</span>
              <span class=\"pf-info-value\">Giri</span>
            </div>
            <div class=\"pf-info-row\">
              <span class=\"pf-info-label\">Version</span>
              <span class=\"pf-info-value\">{{ versionLabel }}</span>
            </div>
            <div class=\"pf-info-row\">
              <span class=\"pf-info-label\">Privacy</span>
              <span class=\"pf-info-value\">Offline-first. No cloud. No tracking.</span>
            </div>
          </div>
          <div class=\"pf-nav-links\">
            <a class=\"pf-nav-link\" [routerLink]=\"'/about'\">
              <mat-icon class=\"pf-nav-link__icon\">info</mat-icon>
              <span class=\"pf-nav-link__label\">About App</span>
              <mat-icon class=\"pf-nav-link__arrow\">chevron_right</mat-icon>
            </a>
            <a class=\"pf-nav-link\" [routerLink]=\"'/terms'\">
              <mat-icon class=\"pf-nav-link__icon\">description</mat-icon>
              <span class=\"pf-nav-link__label\">Terms of Service</span>
              <mat-icon class=\"pf-nav-link__arrow\">chevron_right</mat-icon>
            </a>
            <a class=\"pf-nav-link\" [routerLink]=\"'/privacy'\">
              <mat-icon class=\"pf-nav-link__icon\">security</mat-icon>
              <span class=\"pf-nav-link__label\">Privacy Policy</span>
              <mat-icon class=\"pf-nav-link__arrow\">chevron_right</mat-icon>
            </a>
          </div>
          </div>
        </div>
      </div>

      <app-shadow-monarch-modal
        [open]="showImportModal"
        title="Importing Backup"
        message="Do you want to replace or merge with current data?"
        primaryText="Replace"
        secondaryText="Merge"
        (primary)="onImportReplace()"
        (secondary)="onImportMerge()"
        (close)="closeImportModal()">
      </app-shadow-monarch-modal>


    </div>

    <!-- ── Badge Detail Overlay ─────────────────────────────────────────── -->
    <div class=\"badge-detail-overlay\" *ngIf=\"selectedBadge\" (click)=\"closeBadgeDetail()\">
      <div class=\"badge-detail-card\" [attr.data-tier]=\"getBadgeDetail(selectedBadge.id).tier\" (click)=\"$event.stopPropagation()\">
        <div class=\"badge-detail__top-bar\" [style.background]=\"getTierColor(selectedBadge.id)\"></div>
        <button class=\"badge-detail__close\" type=\"button\" (click)=\"closeBadgeDetail()\">
          <mat-icon>close</mat-icon>
        </button>
        <div class=\"badge-detail__rarity\" [attr.data-tier]=\"getBadgeDetail(selectedBadge.id).tier\">
          {{ getBadgeDetail(selectedBadge.id).rarity }}
        </div>
        <div class=\"badge-detail__icon-wrap\" [attr.data-tier]=\"getBadgeDetail(selectedBadge.id).tier\">
          <mat-icon *ngIf=\"isBadgeUnlocked(selectedBadge.id)\">{{ selectedBadge.icon }}</mat-icon>
          <mat-icon *ngIf=\"!isBadgeUnlocked(selectedBadge.id)\">lock</mat-icon>
        </div>
        <div class=\"badge-detail__title\">{{ isBadgeUnlocked(selectedBadge.id) ? selectedBadge.title : '???' }}</div>
        <div class=\"badge-detail__status\" [class.is-unlocked]=\"isBadgeUnlocked(selectedBadge.id)\">
          <mat-icon>{{ isBadgeUnlocked(selectedBadge.id) ? 'verified' : 'lock_open' }}</mat-icon>
          <span>{{ isBadgeUnlocked(selectedBadge.id) ? 'ACHIEVEMENT UNLOCKED' : 'NOT YET UNLOCKED' }}</span>
        </div>
        <div class=\"badge-detail__desc\">
          {{ isBadgeUnlocked(selectedBadge.id) ? getBadgeDetail(selectedBadge.id).description : 'Complete more habits to unlock this achievement and reveal its secrets.' }}
        </div>
        <div class=\"badge-detail__reward\" *ngIf=\"isBadgeUnlocked(selectedBadge.id)\">
          <div class=\"badge-detail__reward-label\">REWARD</div>
          <div class=\"badge-detail__reward-value\">{{ getBadgeDetail(selectedBadge.id).reward }}</div>
        </div>
        <div class=\"badge-detail__quote\">{{ getBadgeDetail(selectedBadge.id).flavorText }}</div>
        <div class=\"badge-detail__footer\">
          <div class=\"badge-detail__player-name\">{{ displayName }}</div>
          <div class=\"badge-detail__date\">{{ today }}</div>
        </div>
      </div>
    </div>

  `,


  styleUrls: ['./profile.component.sass']

})

export class ProfileComponent implements OnInit, OnDestroy {
  private static readonly ACHIEVEMENTS_EXPANDED_KEY = 'profile.achievements.expanded';

  reduceMotion = false;

  animationKey = 0;

  exportingXlsx = false;

  accent: AccentSetting = { type: 'preset', value: 'orange' };

  fontSizePx: FontSizePx = 16;

  fontFamily: FontFamilyId = 'system';
  notificationsEnabled = false;
  notificationsSupported = false;
  notificationsLoading = false;
  dailyReminderEnabled = false;
  dailyReminderTime = '20:30';
  remindersNativeSupported = false;
  soundsEnabled = true;

  customAccent = '#f27a2a';

  readonly versionLabel = `${environment.appVersion} (Build ${environment.buildNumber})`;

  canInstall = false;

  displayName = 'Guest';

  profile: ProfileSettings = {};

  userProfile: UserProfile | null = null;

  personaLabel = '';

  goalLabel = '';

  whyStatement = '';

  levelStats: LevelProgress = getLevelProgress(0);
  achievementBadges: AchievementBadgeDef[] = STARTER_BADGES;
  private unlockedBadgeIds = new Set<string>();
  achievementsOpen = false;
  selectedBadge: AchievementBadgeDef | null = null;
  readonly today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  private readonly badgeDetails: Record<string, { description: string; reward: string; flavorText: string; tier: 'bronze' | 'silver' | 'gold' | 'legendary'; rarity: string }> = {
    first_habit_completed: { description: 'You completed your very first habit. Every legend in history started exactly where you did — with one small act of will.', reward: '50 XP Awakening Bonus', flavorText: '"The moment you begin, you separate yourself from the crowd."', tier: 'bronze', rarity: 'Common' },
    first_perfect_day: { description: 'Every habit completed. One full day of zero compromise. You experienced what true discipline feels like.', reward: 'Perfect Day Seal + 100 XP', flavorText: '"One perfect day proves you are capable of infinite more."', tier: 'silver', rarity: 'Uncommon' },
    perfect_days_3: { description: 'Three days of perfect execution. A habit needs 3 days of proof to begin taking root. You are building the foundation.', reward: 'Discipline Crest + 200 XP', flavorText: '"Three days of perfection. Your character is being forged in fire."', tier: 'silver', rarity: 'Uncommon' },
    perfect_days_7: { description: 'A full week of flawless performance. Seven sunrises. Seven victories. You did not break once.', reward: 'Shadow Warrior Emblem + 500 XP', flavorText: '"Seven days without surrender. You are no longer who you were."', tier: 'gold', rarity: 'Rare' },
    total_completed_10: { description: 'Ten habit completions in the books. Your history of wins is growing. The system is tracking your power.', reward: 'Rising Hunter Crest + 75 XP', flavorText: '"10 victories recorded. The leaderboard is watching you."', tier: 'bronze', rarity: 'Common' },
    total_completed_50: { description: 'Fifty completions. Half a century of deliberate actions. You have proven that the first win was not luck.', reward: 'Iron Resolve Sigil + 250 XP', flavorText: '"50 reps. 50 times you chose growth over comfort."', tier: 'silver', rarity: 'Uncommon' },
    total_completed_100: { description: 'One hundred habits completed. You have entered the tier of the truly dedicated. Most people never reach this number.', reward: 'Centurion Crown + 1000 XP', flavorText: '"100. You did not just try — you persisted beyond what most are willing to endure."', tier: 'gold', rarity: 'Rare' },
    first_level_up: { description: 'You leveled up for the first time. The power within you is awakening. The system acknowledges your growth.', reward: 'Awakening Crystal + Level Bonus', flavorText: '"Level 2. The ascension has begun. There is no ceiling for those who refuse to stop."', tier: 'bronze', rarity: 'Common' },
    level_5_reached: { description: 'Level 5 achieved. You are no longer a newcomer. Your rank is established. The hunt intensifies from here.', reward: "Hunter's Mark Insignia + Rank Bonus", flavorText: '"Level 5. You have crossed the line between beginners and believers."', tier: 'silver', rarity: 'Uncommon' },
    level_10_reached: { description: "Level 10. The highest tier of dedication. You have earned the Shadow Monarch's recognition. You are feared by inertia itself.", reward: 'Shadow Monarch Insignia + Legendary Bonus', flavorText: '"Level 10. Not many reach here. You are among the few who refused to be ordinary."', tier: 'legendary', rarity: 'Legendary' }
  };

  dataOpen = false;

  personalizationOpen = false;

  get currentTheme(): AppTheme {
    return this.themeService.getThemeSync();
  }

  setTheme(theme: AppTheme): void {
    this.themeService.setTheme(theme);
  }
  helpOpen = false;
  showImportModal = false;
  private pendingBackupRaw: string | null = null;
  private pendingBackup: any | null = null;

  accentPresets: AccentPreset[] = [

    // { id: 'orange', name: 'Orange', color: '#f27a2a' },

    { id: 'green', name: 'Green', color: '#3fb57a' },

    { id: 'blue', name: 'Blue', color: '#4a90e2' },

    { id: 'pink', name: 'Pink', color: '#ff6b9a' },

    { id: 'teal', name: 'Teal', color: '#2fb6b1' },

    { id: 'red', name: 'Red', color: '#ef4444' },

    { id: 'yellow', name: 'Yellow', color: '#f4b23a' },

    { id: 'purple', name: 'Purple', color: '#8b5cf6' },
    { id: 'violet', name: 'Violet', color: '#5810fe'}

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

    private notificationService: NotificationService,

    private cdr: ChangeDetectorRef,

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

        this.accent = settings.accent;

        this.fontSizePx = settings.fontSizePx;

        this.fontFamily = settings.fontFamily;
        this.notificationsEnabled = settings.notificationsEnabled;

        if (settings.accent.type === 'custom') {

          this.customAccent = settings.accent.value;

        }
        this.notificationsSupported = this.notificationService.isSupported();
      })

    );

    this.subscription.add(
      this.habitStore.getNotificationSettings$().subscribe(notificationSettings => {
        this.dailyReminderEnabled = notificationSettings.dailyEnabled;
        this.dailyReminderTime = notificationSettings.dailyTime;
      })
    );

    this.subscription.add(

      this.habitStore.getLevelStats().subscribe(levelStats => {

        this.levelStats = levelStats;

      })

    );

    this.subscription.add(
      this.habitStore.getUnlockedBadgeIds().subscribe(ids => {
        this.unlockedBadgeIds = new Set(ids);
        this.cdr.markForCheck();
      })
    );

    this.subscription.add(

      this.habitStore.getProfile().subscribe(profile => {

        this.profile = profile;
        this.soundsEnabled = Boolean(profile.soundsEnabled ?? true);

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
      this.achievementsOpen = this.readAchievementsExpanded();
      this.remindersNativeSupported = this.notificationService.isNativeSchedulingAvailable();

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



  async onImportJson(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const isJsonType = file.type === 'application/json';
      const isJsonName = file.name.toLowerCase().endsWith('.json');
      if (!isJsonType && !isJsonName) {
        this.snackBar.open('Invalid backup file', 'Close', { duration: 2500 });
        return;
      }

      console.log('Backup import: file selected', file.name, file.size);
      const raw = await file.text();
      console.log('Backup import: file read success', raw.slice(0, 100));

      const parsed = JSON.parse(raw);
      console.log('Backup import: parsed OK', Object.keys(parsed || {}));

      const normalized = this.unwrapBackupPayload(parsed);
      const validation = this.validateBackup(normalized);
      if (!validation.valid) {
        this.snackBar.open('Invalid backup file', 'Close', { duration: 2500 });
        return;
      }

      this.pendingBackupRaw = raw;
      this.pendingBackup = normalized;
      this.showImportModal = true;
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Backup import: parse failed', error);
      this.snackBar.open('Invalid backup file', 'Close', { duration: 2500 });
    } finally {
      target.value = '';
    }
  }



  private validateBackup(data: any): { valid: boolean; message: string } {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { valid: false, message: 'Invalid backup file' };
    }
    const hasTopLevelKeys =
      Array.isArray(data.habits) ||
      typeof data.checks === 'object' ||
      typeof data.completions === 'object' ||
      typeof data.skips === 'object';
    if (!hasTopLevelKeys) {
      return { valid: false, message: 'Missing backup fields' };
    }
    return { valid: true, message: 'OK' };
  }

  private unwrapBackupPayload(data: any): any {
    if (data && typeof data === 'object' && !Array.isArray(data) && data.data && typeof data.data === 'object') {
      return data.data;
    }
    return data;
  }

  closeImportModal(): void {
    this.showImportModal = false;
    this.pendingBackup = null;
    this.pendingBackupRaw = null;
  }

  onImportReplace(): void {
    this.applyImport('replace');
  }

  onImportMerge(): void {
    this.applyImport('merge');
  }

  private applyImport(mode: 'replace' | 'merge'): void {
    if (!this.pendingBackup) {
      this.showImportModal = false;
      return;
    }
    const backup = this.pendingBackup;
    const snapshot = this.habitStore.getSnapshotForBackup();
    const rollback = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      habits: snapshot.habits,
      checks: snapshot.completions,
      skips: snapshot.skips,
      onboardingCompleted: snapshot.onboardingCompleted,
      userProfile: snapshot.userProfile ?? undefined,
      profile: snapshot.profile,
      appSettings: {
        selectedYear: snapshot.selectedMonthYear?.year,
        selectedMonthIndex: snapshot.selectedMonthYear?.month
      }
    };
    try {
      console.log('Backup import: apply started', mode);
      this.habitStore.restoreFromBackup(backup, mode);
      console.log('Backup import: apply success');
      this.showImportModal = false;
      this.pendingBackup = null;
      this.pendingBackupRaw = null;
      this.snackBar.open(mode === 'merge' ? 'Import completed (merged)' : 'Import completed', 'Close', { duration: 2200 });
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Backup import: apply failed', error);
      try {
        this.habitStore.restoreFromBackup(rollback, 'replace');
      } catch (rollbackError) {
        console.error('Backup import: rollback failed', rollbackError);
      }
      this.showImportModal = false;
      this.pendingBackup = null;
      this.pendingBackupRaw = null;
      this.snackBar.open('Import failed', 'Close', { duration: 2500 });
    }
  }



  async toggleNotifications(enabled: boolean): Promise<void> {
    if (this.notificationsLoading) {
      return;
    }
    this.remindersNativeSupported = this.notificationService.isNativeSchedulingAvailable();
    if (!this.remindersNativeSupported) {
      this.dailyReminderEnabled = false;
      this.habitStore.updateNotificationSettings({ dailyEnabled: false });
      this.snackBar.open('Reminders work in the installed app.', 'Close', { duration: 2200 });
      return;
    }

    this.notificationsLoading = true;
    if (enabled) {
      const permission = await this.notificationService.requestPermissionIfNeeded();
      if (permission !== 'granted') {
        await this.notificationService.setEnabled(false);
        this.dailyReminderEnabled = false;
        this.snackBar.open('Permission denied. Enable notifications in device settings.', 'Close', { duration: 3000 });
      } else {
        await this.notificationService.setEnabled(true);
        await this.notificationService.syncFromStore();
        this.dailyReminderEnabled = true;
        this.snackBar.open('Daily reminder enabled', 'Close', { duration: 2000 });
      }
    } else {
      await this.notificationService.disableAll();
      this.dailyReminderEnabled = false;
      this.snackBar.open('Daily reminder off', 'Close', { duration: 1500 });
    }
    this.notificationsLoading = false;
    this.cdr.markForCheck();
  }

  async onDailyReminderTimeChange(event: Event): Promise<void> {
    const value = (event.target as HTMLInputElement).value || '20:30';
    this.dailyReminderTime = value;
    this.habitStore.updateNotificationSettings({ dailyTime: value });
    if (this.dailyReminderEnabled && this.remindersNativeSupported) {
      await this.notificationService.syncFromStore();
      this.snackBar.open('Reminder time updated', 'Close', { duration: 1800 });
    }
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

  toggleSounds(enabled: boolean): void {
    this.soundsEnabled = enabled;
    this.habitStore.updateProfileSettings({ soundsEnabled: enabled });
    this.snackBar.open(enabled ? 'Sounds on' : 'Sounds off', undefined, { duration: 1500 });
    this.cdr.markForCheck();
  }

  isBadgeUnlocked(id: string): boolean {
    return this.unlockedBadgeIds.has(id);
  }

  openBadgeDetail(badge: AchievementBadgeDef): void {
    this.selectedBadge = badge;
    this.cdr.markForCheck();
  }

  closeBadgeDetail(): void {
    this.selectedBadge = null;
    this.cdr.markForCheck();
  }

  getBadgeDetail(id: string) {
    return this.badgeDetails[id] ?? {
      description: 'A special achievement awaits.',
      reward: 'Secret Reward',
      flavorText: '"The unknown holds the greatest power."',
      tier: 'bronze' as const,
      rarity: 'Common'
    };
  }

  getTierColor(id: string): string {
    const tier = this.getBadgeDetail(id).tier;
    const colors: Record<string, string> = { bronze: '#cd7f32', silver: '#c0c0c0', gold: '#ffd700', legendary: '#a259ff' };
    return colors[tier] ?? '#ffd700';
  }

  toggleAchievementsOpen(): void {
    this.achievementsOpen = !this.achievementsOpen;
    this.persistAchievementsExpanded(this.achievementsOpen);
    this.cdr.markForCheck();
  }

  private readAchievementsExpanded(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    try {
      return window.localStorage.getItem(ProfileComponent.ACHIEVEMENTS_EXPANDED_KEY) === '1';
    } catch {
      return false;
    }
  }

  private persistAchievementsExpanded(expanded: boolean): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      window.localStorage.setItem(ProfileComponent.ACHIEVEMENTS_EXPANDED_KEY, expanded ? '1' : '0');
    } catch {
      // ignore storage failures
    }
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













































