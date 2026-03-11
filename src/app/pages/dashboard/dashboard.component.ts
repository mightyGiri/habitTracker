import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, Inject, PLATFORM_ID, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { ProgressBarComponent } from '../../shared/progress-bar.component';
import { HabitCheckComponent } from '../../shared/components/habit-check/habit-check.component';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subscription, combineLatest, Observable } from 'rxjs';
import { HabitStoreService } from '../../services/habit-store.service';
import { MonthKey, MonthlyTotals, TopHabit, MonthInsights, Habit, DomainConfig, HabitCompletion, HabitSkips, HabitDomain } from '../../models/habit.model';
import { DOMAINS, getDomainConfig } from '../../config/domains.config';
import type { ChartDataset } from 'chart.js';
import Chart from 'chart.js/auto';
import { ThemeService } from '../../services/theme.service';
import { staggerFadeUp, noopAnimation } from '../../shared/list-animations';
import { DateUtils } from '../../shared/date-utils';
import { getDailyMotivation } from '../../shared/daily-motivations';
import { getLevelProgress, LevelProgress } from '../../shared/level-utils';
import { plural } from '../../shared/plural';
import { DayCountPipe } from '../../shared/day-count.pipe';
import { ActivatedRoute, Router } from '@angular/router';
import { AchievementsService } from '../../services/achievements.service';
import { SoundService } from '../../services/sound.service';
import { QuestService } from '../../services/quest.service';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

interface DomainGroup {
  domain: HabitDomain | 'uncategorized';
  config: DomainConfig | null;
  habits: Array<{ habit: Habit; checked: boolean; skipped: boolean }>;
  completedCount: number;
  totalCount: number;
}

type DateChip = {
  date: Date;
  label: string;
  isPerfect: boolean;
};

type ConfettiPiece = {
  id: number;
  x: number;
  drift: number;
  rotate: number;
  size: number;
  delay: number;
  duration: number;
};

