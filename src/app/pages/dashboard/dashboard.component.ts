import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, Inject, PLATFORM_ID, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { ProgressBarComponent } from '../../shared/progress-bar.component';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subscription, combineLatest, Observable } from 'rxjs';
import { HabitStoreService } from '../../services/habit-store.service';
import { MonthKey, MonthlyTotals, TopHabit, MonthInsights, Habit } from '../../models/habit.model';
import type { ChartDataset } from 'chart.js';
import Chart from 'chart.js/auto';
import { ThemeService } from '../../services/theme.service';
import { staggerFadeUp, noopAnimation } from '../../shared/list-animations';
import { DateUtils } from '../../shared/date-utils';
import { getDailyMotivation } from '../../shared/daily-motivations';
import { getLevelProgress, LevelProgress } from '../../shared/level-utils';
import { DayCountPipe } from '../../shared/day-count.pipe';
import { ActivatedRoute } from '@angular/router';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

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

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatSnackBarModule, MatDialogModule, DayCountPipe, ProgressBarComponent],
  animations: [staggerFadeUp || noopAnimation],
  template: `
    <div class="page-container" [@.disabled]="reduceMotion" [class.reduce-motion]="reduceMotion">
      <ng-container *ngIf="ready$ | async; else loading">
      <section class="today-header" [class.perfect-day]="isPerfectTodaySelected">
        <div>
          <h1 class="text-title">Level-Up</h1>
          <div class="text-muted today-date">
            {{ isEditingToday ? todayLabel : ('Editing: ' + todayLabel) }}
          </div>
          <div class="text-muted today-subtitle">{{ dailyMotivation }}</div>
          <div class="level-badge">{{ levelBadgeText }}</div>
          <div class="level-xp text-muted">{{ levelXpText }}</div>
          <div class="level-next text-muted">{{ levelProgressText }}</div>
          <div class="level-progress">
            <app-progress-bar [value]="levelStats.progressPercent" [height]="4"></app-progress-bar>
          </div>
          
          <div class="perfect-chip" *ngIf="selectedIsPerfect" [class.celebrate]="celebrateBadge">Perfect Level &#x1F525;</div>
          <div class="streak-badge" *ngIf="streakCount > 0" [class.streak-pop]="streakCelebrating">
            <div class="streak-count">&#x1F525; {{ streakCount | dayCount }}</div>
          </div>
          <div class="streak-hint text-muted" *ngIf="streakCount === 0">Start your level streak today</div>
        </div>
        <div class="date-carousel">
          <button class="carousel-arrow" type="button" aria-label="Previous week" (click)="shiftDateWindow(-7)">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <div class="carousel-track" role="listbox" aria-label="Select day">
            <button
              class="day-chip"
              type="button"
              *ngFor="let chip of dateChips"
              [class.perfect-day]="chip.isPerfect"
              [class.is-selected]="isSameDate(chip.date, selectedDate)"
              (click)="setSelectedDate(chip.date)"
              [attr.aria-selected]="isSameDate(chip.date, selectedDate)">
              {{ chip.label }}
            </button>
          </div>
          <button class="carousel-arrow" type="button" aria-label="Next week" (click)="shiftDateWindow(7)">
            <mat-icon>chevron_right</mat-icon>
          </button>
          <button class="jump-today" type="button" *ngIf="!isEditingToday" (click)="goToday()">
            Jump to Today
          </button>
        </div>
      </section>

      <div class="today-cue" *ngIf="isEditingToday">
        <ng-container *ngIf="showReadyBanner; else cueFollowUp">
          <div class="cue-title">Ready to level up today?</div>
          <div class="cue-sub text-muted">Do 1 habit now. Momentum starts small.</div>
        </ng-container>
        <ng-template #cueFollowUp>
          <div class="cue-title" *ngIf="remainingCount > 0">Good. Keep going.</div>
          <div class="cue-title" *ngIf="remainingCount === 0">Day secured 🔥</div>
        </ng-template>
      </div>

      <div class="today-hero" [class.perfect-day]="isPerfectTodaySelected">
        <div class="hero-text">
          <div class="hero-title">Today</div>
          <div class="hero-subtitle">{{ heroStatusLine }}</div>
          <div class="hero-helper text-muted" *ngIf="isEditingToday && selectedIsPerfect">
            Come back tomorrow to keep your level streak.
          </div>
          <div class="finish-message" *ngIf="finishMomentActive">{{ finishMomentMessage }}</div>
        </div>
      </div>
      <div class="hero-progress">
        <app-progress-bar [value]="selectedSummary.percentHandled / 100" [height]="6"></app-progress-bar>
      </div>

      <mat-card class="aesthetic-card today-list-card" [@staggerFadeUp]="animationKey" #todaySection [class.perfect-day]="isPerfectTodaySelected" [class.finish-moment]="finishMomentActive">
        <div class="section-header text-section">Today Habits</div>
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
        <mat-card-content>
          <div class="today-list" [class.perfect-day]="isPerfectTodaySelected">
            <button
              class="today-item"
              type="button"
              *ngFor="let habit of habits; trackBy: trackByHabitCard"
              [class.is-completed]="isTodayChecked(habit.id)"
              [class.is-skipped]="isSelectedDaySkipped(habit.id)"
              [class.is-next]="isNextHabit(habit.id)"
              [class.reward-pulse]="inlineRewardHabitId === habit.id"
              (click)="toggleHabitForSelectedDay(habit)"
              (keydown.enter)="toggleHabitForSelectedDay(habit)"
              (keydown.space)="toggleHabitForSelectedDay(habit); $event.preventDefault()"
              [attr.aria-label]="'Toggle ' + habit.name + ' for today'"
              [attr.id]="'habit-' + habit.id">
              <div class="today-item-info">
                <div class="today-item-name">{{ habit.name }}</div>
                <div class="today-item-sub text-muted">{{ habitProgressMap[habit.id] || 0 }}% this month</div>
                <span class="skipped-chip" *ngIf="isSelectedDaySkipped(habit.id)">Skipped</span>
                <span class="inline-reward" *ngIf="inlineRewardHabitId === habit.id">+1 Level · {{ habit.name }}</span>
              </div>
              <div class="today-item-meta">
                <span class="today-item-percent text-label">{{ habitProgressMap[habit.id] || 0 }}%</span>
                <input
                  type="checkbox"
                  class="today-checkbox"
                  [checked]="isTodayChecked(habit.id)"
                  (click)="$event.stopPropagation()"
                  (change)="toggleHabitForSelectedDay(habit); $event.stopPropagation()"
                  [attr.aria-label]="'Toggle ' + habit.name">
              </div>
            </button>
          </div>
          <div class="finish-day" *ngIf="showTodayActions">
            <button class="btn btn-primary btn-sm" type="button" (click)="finishToday()">Level Up Today</button>
            <div class="text-muted finish-hint">Marks remaining as skipped.</div>
          </div>
          <div class="identity-line text-muted" *ngIf="isEditingToday && selectedIsPerfect">{{ identityLine }}</div>
        </mat-card-content>
      </mat-card>

      <mat-card class="aesthetic-card streak-card">
        <div class="section-header text-section">Level Streak</div>
        <mat-card-content>
          <div class="streak-row">
            <div class="streak-value">{{ currentStreakDisplay | dayCount }}</div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="aesthetic-card insights-card">
        <div class="insights-header">
          <span class="insights-chip text-section">Insights</span>
        <button class="btn btn-outline btn-sm charts-toggle" type="button" (click)="toggleInsights()">
          {{ insightsOpen ? 'Hide Insights' : 'Show Insights' }}
        </button>
      </div>
        <mat-card-content class="insights-body" [class.is-collapsed]="!insightsOpen">
          <div class="dashboard-grid" [@staggerFadeUp]="animationKey">
            <mat-card class="aesthetic-card chart-card">
              <div class="section-header text-section">Daily Completion</div>
              <mat-card-content>
                <canvas #lineCanvas></canvas>
              </mat-card-content>
            </mat-card>

            <mat-card class="aesthetic-card chart-card">
              <div class="section-header text-section">Awakening Progress</div>
              <mat-card-content>
                <canvas #doughnutCanvas></canvas>
                <p class="percent-text">{{ monthlyTotals.percent }}% Complete</p>
              </mat-card-content>
            </mat-card>

            <mat-card class="aesthetic-card chart-card wide">
              <div class="section-header text-section">Top Habits</div>
              <mat-card-content>
                <div class="habits-empty" *ngIf="topHabits.length === 0">
                  No habits yet. Add your first habit.
                </div>
                <ul class="habits-list" *ngIf="topHabits.length > 0">
                  <li *ngFor="let habit of topHabits; trackBy: trackByHabitId">
                    <span>{{ habit.habit.name }}</span>
                    <span class="habit-percent">{{ habit.completionPercent }}%</span>
                  </li>
                </ul>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-card-content>
      </mat-card>

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
  @ViewChild('doughnutCanvas') doughnutCanvas!: ElementRef<HTMLCanvasElement>;
  private lineChart?: Chart;
  private doughnutChart?: Chart;
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
  celebrateBadge = false;
  confettiPieces: ConfettiPiece[] = [];
  private confettiTimer?: ReturnType<typeof setTimeout>;
  inlineRewardHabitId: string | null = null;
  private inlineRewardTimer?: ReturnType<typeof setTimeout>;
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
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private viewReady = false;
  private focusTodayRequested = false;
  private installListener?: (event: Event) => void;
  private resizeListener?: () => void;
  private lastMonthKey: string | null = null;
  private rewardStageMap: Record<string, number> = {};
  ready$!: Observable<boolean>;

  get isPerfectTodaySelected(): boolean {
    return this.isSameDate(this.selectedDate, this.todayDate) && this.todayIsPerfect;
  }

  get dailyMotivation(): string {
    return getDailyMotivation(this.todayDate.getDate());
  }

  get heroStatusLine(): string {
    if (this.selectedSummary.totalCount === 0) {
      return 'Add habits to start.';
    }
    if (this.remainingCount > 0) {
      return `${this.remainingCount} habits left`;
    }
    return 'Level Up Complete 🔥';
  }

  get levelBadgeText(): string {
    return `Level ${this.levelStats.level}`;
  }

  get levelXpText(): string {
    return `XP: ${this.levelStats.totalDone} done`;
  }

  get levelProgressText(): string {
    if (this.levelStats.level === 0 && this.levelStats.totalDone === 0) {
      return 'Complete 1 habit to reach Level 1';
    }

    return `${this.levelStats.progressInLevel}/${this.levelStats.requiredThisLevel} to Level ${this.levelStats.nextLevel}`;
  }

  get handledCountToday(): number {
    return this.todaySummary.handledCount;
  }

  get showReadyBanner(): boolean {
    return this.isEditingToday && this.handledCountToday === 0;
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
    private themeService: ThemeService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.todayDate = this.normalizeDate(new Date());
    this.todayDateKey = this.toIsoDateLocal(this.todayDate);
    this.ready$ = this.habitStore.getReady();
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
        this.habits = habits
          .filter(habit => habit.isActive)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        this.habitsCount = this.habits.length;
        this.updateData();
        this.syncSelectedDateToMonth();
        this.updateTodayLabels();
        this.updateDateChips();
        this.updateHabitProgress();
        this.recomputeDashboardState();
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
      this.createCharts();
      this.updateViewport();
      this.updateFooterVisibility();
      this.resizeListener = () => this.updateViewport();
      window.addEventListener('resize', this.resizeListener);
    }
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
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              max: this.habitsCount
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (context) => `Day ${context.label}: ${context.parsed.y} of ${this.habitsCount}`
              }
            }
          }
        }
      });
    }
    if (this.doughnutCanvas && !this.doughnutChart) {
      this.doughnutChart = new Chart(this.doughnutCanvas.nativeElement, {
        type: 'doughnut',
        data: {
          labels: ['Completed', 'Left'],
          datasets: [{
            data: [this.monthlyTotals.completed, this.monthlyTotals.left],
            backgroundColor: [this.getCssVar('--theme-accent'), this.getCssVar('--theme-accent-soft')]
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    }

    this.updateChartTheme();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    if (isPlatformBrowser(this.platformId)) {
      this.lineChart?.destroy();
      this.doughnutChart?.destroy();
      if (this.resizeListener) {
        window.removeEventListener('resize', this.resizeListener);
      }
      if (this.installListener) {
        window.removeEventListener('beforeinstallprompt', this.installListener);
      }
    }
  }

  private updateData(): void {
    if (this.selectedMonthYear) {
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
        this.updateCharts();
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

  toggleTodayHabit(habitId: string): void {
    const summaryBefore = this.habitStore.getDaySummary(this.selectedDate);
    const wasDone = this.habitStore.isCompleted(habitId, this.selectedDate);
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
    const isDoneNow = this.habitStore.isCompleted(habitId, this.selectedDate);
    if (!wasDone && isDoneNow) {
      this.showHabitReward(habitId);
    }
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

  trackByHabitId(index: number, habit: TopHabit): string {
    return habit.habit.id;
  }

  trackByHabitCard(index: number, habit: Habit): string {
    return habit.id;
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
      this.lineChart.options.scales!['y']!.max = this.habitsCount;
      this.updateChartTheme();
      this.lineChart.update();
    }

    if (this.doughnutChart) {
      this.doughnutChart.data.datasets[0].data = [this.monthlyTotals.completed, this.monthlyTotals.left];
      this.updateChartTheme();
      this.doughnutChart.update();
    }
  }

  private updateChartTheme(): void {
    if (!this.lineChart || !this.doughnutChart) {
      return;
    }
    const accent = this.getCssVar('--theme-accent');
    const glow = this.getCssVar('--theme-accent-soft');
    const muted = this.getCssVar('--theme-chart-text');
    const grid = this.getCssVar('--theme-chart-grid');
    const fontFamily = this.getCssVar('--app-font-family');
    if (fontFamily) {
      Chart.defaults.font.family = fontFamily;
    }

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

    this.doughnutChart.data.datasets[0].backgroundColor = [accent, glow];
    if (this.doughnutChart.options.plugins?.legend) {
      this.doughnutChart.options.plugins.legend.display = !this.isMobile;
      if (this.doughnutChart.options.plugins.legend.labels) {
        this.doughnutChart.options.plugins.legend.labels.color = muted;
      }
    }
    this.doughnutChart.options.font = { family: fontFamily || Chart.defaults.font.family };
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
    this.todayDate = this.normalizeDate(new Date());
    this.todayDateKey = this.toIsoDateLocal(this.todayDate);
    this.selectedSummary = this.habitStore.getDaySummary(this.selectedDate);
    this.todaySummary = this.habitStore.getDaySummary(this.todayDate);
    this.selectedIsPerfect = this.habitStore.isPerfectDay(this.selectedDate);
    this.todayIsPerfect = this.habitStore.isPerfectDay(this.todayDate);

    this.doneCount = this.selectedSummary.doneCount;
    this.totalCount = this.selectedSummary.totalCount;
    this.remainingCount = Math.max(this.selectedSummary.totalCount - this.selectedSummary.handledCount, 0);
    this.todayRemainingCount = Math.max(this.todaySummary.totalCount - this.todaySummary.handledCount, 0);

    const newStreak = this.habitStore.getCurrentStreak(this.todayDateKey);
    if (this.isSameDate(this.selectedDate, this.todayDate) && newStreak > this.previousStreakCount) {
      this.triggerStreakCelebration();
    }
    this.streakCount = newStreak;
    this.previousStreakCount = newStreak;
    this.currentStreakDisplay = this.streakCount;

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
      chips.push({
        date,
        label: date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
        isPerfect: this.habitStore.isPerfectDay(date)
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
    }, 1200);
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
    }, 900);
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
      this.showToast('Perfect level achieved.');
      this.rewardStageMap[dateKey] = 3;
      if (!this.reduceMotion) {
        this.triggerPerfectDayCelebrate();
      }
    }
    this.saveRewardStageMap();
  }

  private showToast(message: string): void {
    this.snackBar.open(message, 'Close', { duration: 1600, panelClass: ['reward-toast'] });
  }

  private showHabitReward(habitId: string): void {
    if (!this.isSameDate(this.selectedDate, this.todayDate)) {
      return;
    }
    if (this.inlineRewardTimer) {
      clearTimeout(this.inlineRewardTimer);
    }
    this.inlineRewardHabitId = habitId;
    this.inlineRewardTimer = setTimeout(() => {
      if (this.inlineRewardHabitId === habitId) {
        this.inlineRewardHabitId = null;
      }
    }, 1000);
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
      summary.doneCount === summary.totalCount ? 'Perfect level 🔥' : 'Day completed';
    this.finishMomentActive = true;
    this.finishMomentTimer = setTimeout(() => {
      this.finishMomentActive = false;
    }, 700);
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
// - Opening Today shows cue only when not secured
// - Ready banner hides after first done/skip and stays hidden on refresh
// - Completing a habit shows reward toast instantly
// - Rapid toggles update reward message without stacking
// - Level Up Complete hides cue and shows identity line
// - Progress bar color matches accent and animates smoothly
// - Default theme is blue on fresh install, saved theme overrides
// - Motivation changes by day-of-month
// - No overlap with bottom nav





