type SystemOverlayType = 'none' | 'perfect' | 'levelup';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatSnackBarModule, MatDialogModule, DayCountPipe, ProgressBarComponent, HabitCheckComponent],
  animations: [staggerFadeUp || noopAnimation],
  template: `
    <div class="system-modal-overlay" *ngIf="activeSystemOverlay !== 'none'">
      <div class="system-modal-card" role="dialog" aria-live="polite" [attr.aria-label]="activeSystemOverlay === 'perfect' ? 'Perfect day' : 'Level up'">
        <button class="system-modal-close glass-btn glass-btn--ghost" type="button" [attr.aria-label]="activeSystemOverlay === 'perfect' ? 'Dismiss perfect day' : 'Dismiss level up'" (click)="dismissSystemOverlay()">
          &#x2715;
        </button>
        <div class="system-modal-system system-label">SYSTEM</div>
        <div class="system-modal-title system-title">{{ activeSystemOverlay === 'perfect' ? 'PERFECT DAY' : 'LEVEL UP' }}</div>
        <div class="system-modal-level system-subtitle" *ngIf="activeSystemOverlay === 'perfect'">All habits completed.</div>
        <div class="system-modal-level system-subtitle" *ngIf="activeSystemOverlay === 'perfect' && streakCount > 0">&#x1F525; Streak: {{ streakCount }}</div>
        <div class="system-modal-level system-subtitle" *ngIf="activeSystemOverlay === 'levelup'">Lv {{ levelUpFrom }} &#x2192; Lv {{ levelUpTo }}</div>
        <div class="system-modal-particles" aria-hidden="true">
          <span class="system-modal-spark"></span>
          <span class="system-modal-spark"></span>
          <span class="system-modal-spark"></span>
          <span class="system-modal-spark"></span>
          <span class="system-modal-spark"></span>
          <span class="system-modal-spark"></span>
        </div>
      </div>
    </div>

    <div class="page-container system-vignette-layer" [@.disabled]="reduceMotion" [class.reduce-motion]="reduceMotion">
      <ng-container *ngIf="ready$ | async; else loading">
      <!-- ── Player Status Window ──────────────────────────────────────────── -->
      <section class="today-header" [class.perfect-day]="isPerfectTodaySelected">
        <div class="today-header__scanlines" aria-hidden="true"></div>

        <div class="today-header__top-bar">
          <span class="today-header__sys-label">SYSTEM</span>
          <span class="today-header__date-label">{{ isEditingToday ? todayLabel : ('&#x23EA; ' + todayLabel) }}</span>
        </div>

        <div class="today-header__name-row">
          <button class="title-link" type="button" (click)="goToProfile()">
            <span class="title-name">{{ userName }}</span>
          </button>
          <span class="level-badge" [class.lv-celebrate]="headerLevelUpCelebrating">
            <span class="level-badge__lv">LV</span>
            <span class="level-badge__num">{{ levelStats.level }}</span>
          </span>
        </div>

        <div class="today-header__motivation">{{ dailyMotivation }}</div>

        <div class="today-header__xp-block" [class.level-up-glow]="levelUpAnimating">
          <div class="today-header__xp-label">
            <span class="today-header__xp-title">EXP</span>
            <span class="today-header__xp-next" [class.glow-white]="nextLevelRemaining === 0">{{ nextLevelLabel }}</span>
          </div>
          <div class="today-header__xp-track">
            <div class="today-header__xp-fill" [style.width.%]="displayedHeaderProgress * 100" [class.xp-near-max]="displayedHeaderProgress >= 0.9"></div>
            <div class="today-header__xp-glow" [style.width.%]="displayedHeaderProgress * 100"></div>
          </div>
        </div>

        <div class="status-row" *ngIf="selectedIsPerfect || selectedIsWon || streakCount > 0">
          <div class="perfect-chip arcane-pill glass-pill primary-chip" *ngIf="selectedIsPerfect" [class.celebrate]="celebrateBadge" [class.glow-white]="selectedIsPerfect || celebrateBadge">Perfect Day &#x1F525;</div>
          <div class="perfect-chip arcane-pill glass-pill" *ngIf="selectedIsWon && !selectedIsPerfect">Won Today &#x1F525;</div>
          <div class="streak-badge arcane-pill glass-pill glow-white" *ngIf="streakCount > 0" [class.streak-pop]="streakCelebrating" [class.streak-fire]="streakFireAnimating">
            <div class="streak-count">&#x1F525; {{ streakCount | dayCount }} in a row</div>
          </div>
        </div>

        <div class="date-carousel arcane-card arcane-card--tight" *ngIf="canUseDateCarousel">
          <button class="carousel-arrow arcane-btn arcane-btn--ghost" type="button" aria-label="Previous week" (click)="shiftDateWindow(-7)">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <div class="carousel-track" role="listbox" aria-label="Select day">
            <button class="day-chip arcane-pill glass-pill" type="button"
              *ngFor="let chip of dateChips"
              [class.perfect-day]="chip.isPerfect"
              [class.is-selected]="isSameDate(chip.date, selectedDate)"
              [class.arcane-pill--active]="isSameDate(chip.date, selectedDate)"
              (click)="setSelectedDate(chip.date)"
              [attr.aria-selected]="isSameDate(chip.date, selectedDate)">
              {{ chip.label }}
            </button>
          </div>
          <button class="carousel-arrow arcane-btn arcane-btn--ghost" type="button" aria-label="Next week" (click)="shiftDateWindow(7)">
            <mat-icon>chevron_right</mat-icon>
          </button>
          <button class="jump-today arcane-btn arcane-btn--primary" type="button" *ngIf="!isEditingToday" (click)="goToday()">
            Jump to Today
          </button>
        </div>
      </section>

      <!-- ── System Cue (motivational banner) ─────────────────────────────── -->
      <div class="today-cue" *ngIf="isEditingToday && !isSelectedDayFinalized">
        <div class="today-cue__icon">{{ doneToday === 0 ? '⚡' : '🔥' }}</div>
        <div class="today-cue__content">
          <ng-container *ngIf="doneToday === 0; else cueKeepGoing">
            <div class="cue-title">Start small. Win once.</div>
            <div class="cue-sub">Momentum builds from action.</div>
          </ng-container>
          <ng-template #cueKeepGoing>
            <div class="cue-title">Good. Keep going.</div>
            <div class="cue-sub">{{ momentumSubtitle }}</div>
          </ng-template>
        </div>
      </div>

      <!-- ── Today Hero panel ───────────────────────────────────────────── -->
      <div class="today-hero" [class.perfect-day]="isPerfectTodaySelected">
        <div class="today-hero__left">
          <div class="today-hero__mission-label">TODAY'S MISSION</div>
          <div class="today-hero__title">{{ isEditingToday && selectedIsPerfect ? '✦ PERFECT DAY' : 'TODAY' }}</div>
          <div class="today-hero__status">{{ heroStatusLine }}</div>
          <div class="today-hero__chain" *ngIf="isEditingToday && selectedIsWon">
            Return tomorrow. Protect the chain.
          </div>
          <div class="finish-message" *ngIf="finishMomentActive">{{ finishMomentMessage }}</div>
        </div>
        <div class="today-hero__counter" [class.perfect-day]="isPerfectTodaySelected">
          <div class="today-hero__counter-done">{{ doneCount }}</div>
          <div class="today-hero__counter-sep">/</div>
          <div class="today-hero__counter-total">{{ totalCount }}</div>
        </div>
      </div>
      <div class="hero-progress">
        <app-progress-bar [value]="selectedSummary.percentHandled / 100" [height]="6"></app-progress-bar>
      </div>

      <!-- ── Today Habits List ──────────────────────────────────────────── -->
      <section class="today-list-section" [@staggerFadeUp]="animationKey" #todaySection [class.perfect-day]="isPerfectTodaySelected" [class.finish-moment]="finishMomentActive">
        <div class="today-list-header">
          <span class="today-list-title">TODAY HABITS</span>
        </div>
        <div class="confetti-layer" *ngIf="confettiPieces.length > 0">
          <span
            class="confetti-piece"
            *ngFor="let piece of confettiPieces; trackBy: trackByConfetti"
            [style.left.%]="piece.x"
            [style.animationDelay.ms]="piece.delay"
            [style.animationDuration.ms]="piece.duration"
            [style.width.px]="piece.size"
            [style.height.px]="piece.size"
            [style.--confetti-drift.px]="piece.drift"
            [style.--confetti-rotate]="piece.rotate + 'deg'">
          </span>
        </div>
        <div class="today-list-content">
          <div class="today-list" [class.perfect-day]="isPerfectTodaySelected">
            <div class="domain-section"
              *ngFor="let group of domainGroups; trackBy: trackByDomain">
              <div class="domain-header" [style.--domain-color]="group.config?.color ?? '#4f8cff'">
                <span class="domain-emoji">{{ group.config?.emoji ?? '⚡' }}</span>
                <span class="domain-label">{{ group.config?.label ?? 'General' }}</span>
                <div class="domain-progress-mini">
                  <span class="domain-count">{{ group.completedCount }}/{{ group.totalCount }}</span>
                  <div class="domain-bar-track">
                    <div class="domain-bar-fill" [style.width.%]="(group.completedCount / group.totalCount) * 100"></div>
                  </div>
                </div>
              </div>
              <div class="domain-habits">
                <button
                  class="today-item"
                  type="button"
                  *ngFor="let item of group.habits; trackBy: trackByHabitInGroup"
                  [class.is-completed]="isTodayChecked(item.habit.id)"
                  [class.is-skipped]="isSelectedDaySkipped(item.habit.id)"
                  [class.is-next]="isNextHabit(item.habit.id)"
                  [class.reward-pulse]="inlineRewardHabitId === item.habit.id"
                  [class.done-pop]="isDonePopActive(item.habit.id)"
                  (click)="onHabitCardActivate(item.habit, $event)"
                  (keydown.enter)="onHabitCardActivate(item.habit, $event)"
                  (keydown.space)="onHabitCardActivate(item.habit, $event); $event.preventDefault()"
                  [attr.aria-label]="'Toggle ' + item.habit.name + ' for today'"
                  [attr.id]="'habit-' + item.habit.id">
                  <div class="today-item-info">
                    <div class="today-item-name">{{ item.habit.name }}</div>
                    <div class="today-item-sub text-muted">{{ habitProgressMap[item.habit.id] || 0 }}% this month</div>
                    <span class="habit-xp-chip text-label">+{{ getHabitXp(item.habit) }} XP</span>
                    <span class="skipped-chip" *ngIf="isSelectedDaySkipped(item.habit.id)">Skipped</span>
                    <span class="inline-reward" *ngIf="inlineRewardHabitId === item.habit.id">{{ inlineRewardText }}</span>
                  </div>
                  <div class="today-item-meta">
                    <span class="today-item-percent text-label">{{ habitProgressMap[item.habit.id] || 0 }}%</span>
                    <div class="habit-check-wrap">
                      <span class="xp-float" *ngIf="isXpFloatActive(item.habit.id)">+{{ getHabitXp(item.habit) }} XP</span>
                      <app-habit-check
                        class="habit-check-cta"
                        [class.check-pop]="isDonePopActive(item.habit.id)"
                        [checked]="isTodayChecked(item.habit.id)"
                        (toggle)="toggleHabitForSelectedDay(item.habit)"
                        [attr.aria-label]="'Toggle ' + item.habit.name">
                      </app-habit-check>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
          <div class="finish-day" *ngIf="showTodayActions">
            <button class="btn btn-primary btn-sm" type="button" (click)="finishToday()">Level Up Today</button>
            <div class="text-muted finish-hint">Marks remaining as skipped.</div>
          </div>
          <div class="identity-line text-muted" *ngIf="isEditingToday && selectedIsPerfect">{{ identityLine }}</div>
        </div>
      </section>

      <!-- ── Insights Section ───────────────────────────────────────────── -->
      <section class="insights-section">
        <div class="insights-header">
          <div class="insights-header-left">
            <span class="insights-sys-label">SYSTEM ANALYTICS</span>
          </div>
          <button class="btn btn-outline btn-sm charts-toggle glass-btn glass-btn--ghost" type="button" (click)="toggleInsights()">
            {{ insightsOpen ? 'Hide' : 'Show' }}
          </button>
        </div>
        <div class="insights-body" [class.is-collapsed]="!insightsOpen">

          <!-- ── KPI Stat Tiles ── -->
          <div class="stat-tiles">
            <div class="stat-tile stat-tile--streak">
              <div class="stat-tile__icon">🔥</div>
              <div class="stat-tile__value">{{ streakCount }}</div>
              <div class="stat-tile__label">Day Streak</div>
            </div>
            <div class="stat-tile stat-tile--perfect">
              <div class="stat-tile__icon">⭐</div>
              <div class="stat-tile__value">{{ insights.perfectDays }}</div>
              <div class="stat-tile__label">Perfect Days</div>
            </div>
            <div class="stat-tile stat-tile--monthly">
              <div class="stat-tile__icon">📈</div>
              <div class="stat-tile__value">{{ monthlyTotals.percent }}%</div>
              <div class="stat-tile__label">Monthly Rate</div>
            </div>
            <div class="stat-tile stat-tile--xp">
              <div class="stat-tile__icon">⚡</div>
              <div class="stat-tile__value">{{ levelStats.totalXp }}</div>
              <div class="stat-tile__label">Total XP</div>
            </div>
          </div>

          <!-- ── Chart Row: Weekly Pulse + Monthly Trend ── -->
          <div class="insight-charts-row">
            <div class="sys-chart-card">
              <div class="sys-chart-card__header">
                <span class="chart-dot chart-dot--cyan"></span>Weekly Pulse
              </div>
              <div class="sys-chart-card__body">
                <canvas #barCanvas></canvas>
              </div>
            </div>
            <div class="sys-chart-card">
              <div class="sys-chart-card__header">
                <span class="chart-dot chart-dot--blue"></span>Monthly Trend
              </div>
              <div class="sys-chart-card__body">
                <canvas #lineCanvas></canvas>
              </div>
            </div>
          </div>

          <!-- ── Bottom Row: Domain Radar + Top Habits Leaderboard ── -->
          <div class="insight-bottom-row">
            <div class="sys-chart-card insight-radar-card" *ngIf="domainGroups.length > 1">
              <div class="sys-chart-card__header">
                <span class="chart-dot chart-dot--purple"></span>Domain Power
              </div>
              <div class="sys-chart-card__body">
                <canvas #radarCanvas></canvas>
              </div>
            </div>
            <div class="sys-chart-card insight-leaderboard-card" [class.insight-full-width]="domainGroups.length <= 1">
              <div class="sys-chart-card__header">
                <span class="chart-dot chart-dot--gold"></span>Top Habits
              </div>
              <div class="sys-chart-card__body sys-chart-card__body--list">
                <div class="habits-empty" *ngIf="topHabits.length === 0">
                  No habits yet. Add your first habit.
                </div>
                <ol class="leaderboard-list" *ngIf="topHabits.length > 0">
                  <li *ngFor="let habit of topHabits; let i = index; trackBy: trackByHabitId"
                    class="leaderboard-item"
                    [class.leaderboard-item--gold]="i === 0"
                    [class.leaderboard-item--silver]="i === 1"
                    [class.leaderboard-item--bronze]="i === 2">
                    <span class="leaderboard-rank">{{ i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1) }}</span>
                    <span class="leaderboard-name">{{ habit.habit.name }}</span>
                    <div class="leaderboard-right">
                      <div class="leaderboard-bar-track">
                        <div class="leaderboard-bar-fill"
                          [style.width.%]="habit.completionPercent"
                          [style.background]="i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--accent)'">
                        </div>
                      </div>
                      <span class="leaderboard-pct">{{ habit.completionPercent }}%</span>
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          </div>

        </div>
      </section>

      <div class="today-footer" *ngIf="showTodayFooter">
        <span>{{ doneCount }}/{{ totalCount }} done</span>
        <button class="btn btn-outline btn-sm jump-top" type="button" (click)="scrollToToday()">Jump to top</button>
      </div>

      <div class="install-banner install-banner-bottom" *ngIf="showInstallBanner">
        <span>Install Daily Levelling</span>
        <div class="install-actions">
          <button class="btn btn-primary btn-sm" type="button" (click)="installPwa()">Install</button>
          <button class="btn btn-icon btn-sm" type="button" aria-label="Dismiss install banner" (click)="dismissInstallBanner()">&#x2715;</button>
        </div>
      </div>

      </ng-container>
      <ng-template #loading>
        <mat-card class="aesthetic-card">
          <mat-card-content>Loading your habits...</mat-card-content>
        </mat-card>
      </ng-template>
    </div>
  `,
  styleUrls: ['./dashboard.component.sass']
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('todaySection') todaySection?: ElementRef<HTMLElement>;
  @ViewChild('lineCanvas') lineCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('barCanvas') barCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('radarCanvas') radarCanvas?: ElementRef<HTMLCanvasElement>;
  private lineChart?: Chart;
  private barChart?: Chart;
  private radarChart?: Chart;
  selectedMonthYear: MonthKey | null = null;
  daysInMonth = 0;
  monthlyTotals: MonthlyTotals = { completed: 0, goal: 0, left: 0, percent: 0 };
  dailyCounts: number[] = [];
  topHabits: TopHabit[] = [];
  habits: Habit[] = [];
  habitsCount = 0;
  completedTodayDisplay = '--';
  levelStats: LevelProgress = getLevelProgress(0);
  monthlyPercentDisplay = 0;
  totalHabitsDisplay = 0;
  currentStreakDisplay = 0;
  totalHabits = 0;
  insights: MonthInsights = { bestDay: 0, worstDay: 0, currentStreak: 0, perfectDays: 0 };
  animationKey = 0;
  reduceMotion = false;
  todayLabel = '';
  isEditingToday = true;
  motivationMessage = '';
  habitProgressMap: Record<string, number> = {};
  selectedDate = new Date();
  todayDate = this.normalizeDate(new Date());
  todayDateKey = '';
  insightsOpen = true;
  isMobile = false;
  showInstallBanner = false;
  showTodayFooter = false;
  doneCount = 0;
  totalCount = 0;
  streakCount = 0;
  remainingCount = 0;
  todayRemainingCount = 0;
  todaySummary = { doneCount: 0, skippedCount: 0, handledCount: 0, totalCount: 0, percentDone: 0, percentHandled: 0 };
  selectedSummary = { doneCount: 0, skippedCount: 0, handledCount: 0, totalCount: 0, percentDone: 0, percentHandled: 0 };
  todayIsPerfect = false;
  dateChips: DateChip[] = [];
  selectedIsPerfect = false;
  selectedIsWon = false;
  todayIsWon = false;
  celebrateBadge = false;
  confettiPieces: ConfettiPiece[] = [];
  private confettiTimer?: ReturnType<typeof setTimeout>;
  inlineRewardHabitId: string | null = null;
  inlineRewardText = '+1 XP';
  private inlineRewardTimer?: ReturnType<typeof setTimeout>;
  activeSystemOverlay: SystemOverlayType = 'none';
  private systemOverlayQueue: Array<Exclude<SystemOverlayType, 'none'>> = [];
  levelUpFrom = 0;
  levelUpTo = 0;
  private lastSeenLevel?: number;
  private systemOverlayTimer?: ReturnType<typeof setTimeout>;
  finishMomentMessage = '';
  finishMomentActive = false;
  private finishMomentTimer?: ReturnType<typeof setTimeout>;
  identityLine = '';
  private identityVariants = [
    'You’re building your real-life character.',
    'This is how consistency looks.',
    'One level stronger than yesterday.'
  ];
  streakCelebrating = false;
  private streakCelebrationTimer?: ReturnType<typeof setTimeout>;
  private previousStreakCount = 0;
  streakFireAnimating = false;
  private streakFireTimer?: ReturnType<typeof setTimeout>;
  levelUpAnimating = false;
  private levelUpTimer?: ReturnType<typeof setTimeout>;
  displayedHeaderProgress = 0;
  headerLevelUpCelebrating = false;
  private previousHeaderLevel = 0;
  private headerLevelUpTimer?: ReturnType<typeof setTimeout>;
  private previousLevel = 0;
  private previousTodayPerfect = false;
  private levelStatsReady = false;
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  domainGroups: DomainGroup[] = [];
  private viewReady = false;
  private readyResolved = false;
  private chartInitQueued = false;
  private chartInitRetries = 0;
  private focusTodayRequested = false;
  private installListener?: (event: Event) => void;
  private resizeListener?: () => void;
  private lastMonthKey: string | null = null;
  private rewardStageMap: Record<string, number> = {};
  private xpFloatMap = new Map<string, boolean>();
  private xpFloatTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private donePopMap = new Map<string, boolean>();
  private donePopTimers = new Map<string, ReturnType<typeof setTimeout>>();
  ready$!: Observable<boolean>;
  get isPerfectTodaySelected(): boolean {
    return this.isSameDate(this.selectedDate, this.todayDate) && this.todayIsPerfect;
  }

  get dailyMotivation(): string {
    return getDailyMotivation(this.todayDate.getDate());
  }

  get userName(): string {
    return this.habitStore.getCurrentUsername() || 'Player';
  }

  get weeklyBarLabels(): string[] {
    const today = this.todayDate.getDate();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const labels: string[] = [];
    const startDay = Math.max(1, today - 6);
    for (let d = startDay; d <= today; d++) {
      const date = new Date(this.todayDate.getFullYear(), this.todayDate.getMonth(), d);
      labels.push(dayNames[date.getDay()]);
    }
    return labels;
  }

  get weeklyBarData(): number[] {
    const today = this.todayDate.getDate();
    return this.dailyCounts.slice(Math.max(0, today - 7), today);
  }

  get domainRadarLabels(): string[] {
    return this.domainGroups
      .filter(g => g.totalCount > 0)
      .map(g => g.config?.label ?? 'General');
  }

  get domainRadarData(): number[] {
    return this.domainGroups
      .filter(g => g.totalCount > 0)
      .map(g => Math.round((g.completedCount / g.totalCount) * 100));
  }

  get canUseDateCarousel(): boolean {
    const name = (this.userName || '').trim();
    if (!name) {
      return false;
    }
    return name.toLowerCase() === 'giri';
  }

  get heroStatusLine(): string {
    if (this.selectedSummary.totalCount === 0) {
      return 'Add habits to start.';
    }
    if (this.remainingCount > 0) {
      return `${this.remainingCount} ${plural(this.remainingCount, 'habit')} left`;
    }
    if (this.selectedIsPerfect) {
      return 'Return tomorrow. Protect the chain.';
    }
    return 'Won today 🔥';
  }

  get levelBadgeText(): string {
    return `Level ${this.levelStats.level}`;
  }

  get levelXpText(): string {
    return `XP: ${this.levelStats.totalXp}`;
  }

  get levelProgressText(): string {
    const totalXp = this.levelStats.totalXp;
    if (this.levelStats.level === 0 && totalXp === 0) {
      return 'Gain 3 XP to reach Level 1';
    }

    return `${this.levelStats.progressInLevel}/${this.levelStats.requiredThisLevel} XP to Level ${this.levelStats.nextLevel}`;
  }

  get isSelectedDayFinalized(): boolean {
    return this.selectedSummary.totalCount > 0 && this.selectedSummary.handledCount >= this.selectedSummary.totalCount;
  }

  get doneToday(): number {
    return this.isEditingToday ? this.selectedSummary.doneCount : 0;
  }

  get momentumSubtitle(): string {
    if (this.levelStats.remainingToNext === 0) {
      return 'Level up achieved. Finish strong.';
    }

    return `${this.levelStats.remainingToNext} more XP to reach Level ${this.levelStats.nextLevel}.`;
  }

  get isTodaySelected(): boolean {
    return this.isSameDate(this.selectedDate, this.todayDate);
  }

  get canActOnToday(): boolean {
    return this.isTodaySelected;
  }

  get showTodayActions(): boolean {
    return this.canActOnToday && this.remainingCount > 0;
  }

  get canSkipRemaining(): boolean {
    return this.isTodaySelected && this.remainingCount > 0;
  }

  private subscription: Subscription = new Subscription();

  constructor(
    private habitStore: HabitStoreService,
    private achievementsService: AchievementsService,
    private soundService: SoundService,
    private themeService: ThemeService,
    private questService: QuestService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.todayDate = this.normalizeDate(new Date());
    this.todayDateKey = this.toIsoDateLocal(this.todayDate);
    this.ready$ = this.habitStore.getReady();
    if (isPlatformBrowser(this.platformId)) {
      this.subscription.add(
        this.ready$.subscribe(ready => {
          this.readyResolved = ready;
          if (ready) {
            this.queueChartInitialization();
          }
        })
      );
    }
    this.subscription.add(
      combineLatest([
        this.habitStore.getHabits(),
        this.habitStore.getCompletions(),
        this.habitStore.getSkips(),
        this.habitStore.getSelectedMonthYear(),
        this.habitStore.getSelectedDateKey(),
        this.habitStore.getLevelStats()
      ]).subscribe(([habits, completions, skips, monthYear, dateKey, levelStats]) => {
        const parsed = this.dateFromKey(dateKey);
        if (parsed) {
          this.selectedDate = parsed;
        }
        this.selectedMonthYear = monthYear;
        this.levelStats = levelStats;
        const newLevel = levelStats.level;
        if (this.lastSeenLevel === undefined) {
          this.lastSeenLevel = newLevel;
        } else {
          this.lastSeenLevel = newLevel;
        }
        const nextHeaderProgress = this.nextLevelProgress;
        if (this.levelStatsReady && levelStats.level > this.previousLevel) {
          this.triggerLevelUpGlow();
        }
        if (this.levelStatsReady && levelStats.level > this.previousHeaderLevel) {
          this.startHeaderLevelUpSequence(nextHeaderProgress);
        } else if (!this.headerLevelUpCelebrating) {
          this.displayedHeaderProgress = nextHeaderProgress;
        }
        if (!this.levelStatsReady) {
          this.levelStatsReady = true;
        }
        this.previousLevel = levelStats.level;
        this.previousHeaderLevel = levelStats.level;
        this.habits = this.habitStore.getHabitsActiveOn(dateKey);
        this.habitsCount = this.habits.length;
        this.domainGroups = this.getHabitsByDomain(this.habits, completions, skips, dateKey);
        this.updateData();
        this.syncSelectedDateToMonth();
        this.updateTodayLabels();
        this.updateDateChips();
        this.updateHabitProgress();
        this.recomputeDashboardState();
      })
    );

    this.subscription.add(
      this.habitStore.getBadgeUnlockEvents().subscribe(ids => {
        ids.forEach(id => {
          this.snackBar.open(`Badge unlocked: ${this.achievementsService.getBadgeTitle(id)}`, undefined, { duration: 2200 });
        });
      })
    );
    this.subscription.add(
      this.themeService.getTheme().subscribe(() => {
      if (isPlatformBrowser(this.platformId)) {
        this.updateChartTheme();
      }
    })
  );
    this.subscription.add(
      this.themeService.getReducedMotion().subscribe(reduce => {
        this.reduceMotion = reduce;
      })
    );
    if (isPlatformBrowser(this.platformId)) {
      this.subscription.add(
        this.route.queryParamMap.subscribe(params => {
          if (params.get('focus') === 'todayList') {
            this.focusTodayRequested = true;
            this.tryFocusTodayList();
          }
        })
      );
    }

    if (isPlatformBrowser(this.platformId)) {
      const dismissed = window.localStorage?.getItem('pwa_install_banner_dismissed') === 'true';
      this.rewardStageMap = this.loadRewardStageMap();
      this.installListener = (event: Event) => {
        event.preventDefault();
        this.deferredPrompt = event as BeforeInstallPromptEvent;
        if (!dismissed && this.isMobileDevice()) {
          this.showInstallBanner = true;
        }
      };
      window.addEventListener('beforeinstallprompt', this.installListener);
    }
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.tryFocusTodayList();
    if (isPlatformBrowser(this.platformId)) {
      this.queueChartInitialization();
      this.updateViewport();
      this.updateFooterVisibility();
      this.resizeListener = () => this.updateViewport();
      window.addEventListener('resize', this.resizeListener);
    }
  }

  private queueChartInitialization(): void {
    if (!isPlatformBrowser(this.platformId) || this.chartInitQueued) {
      return;
    }
    this.chartInitQueued = true;
    requestAnimationFrame(() => {
      this.chartInitQueued = false;
      this.createChartsIfNeeded();
      const missingCanvas = !this.lineCanvas?.nativeElement || !this.barCanvas?.nativeElement;
      const missingCharts = !this.lineChart || !this.barChart;
      if (this.readyResolved && this.viewReady && missingCanvas && missingCharts && this.chartInitRetries < 8) {
        this.chartInitRetries++;
        this.queueChartInitialization();
      } else if (!missingCharts) {
        this.chartInitRetries = 0;
      }
    });
  }

  private createChartsIfNeeded(): void {
    if (!isPlatformBrowser(this.platformId) || !this.viewReady) {
      return;
    }
    const hasLineCanvas = !!this.lineCanvas?.nativeElement;
    const hasBarCanvas = !!this.barCanvas?.nativeElement;
    if (!hasLineCanvas || !hasBarCanvas) {
      return;
    }
    if (!this.lineChart || !this.barChart) {
      this.createCharts();
      this.updateChartTheme();
      return;
    }
    this.updateCharts();
  }

  private createCharts(): void {
    if (this.lineCanvas && !this.lineChart) {
      this.lineChart = new Chart(this.lineCanvas.nativeElement, {
        type: 'line',
        data: {
          labels: Array.from({ length: this.daysInMonth }, (_, i) => (i + 1).toString()),
          datasets: [{
            label: 'Habits Completed',
            data: this.dailyCounts,
            borderColor: this.getCssVar('--theme-accent'),
            backgroundColor: this.getCssVar('--theme-accent-soft'),
            fill: true,
            pointBackgroundColor: this.getCssVar('--theme-accent'),
            pointBorderColor: this.getCssVar('--theme-accent'),
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.4,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            y: {
              beginAtZero: true,
              max: Math.max(this.habitsCount, 1),
              ticks: { stepSize: 1 }
            },
            x: { ticks: { maxTicksLimit: 10 } }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => `Day ${context.label}: ${context.parsed.y} of ${this.habitsCount}`
              }
            }
          }
        }
      });
    }
    if (this.barCanvas && !this.barChart) {
      this.barChart = new Chart(this.barCanvas.nativeElement, {
        type: 'bar',
        data: {
          labels: this.weeklyBarLabels,
          datasets: [{
            label: 'Completed',
            data: this.weeklyBarData,
            backgroundColor: 'rgba(0, 229, 255, 0.22)',
            borderColor: 'rgba(0, 229, 255, 0.7)',
            borderWidth: 1,
            borderRadius: 5,
            hoverBackgroundColor: 'rgba(0, 229, 255, 0.42)'
          } as any]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            y: {
              beginAtZero: true,
              max: Math.max(this.habitsCount, 1),
              ticks: { stepSize: 1 }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => `${context.parsed.y} / ${this.habitsCount} habits`
              }
            }
          }
        }
      });
    }
    if (this.radarCanvas && !this.radarChart && this.domainRadarLabels.length > 1) {
      this.radarChart = new Chart(this.radarCanvas.nativeElement, {
        type: 'radar',
        data: {
          labels: this.domainRadarLabels,
          datasets: [{
            label: 'Completion %',
            data: this.domainRadarData,
            backgroundColor: 'rgba(123, 95, 255, 0.18)',
            borderColor: 'rgba(123, 95, 255, 0.75)',
            borderWidth: 1.5,
            pointBackgroundColor: 'rgba(123, 95, 255, 1)',
            pointBorderColor: 'rgba(200, 220, 255, 0.5)',
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            r: {
              beginAtZero: true,
              max: 100,
              ticks: { display: false, stepSize: 25 },
              pointLabels: { color: 'rgba(150, 190, 255, 0.8)', font: { size: 11 } },
              grid: { color: 'rgba(61, 127, 255, 0.12)' },
              angleLines: { color: 'rgba(61, 127, 255, 0.12)' }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => `${context.parsed.r}% complete`
              }
            }
          }
        }
      });
    }

    this.updateChartTheme();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    if (this.systemOverlayTimer) {
      clearTimeout(this.systemOverlayTimer);
    }
    if (isPlatformBrowser(this.platformId)) {
      if (this.headerLevelUpTimer) {
        clearTimeout(this.headerLevelUpTimer);
      }
      this.lineChart?.destroy();
      this.barChart?.destroy();
      this.radarChart?.destroy();
      if (this.resizeListener) {
        window.removeEventListener('resize', this.resizeListener);
      }
      if (this.installListener) {
        window.removeEventListener('beforeinstallprompt', this.installListener);
      }
    }
    this.xpFloatTimers.forEach(timer => clearTimeout(timer));
    this.donePopTimers.forEach(timer => clearTimeout(timer));
    this.xpFloatTimers.clear();
    this.donePopTimers.clear();
    this.xpFloatMap.clear();
    this.donePopMap.clear();
  }

  private updateData(): void {
    if (this.selectedMonthYear) {
      this.habitsCount = this.habitStore.getMaxActiveHabitsInMonth(this.selectedMonthYear.year, this.selectedMonthYear.month);
      this.daysInMonth = this.habitStore.getDaysInMonth();
      this.monthlyTotals = this.habitStore.getMonthlyTotals();
      this.dailyCounts = this.habitStore.getDailyCompletedCounts();
      this.topHabits = this.habitStore.getTopHabits(8);
      this.insights = this.habitStore.getMonthInsights(this.selectedMonthYear.year, this.selectedMonthYear.month);
      this.totalHabits = this.habitsCount;
      const completedToday = this.getCompletedTodayValue();
      this.completedTodayDisplay = completedToday === null ? '--' : String(completedToday);
      const monthKey = `${this.selectedMonthYear.year}-${this.selectedMonthYear.month}`;
      const shouldAnimate = this.lastMonthKey !== monthKey;
      this.lastMonthKey = monthKey;
      this.animateKpis(shouldAnimate);
      this.animationKey++;

      if (isPlatformBrowser(this.platformId)) {
        this.createChartsIfNeeded();
      }
    }
  }

  private getCompletedTodayValue(): number | null {
    const dateKey = this.toIsoDateLocal(this.selectedDate);
    const dayMap = this.habitStore.getCompletionsSync()[dateKey] || {};
    const activeHabits = this.habits;
    const completedCount = activeHabits.reduce((sum, habit) => sum + (dayMap[habit.id] ? 1 : 0), 0);
    return completedCount;
  }

  isTodayChecked(habitId: string): boolean {
    return this.habitStore.isCompleted(habitId, this.selectedDate);
  }

  isSelectedDaySkipped(habitId: string): boolean {
    return this.habitStore.isSkipped(habitId, this.selectedDate);
  }

  getHabitXp(habit: Habit): number {
    return this.habitStore.getHabitXpValue(habit);
  }

  isXpFloatActive(habitId: string): boolean {
    return this.xpFloatMap.get(habitId) === true;
  }

  isDonePopActive(habitId: string): boolean {
    return this.donePopMap.get(habitId) === true;
  }

  toggleTodayHabit(habitId: string): void {
    const summaryBefore = this.habitStore.getDaySummary(this.selectedDate);
    const wasPerfectBefore = this.isStrictPerfect(summaryBefore);
    const wasDone = this.habitStore.isCompleted(habitId, this.selectedDate);
    const levelBefore = this.habitStore.getLevelStatsSync().level;
    if (this.habitStore.isSkipped(habitId, this.selectedDate)) {
      this.habitStore.unskipHabit(habitId, this.selectedDate);
      this.habitStore.setCompleted(habitId, this.selectedDate, true);
    } else {
      const next = !this.habitStore.isCompleted(habitId, this.selectedDate);
      if (!next) {
        this.habitStore.unskipHabit(habitId, this.selectedDate);
      }
      this.habitStore.setCompleted(habitId, this.selectedDate, next);
    }
    this.refreshTodayState();
    const summaryAfter = this.habitStore.getDaySummary(this.selectedDate);
    this.handleRewards(summaryBefore, summaryAfter);
    // Update quest progress on every toggle (complete OR uncomplete) for today only.
    // Called here — outside the isDoneNow guard — so unchecking a habit that drops
    // the count below a quest threshold immediately removes today's counted day.
    if (this.isSameDate(this.selectedDate, this.todayDate)) {
      this.questService.checkQuestProgress(summaryAfter.doneCount, summaryAfter.totalCount);
    }
    const isPerfectAfter = this.isStrictPerfect(summaryAfter);
    if (this.isSameDate(this.selectedDate, this.todayDate) && wasPerfectBefore && !isPerfectAfter) {
      this.showToast('Perfect bonus removed');
    }
    const isDoneNow = this.habitStore.isCompleted(habitId, this.selectedDate);
    if (!wasDone && isDoneNow) {
      const levelAfter = this.habitStore.getLevelStatsSync().level;
      const leveledUp = levelAfter > levelBefore;
      const becamePerfect = !wasPerfectBefore && isPerfectAfter;
      this.soundService.play('habitComplete');
      if (becamePerfect) {
        this.queueSystemOverlay('perfect');
      }
      if (leveledUp) {
        this.levelUpFrom = levelBefore;
        this.levelUpTo = levelAfter;
        this.queueSystemOverlay('levelup');
      }
      this.triggerXpFloat(habitId);
      this.triggerDonePopFx(habitId);
    }
  }

  onHabitCardActivate(habit: Habit, event: Event): void {
    this.toggleHabitForSelectedDay(habit);
  }

  toggleHabitForSelectedDay(habit: Habit): void {
    this.toggleTodayHabit(habit.id);
  }

  finishToday(): void {
    if (!this.showTodayActions) {
      return;
    }
    const before = this.habitStore.getDaySummary(this.todayDate);
    this.habitStore.skipRemaining(this.todayDate, 'Finished Day');
    this.refreshTodayState();
    const after = this.habitStore.getDaySummary(this.todayDate);
    this.handleRewards(before, after);
    this.triggerFinishMoment(after);
    this.cdr.markForCheck();
  }

  toggleInsights(): void {
    this.insightsOpen = !this.insightsOpen;
  }

  installPwa(): void {
    if (!this.deferredPrompt) {
      return;
    }
    void this.deferredPrompt.prompt();
    void this.deferredPrompt.userChoice.then(choice => {
      this.showInstallBanner = false;
      this.deferredPrompt = null;
      if (choice.outcome === 'dismissed') {
        this.dismissInstallBanner();
      }
    });
  }

  dismissInstallBanner(): void {
    this.showInstallBanner = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('pwa_install_banner_dismissed', 'true');
    }
  }

  get nextLevelRemaining(): number {
    const remaining = typeof this.levelStats.remainingToNext === 'number'
      ? this.levelStats.remainingToNext
      : (this.levelStats.requiredThisLevel - this.levelStats.progressInLevel);
    return Math.max(0, Math.floor(remaining));
  }

  get nextLevelLabel(): string {
    const remaining = this.nextLevelRemaining;
    if (remaining === 1) {
      return '1 more habit to Level Up';
    }
    return `${remaining} more ${plural(remaining, 'habit')} to Level Up`;
  }

  get nextLevelProgress(): number {
    const raw = this.levelStats.progressPercent;
    if (typeof raw === 'number') {
      return raw > 1 ? Math.min(raw / 100, 1) : Math.max(raw, 0);
    }
    const span = Math.max(this.levelStats.requiredThisLevel, 1);
    return Math.min(Math.max(this.levelStats.progressInLevel / span, 0), 1);
  }

  goToProfile(): void {
    this.router.navigateByUrl('/profile');
  }

  trackByHabitId(index: number, habit: TopHabit): string {
    return habit.habit.id;
  }

  trackByHabitCard(index: number, habit: Habit): string {
    return habit.id;
  }

  trackByDomain(index: number, group: DomainGroup): string {
    return group.domain;
  }

  trackByHabitInGroup(index: number, item: { habit: Habit; checked: boolean; skipped: boolean }): string {
    return item.habit.id;
  }

  getHabitsByDomain(habits: Habit[], completions: HabitCompletion, skips: HabitSkips, dateKey: string): DomainGroup[] {
    const grouped = new Map<string, DomainGroup>();
    const domainOrder = DOMAINS.map(d => d.id);

    for (const habit of habits) {
      const domain = habit.domain ?? 'uncategorized';
      if (!grouped.has(domain)) {
        grouped.set(domain, {
          domain: domain as HabitDomain,
          config: domain !== 'uncategorized' ? getDomainConfig(domain as HabitDomain) : null,
          habits: [],
          completedCount: 0,
          totalCount: 0
        });
      }
      const checked = !!completions[dateKey]?.[habit.id];
      const skipped = !!skips[dateKey]?.[habit.id];
      const group = grouped.get(domain)!;
      group.habits.push({ habit, checked, skipped });
      group.totalCount++;
      if (checked) group.completedCount++;
    }

    return Array.from(grouped.values()).sort((a, b) => {
      const ai = domainOrder.indexOf(a.domain as HabitDomain);
      const bi = domainOrder.indexOf(b.domain as HabitDomain);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }

  private findFirstRemainingHabitId(): string | null {
    for (const habit of this.habits) {
      if (!this.habitStore.isCompleted(habit.id, this.selectedDate) &&
          !this.habitStore.isSkipped(habit.id, this.selectedDate)) {
        return habit.id;
      }
    }
    return null;
  }

  private findFirstSkippedHabitId(): string | null {
    for (const habit of this.habits) {
      if (this.habitStore.isSkipped(habit.id, this.selectedDate)) {
        return habit.id;
      }
    }
    return null;
  }

  isNextHabit(habitId: string): boolean {
    const nextId = this.findFirstRemainingHabitId();
    return nextId === habitId;
  }

  private scrollToHabit(habitId: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const element = document.getElementById(`habit-${habitId}`);
    if (!element) {
      return;
    }
    element.scrollIntoView({
      behavior: this.reduceMotion ? 'auto' : 'smooth',
      block: 'center'
    });
  }

  private updateCharts(): void {
    if (this.lineChart) {
      this.lineChart.data.labels = Array.from({ length: this.daysInMonth }, (_, i) => (i + 1).toString());
      this.lineChart.data.datasets[0].data = this.dailyCounts;
      this.lineChart.options.scales!['y']!.max = Math.max(this.habitsCount, 1);
      this.lineChart.update();
    }
    if (this.barChart) {
      this.barChart.data.labels = this.weeklyBarLabels;
      this.barChart.data.datasets[0].data = this.weeklyBarData;
      this.barChart.options.scales!['y']!.max = Math.max(this.habitsCount, 1);
      this.barChart.update();
    }
    if (this.radarChart) {
      this.radarChart.data.labels = this.domainRadarLabels;
      this.radarChart.data.datasets[0].data = this.domainRadarData;
      this.radarChart.update();
    }
    this.updateChartTheme();
  }

  private updateChartTheme(): void {
    const accent = this.getCssVar('--theme-accent');
    const glow = this.getCssVar('--theme-accent-soft');
    const muted = this.getCssVar('--theme-chart-text');
    const grid = this.getCssVar('--theme-chart-grid');
    const fontFamily = this.getCssVar('--app-font-family');
    if (fontFamily) {
      Chart.defaults.font.family = fontFamily;
    }

    if (this.lineChart) {
      const lineDataset = this.lineChart.data.datasets[0] as ChartDataset<'line'>;
      lineDataset.borderColor = accent;
      lineDataset.backgroundColor = glow;
      lineDataset.pointBackgroundColor = accent;
      lineDataset.pointBorderColor = accent;
      if (this.lineChart.options.scales?.['y']?.ticks) {
        this.lineChart.options.scales['y'].ticks.color = muted;
      }
      if (this.lineChart.options.scales?.['x']?.ticks) {
        this.lineChart.options.scales['x'].ticks.color = muted;
      }
      if (this.lineChart.options.scales?.['y']?.grid) {
        this.lineChart.options.scales['y'].grid.color = grid;
      }
      if (this.lineChart.options.scales?.['x']?.grid) {
        this.lineChart.options.scales['x'].grid.color = grid;
      }
      this.lineChart.options.font = { family: fontFamily || Chart.defaults.font.family };
    }

    if (this.barChart) {
      if (this.barChart.options.scales?.['y']?.ticks) {
        this.barChart.options.scales['y'].ticks.color = muted;
      }
      if (this.barChart.options.scales?.['x']?.ticks) {
        this.barChart.options.scales['x'].ticks.color = muted;
      }
      if (this.barChart.options.scales?.['y']?.grid) {
        this.barChart.options.scales['y'].grid.color = grid;
      }
      if (this.barChart.options.scales?.['x']?.grid) {
        this.barChart.options.scales['x'].grid.color = grid;
      }
      this.barChart.options.font = { family: fontFamily || Chart.defaults.font.family };
    }

    if (this.radarChart) {
      if (this.radarChart.options.scales?.['r']?.grid) {
        this.radarChart.options.scales['r'].grid.color = grid;
      }
      if ((this.radarChart.options.scales?.['r'] as any)?.angleLines) {
        (this.radarChart.options.scales!['r'] as any).angleLines.color = grid;
      }
      if ((this.radarChart.options.scales?.['r'] as any)?.pointLabels) {
        (this.radarChart.options.scales!['r'] as any).pointLabels.color = muted;
      }
      this.radarChart.options.font = { family: fontFamily || Chart.defaults.font.family };
    }
  }

  private getCssVar(name: string): string {
    if (!isPlatformBrowser(this.platformId)) {
      return '#f27a2a';
    }
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#f27a2a';
  }

  private animateKpis(shouldAnimate: boolean): void {
    if (!shouldAnimate || this.reduceMotion || !isPlatformBrowser(this.platformId)) {
      const completedToday = this.getCompletedTodayValue();
      this.completedTodayDisplay = completedToday === null ? '--' : String(completedToday);
      this.monthlyPercentDisplay = this.monthlyTotals.percent;
      this.totalHabitsDisplay = this.totalHabits;
      this.currentStreakDisplay = this.insights.currentStreak;
      return;
    }

    const completedToday = this.getCompletedTodayValue();
    if (completedToday === null) {
      this.completedTodayDisplay = '--';
    } else {
      this.animateValue(Number(this.completedTodayDisplay) || 0, completedToday, value => {
        this.completedTodayDisplay = String(value);
      });
    }
    this.animateValue(this.monthlyPercentDisplay, this.monthlyTotals.percent, value => {
      this.monthlyPercentDisplay = value;
    });
    this.animateValue(this.totalHabitsDisplay, this.totalHabits, value => {
      this.totalHabitsDisplay = value;
    });
    this.animateValue(this.currentStreakDisplay, this.insights.currentStreak, value => {
      this.currentStreakDisplay = value;
    });
  }

  private animateValue(start: number, end: number, setValue: (value: number) => void): void {
    const duration = 320;
    const startTime = performance.now();
    const delta = end - start;

    const step = (time: number) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + delta * eased));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }

  getMonthName(monthIndex: number): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthIndex];
  }

  private getDefaultSelectedDate(): Date {
    return new Date();
  }

  private updateTodayLabels(): void {
    const date = this.selectedDate;
    this.todayLabel = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    this.isEditingToday = this.isSameDate(this.todayDate, date);
  }

  private updateDateChips(): void {
    this.dateChips = this.getDateChips();
  }

  private updateHabitProgress(): void {
    if (!this.selectedMonthYear) {
      this.habitProgressMap = {};
      return;
    }
    const { year, month } = this.selectedMonthYear;
    this.habitProgressMap = this.habits.reduce((acc, habit) => {
      acc[habit.id] = this.habitStore.getHabitCompletionPercent(habit.id, year, month);
      return acc;
    }, {} as Record<string, number>);
  }

  private recomputeDashboardState(): void {
    const wasPerfect = this.previousTodayPerfect;
    this.todayDate = this.normalizeDate(new Date());
    this.todayDateKey = this.toIsoDateLocal(this.todayDate);
    this.selectedSummary = this.habitStore.getDaySummary(this.selectedDate);
    this.todaySummary = this.habitStore.getDaySummary(this.todayDate);
    this.selectedIsPerfect = this.isStrictPerfect(this.selectedSummary);
    this.todayIsPerfect = this.isStrictPerfect(this.todaySummary);
    this.selectedIsWon = this.isWonDay(this.selectedSummary);
    this.todayIsWon = this.isWonDay(this.todaySummary);

    this.doneCount = this.selectedSummary.doneCount;
    this.totalCount = this.selectedSummary.totalCount;
    this.remainingCount = Math.max(this.selectedSummary.totalCount - this.selectedSummary.handledCount, 0);
    this.todayRemainingCount = Math.max(this.todaySummary.totalCount - this.todaySummary.handledCount, 0);

    const newStreak = this.habitStore.getStreakCount(this.todayDateKey);
    if (this.isSameDate(this.selectedDate, this.todayDate) && newStreak > this.previousStreakCount) {
      this.triggerStreakCelebration();
      this.triggerStreakFireBurst();
    }
    if (this.isSameDate(this.selectedDate, this.todayDate) && !wasPerfect && this.todayIsPerfect) {
      this.triggerStreakFireBurst();
    }
    this.streakCount = newStreak;
    this.previousStreakCount = newStreak;
    this.currentStreakDisplay = this.streakCount;
    this.previousTodayPerfect = this.todayIsPerfect;

    this.motivationMessage = '';
    this.updateIdentityLine();
  }

  private refreshTodayState(): void {
    this.updateTodayLabels();
    this.updateHabitProgress();
    this.recomputeDashboardState();
    this.updateIdentityLine();
  }

  private updateViewport(): void {
    this.isMobile = window.innerWidth < 1024;
    this.insightsOpen = !this.isMobile;
    if (isPlatformBrowser(this.platformId)) {
      this.updateChartTheme();
    }
  }

  private isMobileDevice(): boolean {
    return window.matchMedia?.('(max-width: 1023px)').matches ?? window.innerWidth < 1024;
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.updateFooterVisibility();
  }

  scrollToToday(): void {
    const target = this.todaySection?.nativeElement;
    const behavior: ScrollBehavior = this.reduceMotion ? 'auto' : 'smooth';
    if (target) {
      target.scrollIntoView({ behavior, block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior });
    }
  }

  private tryFocusTodayList(): void {
    if (!this.focusTodayRequested || !this.viewReady) {
      return;
    }
    this.focusTodayRequested = false;
    this.scrollToToday();
  }

  private updateFooterVisibility(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (!this.isMobile || !this.todaySection) {
      this.showTodayFooter = false;
      return;
    }
    const rect = this.todaySection.nativeElement.getBoundingClientRect();
    this.showTodayFooter = rect.bottom < 0;
  }

  goPrevDay(): void {
    const date = new Date(this.selectedDate);
    date.setDate(date.getDate() - 1);
    this.setSelectedDate(date);
  }

  goNextDay(): void {
    const date = new Date(this.selectedDate);
    date.setDate(date.getDate() + 1);
    this.setSelectedDate(date);
  }

  goToday(): void {
    this.setSelectedDate(new Date());
  }

  shiftDateWindow(days: number): void {
    const date = new Date(this.selectedDate);
    date.setDate(date.getDate() + days);
    this.setSelectedDate(date);
  }

  setSelectedDate(date: Date): void {
    this.habitStore.setSelectedMonthYear(date.getFullYear(), date.getMonth());
    this.habitStore.setSelectedDate(date);
  }

  private syncSelectedDateToMonth(): void {
    if (!this.selectedMonthYear) {
      return;
    }
    const { year, month } = this.selectedMonthYear;
    const daysInMonth = DateUtils.daysInMonth(year, month);
    const currentDay = this.selectedDate.getDate();

    if (this.selectedDate.getFullYear() !== year || this.selectedDate.getMonth() !== month) {
      this.selectedDate = new Date(year, month, Math.min(currentDay, daysInMonth));
      return;
    }

    if (currentDay > daysInMonth) {
      this.selectedDate = new Date(year, month, daysInMonth);
    }
  }

  private getDateChips(): DateChip[] {
    const chips: DateChip[] = [];
    for (let offset = -3; offset <= 3; offset++) {
      const date = new Date(this.selectedDate);
      date.setDate(date.getDate() + offset);
      const summary = this.habitStore.getDaySummary(date);
      chips.push({
        date,
        label: date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
        isPerfect: this.isStrictPerfect(summary)
      });
    }
    return chips;
  }

  private toIsoDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  isSameDate(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  triggerPerfectDayCelebrate(): void {
    if (this.reduceMotion) {
      return;
    }
    if (this.confettiTimer) {
      clearTimeout(this.confettiTimer);
    }
    this.celebrateBadge = true;
    const count = 22;
    this.confettiPieces = Array.from({ length: count }, (_, index) => ({
      id: index,
      x: 35 + Math.random() * 30,
      drift: (Math.random() - 0.5) * 60,
      rotate: Math.random() * 360,
      size: 6 + Math.random() * 6,
      delay: Math.random() * 120,
      duration: 900 + Math.random() * 300
    }));
    this.confettiTimer = setTimeout(() => {
      this.celebrateBadge = false;
      this.confettiPieces = [];
    }, 3000);
  }

  trackByConfetti(index: number, piece: ConfettiPiece): number {
    return piece.id;
  }

  private normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private triggerStreakCelebration(): void {
    if (this.reduceMotion) {
      return;
    }
    if (this.streakCelebrationTimer) {
      clearTimeout(this.streakCelebrationTimer);
    }
    this.streakCelebrating = true;
    this.streakCelebrationTimer = setTimeout(() => {
      this.streakCelebrating = false;
    }, 2200);
  }

  private triggerStreakFireBurst(): void {
    if (this.reduceMotion) {
      return;
    }
    if (this.streakFireTimer) {
      clearTimeout(this.streakFireTimer);
    }
    this.streakFireAnimating = true;
    this.streakFireTimer = setTimeout(() => {
      this.streakFireAnimating = false;
    }, 2000);
  }

  private triggerLevelUpGlow(): void {
    if (this.reduceMotion) {
      return;
    }
    if (this.levelUpTimer) {
      clearTimeout(this.levelUpTimer);
    }
    this.levelUpAnimating = true;
    this.levelUpTimer = setTimeout(() => {
      this.levelUpAnimating = false;
    }, 10000);
  }

  dismissSystemOverlay(): void {
    if (this.systemOverlayTimer) {
      clearTimeout(this.systemOverlayTimer);
      this.systemOverlayTimer = undefined;
    }
    this.activeSystemOverlay = 'none';
    this.cdr.markForCheck();
    this.playNextSystemOverlay();
  }

  private queueSystemOverlay(type: Exclude<SystemOverlayType, 'none'>): void {
    if (this.activeSystemOverlay === type) {
      return;
    }
    const lastQueued = this.systemOverlayQueue[this.systemOverlayQueue.length - 1];
    if (lastQueued === type) {
      return;
    }
    this.systemOverlayQueue.push(type);
    if (this.activeSystemOverlay === 'none') {
      this.playNextSystemOverlay();
    }
  }

  private playNextSystemOverlay(): void {
    if (this.activeSystemOverlay !== 'none') {
      return;
    }
    const next = this.systemOverlayQueue.shift();
    if (!next) {
      return;
    }
    this.activeSystemOverlay = next;
    if (next === 'perfect') {
      this.soundService.play('perfectDay');
    } else if (next === 'levelup') {
      this.soundService.play('levelUp');
    }
    this.cdr.markForCheck();
    if (this.systemOverlayTimer) {
      clearTimeout(this.systemOverlayTimer);
    }
    this.systemOverlayTimer = setTimeout(() => {
      this.activeSystemOverlay = 'none';
      this.systemOverlayTimer = undefined;
      this.cdr.markForCheck();
      this.playNextSystemOverlay();
    }, 3000);
  }


  private startHeaderLevelUpSequence(nextProgress: number): void {
    if (this.headerLevelUpTimer) {
      clearTimeout(this.headerLevelUpTimer);
    }
    if (this.reduceMotion) {
      this.headerLevelUpCelebrating = false;
      this.displayedHeaderProgress = nextProgress;
      this.cdr.markForCheck();
      return;
    }
    this.displayedHeaderProgress = 1;
    this.headerLevelUpCelebrating = true;
    this.cdr.markForCheck();
    this.headerLevelUpTimer = setTimeout(() => {
      this.headerLevelUpCelebrating = false;
      this.displayedHeaderProgress = nextProgress;
      this.cdr.markForCheck();
    }, 3000);
  }

  private handleRewards(
    before: { doneCount: number; skippedCount: number; handledCount: number; totalCount: number; percentDone: number; percentHandled: number },
    after: { doneCount: number; skippedCount: number; handledCount: number; totalCount: number; percentDone: number; percentHandled: number }
  ): void {
    if (!this.isSameDate(this.selectedDate, this.todayDate)) {
      return;
    }
    if (after.totalCount === 0) {
      return;
    }
    const dateKey = this.todayDateKey;
    const stage = this.rewardStageMap[dateKey] || 0;
    if (before.handledCount === 0 && after.handledCount === 1 && stage < 1) {
      this.showToast('Level started.');
      this.rewardStageMap[dateKey] = 1;
    }
    if (before.percentHandled < 50 && after.percentHandled >= 50 && stage < 2) {
      this.showToast('Nice');
      this.rewardStageMap[dateKey] = 2;
    }
    if (before.percentHandled < 100 && after.percentHandled === 100 && stage < 3) {
      this.showToast('+5 XP Perfect day bonus');
      this.rewardStageMap[dateKey] = 3;
      if (!this.reduceMotion) {
        this.triggerPerfectDayCelebrate();
      }
    }
    this.saveRewardStageMap();
  }

  private showToast(message: string): void {
    this.snackBar.open(message, undefined, { duration: 2000, panelClass: ['reward-toast'] });
  }

  private showHabitReward(habitId: string): void {
    if (!this.isSameDate(this.selectedDate, this.todayDate)) {
      return;
    }
    const xpValue = this.habitStore.getHabitXpValue(habitId);
    if (this.inlineRewardTimer) {
      clearTimeout(this.inlineRewardTimer);
    }
    this.inlineRewardText = `+${xpValue} XP`;
    this.inlineRewardHabitId = habitId;
    this.inlineRewardTimer = setTimeout(() => {
      if (this.inlineRewardHabitId === habitId) {
        this.inlineRewardHabitId = null;
      }
    }, 1000);
  }

  private triggerXpFloat(habitId: string): void {
    this.xpFloatMap.set(habitId, true);
    const existing = this.xpFloatTimers.get(habitId);
    if (existing) {
      clearTimeout(existing);
    }
    const duration = this.reduceMotion ? 300 : 650;
    const timer = setTimeout(() => {
      this.xpFloatMap.delete(habitId);
      this.xpFloatTimers.delete(habitId);
      this.cdr.markForCheck();
    }, duration);
    this.xpFloatTimers.set(habitId, timer);
    this.cdr.markForCheck();
  }

  private triggerDonePopFx(habitId: string): void {
    this.donePopMap.set(habitId, true);
    const existing = this.donePopTimers.get(habitId);
    if (existing) {
      clearTimeout(existing);
    }
    const duration = this.reduceMotion ? 200 : 650;
    const timer = setTimeout(() => {
      this.donePopMap.delete(habitId);
      this.donePopTimers.delete(habitId);
      this.cdr.markForCheck();
    }, duration);
    this.donePopTimers.set(habitId, timer);
    this.cdr.markForCheck();
  }

  private pickIdentityLine(): string {
    const index = Math.floor(Math.random() * this.identityVariants.length);
    return this.identityVariants[index];
  }

  private updateIdentityLine(): void {
    if (this.isEditingToday && this.selectedIsPerfect) {
      if (!this.identityLine) {
        this.identityLine = this.pickIdentityLine();
      }
      return;
    }
    this.identityLine = '';
  }

  private triggerFinishMoment(summary: { doneCount: number; totalCount: number; handledCount: number }): void {
    if (!this.isSameDate(this.selectedDate, this.todayDate)) {
      return;
    }
    if (summary.handledCount < summary.totalCount) {
      return;
    }
    if (this.finishMomentTimer) {
      clearTimeout(this.finishMomentTimer);
    }
    this.finishMomentMessage =
      summary.doneCount === summary.totalCount ? 'Perfect Day 🔥' : 'Won today 🔥';
    this.finishMomentActive = true;
    this.finishMomentTimer = setTimeout(() => {
      this.finishMomentActive = false;
    }, 700);
  }

  private isStrictPerfect(summary: { doneCount: number; totalCount: number; skippedCount?: number }): boolean {
    return summary.totalCount > 0 && summary.doneCount === summary.totalCount;
  }

  private isWonDay(summary: { handledCount: number; totalCount: number }): boolean {
    return summary.totalCount > 0 && summary.handledCount >= summary.totalCount;
  }

  private loadRewardStageMap(): Record<string, number> {
    if (!isPlatformBrowser(this.platformId)) {
      return {};
    }
    try {
      const raw = window.localStorage?.getItem('habit_rewards') || '';
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private saveRewardStageMap(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    window.localStorage?.setItem('habit_rewards', JSON.stringify(this.rewardStageMap));
  }

  private dateFromKey(dateKey: string): Date | null {
    const parts = dateKey.split('-');
    if (parts.length !== 3) {
      return null;
    }
    const year = Number(parts[0]);
    const monthIndex = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) {
      return null;
    }
    return this.normalizeDate(new Date(year, monthIndex, day));
  }
}

// Manual tests
// Feature 10: Daily Level-Up hook (copy + identity only)
// - Ready card shows only when doneToday=0 and not finished
// - Momentum card shows after first done, hides when day finished
// - Completing a habit shows reward toast instantly
// - Rapid toggles update reward message without stacking
// - Level Up Complete hides cue and shows identity line
// - Progress bar color matches accent and animates smoothly
// - Default theme is blue on fresh install, saved theme overrides
// - Motivation changes by day-of-month
// - Pluralization correct (1 day / 2 days, 1 habit / 2 habits)
// - XP increases when marking a habit done today
// - XP persists after refresh and includes past days done habits
// - Level never drops on date change; only if completions are removed
// - Level-up glow triggers on level increment
// - Streak fire burst triggers on streak increment/perfect day
// - No overlap with bottom nav
// - Won Today shows only when handled full day
// - Perfect Day shows only when all habits done with no skips






















