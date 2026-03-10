import { Component, OnInit, OnDestroy, HostListener, Inject, PLATFORM_ID, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription, combineLatest, Observable } from 'rxjs';
import { HabitStoreService } from '../../services/habit-store.service';
import { Habit, MonthKey, MonthSlot, HabitSkips } from '../../models/habit.model';
import { DateUtils } from '../../shared/date-utils';
import { getDailyMotivation } from '../../shared/daily-motivations';
import { DayCountPipe } from '../../shared/day-count.pipe';
import { ThemeService } from '../../services/theme.service';
import { staggerFadeUp, noopAnimation } from '../../shared/list-animations';
import { Router } from '@angular/router';
import { getLevelProgress, LevelProgress } from '../../shared/level-utils';
import { BackupService } from '../../services/backup.service';
import { WeeklyReportShareService } from '../../services/weekly-report-share.service';
import { WeeklyReportService } from '../../services/weekly-report.service';
import { GamificationService } from '../../services/gamification.service';

type CalendarCell = {
  dayNumber: number | null;
  dateKey: string | null;
  date: Date | null;
  done: number;
  goal: number;
  percent: number;
  isPerfect: boolean;
  isSelected: boolean;
  isToday: boolean;
  intensityClass: string;
};

type WeekSummary = {
  weekIndex: number;
  done: number;
  goal: number;
  percent: number;
  perfectDays: number;
  dateKeys: string[];
  startDate: Date | null;
  endDate: Date | null;
  rangeLabel: string;
};

type SelectedDateHabits = {
  dateKey: string;
  date: Date | null;
  completed: Habit[];
  incomplete: Habit[];
};

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatSnackBarModule, DayCountPipe],
  animations: [staggerFadeUp || noopAnimation],
    template: `
    <div class="page-container" [@.disabled]="reduceMotion" [class.reduce-motion]="reduceMotion">
      <h1 class="text-title page-title">Overview</h1>
      <ng-container *ngIf="ready$ | async; else loading">
        <ng-container *ngIf="hasAnyData; else emptyState">
          <mat-card class="aesthetic-card overview-hero arcane-card" [@staggerFadeUp]="animationKey">
            <div class="hero-grid">
              <div class="hero-block arcane-card--tight">
                <div class="hero-label">Streak</div>
                <div class="hero-value">{{ currentStreak | dayCount }}</div>
              </div>
              <div class="hero-block arcane-card--tight">
                <div class="hero-label">Level</div>
                <div class="hero-value"><span class="glass-pill">Lv {{ levelStats.level }}</span></div>
                <div class="text-muted">Total XP: {{ levelStats.totalXp }}</div>
                <div class="text-muted">Next: Level {{ levelStats.nextLevel }} in {{ levelStats.remainingToNext }} XP</div>
              </div>
              <div class="hero-block arcane-card--tight">
                <div class="hero-label">Perfect Days</div>
                <div class="hero-value">Perfect days: {{ weekAttendanceCount }} / {{ weekTotalDays }}</div>
              </div>
              <div class="hero-block hero-action arcane-card--tight">
                <div class="hero-label">Next best action</div>
                <div class="hero-value">{{ nextBestActionText }}</div>
                <button class="btn btn-primary btn-sm glass-btn glass-btn--primary" type="button" (click)="goToTodayAction()" [disabled]="todayRemainingCount === 0">
                  Go to Today
                </button>
              </div>
            </div>
            <button class="btn btn-outline btn-sm details-button glass-btn glass-btn--ghost" type="button" (click)="toggleInsights()">
              {{ insightsOpen ? 'Hide Details' : 'Show Details' }}
            </button>
          </mat-card>

          <div class="details-section" [class.is-collapsed]="!insightsOpen">
            <mat-card class="aesthetic-card calendar-card arcane-card" [@staggerFadeUp]="animationKey">
              <div class="card-header text-section">Monthly Calendar</div>
              <mat-card-content class="card-body">
                <div class="calendar-grid">
                  <div class="calendar-weekday" *ngFor="let label of weekDayLabels">{{ label }}</div>
                  <ng-container *ngFor="let cell of calendarCells; trackBy: trackByCalendarCell">
                    <button
                      *ngIf="cell.dayNumber"
                      type="button"
                      class="calendar-cell glass-btn glass-btn--ghost {{ cell.intensityClass }}"
                      [class.is-selected]="cell.isSelected"
                      [class.is-perfect]="cell.isPerfect"
                      [class.perfect-day]="cell.isPerfect"
                      (click)="selectDay(cell)"
                      [attr.aria-label]="'Select ' + cell.dayNumber">
                      <span class="cell-date">
                        {{ cell.dayNumber }}
                        <span class="today-dot" *ngIf="cell.isToday"></span>
                      </span>
                      <span class="cell-metric">{{ cell.done }}/{{ cell.goal }}</span>
                    </button>
                    <div *ngIf="!cell.dayNumber" class="calendar-cell is-empty"></div>
                  </ng-container>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="aesthetic-card summary-card arcane-card selected-date-card" [@staggerFadeUp]="animationKey">
              <ng-container *ngIf="selectedDateHabits$ | async as selectedDateHabits">
                <div class="card-header text-section">
                  Habits on {{ selectedDateHabits.date ? (selectedDateHabits.date | date:'MMM d, y') : selectedDateHabits.dateKey }}
                </div>
                <mat-card-content class="card-body">
                  <div class="selected-date-columns">
                    <section class="selected-date-group">
                      <h3 class="selected-date-title">&#x2705; Completed ({{ selectedDateHabits.completed.length }})</h3>
                      <p class="text-muted selected-date-empty" *ngIf="selectedDateHabits.completed.length === 0">No completed habits.</p>
                      <ul class="selected-date-list" *ngIf="selectedDateHabits.completed.length > 0">
                        <li *ngFor="let habit of selectedDateHabits.completed; trackBy: trackByHabitId">{{ habit.name }}</li>
                      </ul>
                    </section>
                    <section class="selected-date-group">
                      <h3 class="selected-date-title">&#x274C; Not completed ({{ selectedDateHabits.incomplete.length }})</h3>
                      <p class="text-muted selected-date-empty" *ngIf="selectedDateHabits.incomplete.length === 0">Nothing left incomplete.</p>
                      <ul class="selected-date-list" *ngIf="selectedDateHabits.incomplete.length > 0">
                        <li *ngFor="let habit of selectedDateHabits.incomplete; trackBy: trackByHabitId">{{ habit.name }}</li>
                      </ul>
                    </section>
                  </div>
                </mat-card-content>
              </ng-container>
            </mat-card>

            <mat-card class="aesthetic-card summary-card arcane-card" [@staggerFadeUp]="animationKey">
              <div class="card-header text-section weekly-header-row">
                <div class="weekly-header-copy">
                  <span>Weekly Summary</span>
                  <small class="text-muted" *ngIf="selectedWeekRangeLabel">{{ selectedWeekRangeLabel }}</small>
                </div>
                <button
                  class="btn btn-outline btn-sm glass-btn glass-btn--ghost weekly-share-btn"
                  type="button"
                  (click)="shareWeeklyReport()"
                  [disabled]="!canShareWeeklyReport || weeklyReportBusy">
                  <span>{{ weeklyReportBusy ? 'Preparing...' : 'Share weekly report' }}</span>
                  <small>PNG image</small>
                </button>
              </div>
              <mat-card-content class="card-body">
                <div class="week-selector" *ngIf="weeklySummaries.length > 0">
                  <button
                    type="button"
                    class="week-selector-btn glass-btn glass-btn--ghost"
                    *ngFor="let week of weeklySummaries; trackBy: trackByWeek"
                    [class.is-selected]="week.weekIndex === selectedWeekIndex"
                    (click)="selectWeekByIndex(week.weekIndex)">
                    W{{ week.weekIndex + 1 }}
                  </button>
                </div>
                <div class="weekly-row weekly-header">
                  <span>Week</span>
                  <span>Done/Goal</span>
                  <span>Progress</span>
                  <span>%</span>
                  <span>Perfect level</span>
                </div>
                <button class="weekly-row weekly-row-button" type="button" *ngFor="let week of weeklySummaries; trackBy: trackByWeek" (click)="selectWeekByIndex(week.weekIndex)" [class.is-selected]="week.weekIndex === selectedWeekIndex">
                  <span class="week-label">W{{ week.weekIndex + 1 }}</span>
                  <span class="week-metric">{{ week.done }}/{{ week.goal }}</span>
                  <div class="week-bar arcane-progress">
                    <div class="week-bar-fill arcane-progress__bar" [style.width.%]="week.percent"></div>
                  </div>
                  <span class="week-percent">{{ week.percent }}%</span>
                  <span class="week-perfect">&#x1F525;{{ week.perfectDays }}</span>
                </button>
              </mat-card-content>
            </mat-card>
          </div>
        </ng-container>
        <ng-template #emptyState>
          <mat-card class="aesthetic-card empty-state arcane-card" [@staggerFadeUp]="animationKey">
            <mat-card-content>
              <div class="empty-title">Start with 1 habit today</div>
              <div class="text-muted">Small steps build your streak.</div>
              <button class="btn btn-primary btn-sm glass-btn glass-btn--primary" type="button" (click)="goToTodayAction()">
                Go to Today
              </button>
            </mat-card-content>
          </mat-card>
        </ng-template>
      </ng-container>
      <ng-template #loading>
        <mat-card class="aesthetic-card">
          <mat-card-content>Loading overview...</mat-card-content>
        </mat-card>
      </ng-template>
      <div class="weekly-report-export-host" *ngIf="weeklySharePayload" aria-hidden="true">
        <section id="weeklyReportExportRoot" #weeklyReportExportRoot class="weekly-report-export-root weekly-report-export-mode">
          <div class="weekly-report-capture-card">
            <div class="weekly-report-capture-header">
              <div class="weekly-report-capture-user">{{ weeklySharePayload.headerName || 'Player' }}</div>
              <div class="weekly-report-capture-meta" *ngIf="weeklySharePayload.headerMeta">{{ weeklySharePayload.headerMeta }}</div>
            </div>

            <div class="weekly-report-capture-title">WEEKLY REPORT</div>
            <div class="weekly-report-capture-range">{{ weeklySharePayload.weekRangeLabel }}</div>

            <div class="weekly-report-capture-stats">
              <div class="weekly-report-capture-stat">
                <div class="weekly-report-capture-stat-label">Completed</div>
                <div class="weekly-report-capture-stat-value">{{ weeklySharePayload.stats.completed }}/{{ weeklySharePayload.stats.goal }}</div>
                <div class="weekly-report-capture-stat-sub">
                  {{ weeklySharePayload.stats.goal > 0 ? ((weeklySharePayload.stats.completed / weeklySharePayload.stats.goal) * 100 | number:'1.0-0') : 0 }}% • Week XP {{ weeklySharePayload.stats.weekXp }}
                </div>
              </div>
              <div class="weekly-report-capture-stat">
                <div class="weekly-report-capture-stat-label">Perfect days</div>
                <div class="weekly-report-capture-stat-value">{{ weeklySharePayload.stats.perfectDays }}</div>
              </div>
              <div class="weekly-report-capture-stat">
                <div class="weekly-report-capture-stat-label">Weekly streak</div>
                <div class="weekly-report-capture-stat-value">{{ weeklySharePayload.stats.goal > 0 ? (weeklySharePayload.stats.weeklyPerfectStreak + ' days') : '--' }}</div>
              </div>
              <div class="weekly-report-capture-stat">
                <div class="weekly-report-capture-stat-label">Best streak</div>
                <div class="weekly-report-capture-stat-value">{{ weeklySharePayload.stats.bestStreak }}</div>
              </div>
            </div>

            <div class="weekly-report-capture-section">Habits</div>
            <div class="weekly-report-capture-empty" *ngIf="weeklySharePayload.habits.length === 0">No habits active this week</div>
            <div class="weekly-report-capture-habits" *ngIf="weeklySharePayload.habits.length > 0">
              <div class="weekly-report-capture-habit" *ngFor="let habit of weeklySharePayload.habits; let i = index">
                <div class="weekly-report-capture-habit-head">
                  <div class="weekly-report-capture-habit-name">{{ i + 1 }}. {{ habit.name }}</div>
                  <div class="weekly-report-capture-habit-metric">{{ habit.doneCount }}/{{ habit.daysActive }}</div>
                </div>
                <div class="weekly-report-capture-habit-bar">
                  <div class="weekly-report-capture-habit-fill" [style.width.%]="habit.daysActive > 0 ? ((habit.doneCount / habit.daysActive) * 100) : 0"></div>
                </div>
              </div>
            </div>

            <div class="weekly-report-capture-level" *ngIf="weeklySharePayload.levelLine">
              <div class="weekly-report-capture-stat-label">Level</div>
              <div class="weekly-report-capture-level-line">{{ weeklySharePayload.levelLine }}</div>
              <div class="weekly-report-capture-level-sub" *ngIf="weeklySharePayload.levelSubline">{{ weeklySharePayload.levelSubline }}</div>
            </div>

            <div class="weekly-report-capture-footer">{{ weeklySharePayload.footerSummary || 'LEVEL UP • One week stronger' }}</div>
          </div>
        </section>
      </div>
    </div>
  `,

  styleUrls: ['./overview.component.sass']
})
export class OverviewComponent implements OnInit, OnDestroy {
  @ViewChild('weeklyReportExportRoot') weeklyReportExportRoot?: ElementRef<HTMLElement>;
  monthMatrix: MonthSlot[][] = [];
  selectedMonthYear: MonthKey | null = null;
  animationKey = 0;
  reduceMotion = false;
  private lastMonthKey: string | null = null;
  weekDayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  calendarCells: CalendarCell[] = [];
  weeklySummaries: WeekSummary[] = [];
  selectedDateKey = '';
  completionPercent = 0;
  perfectDaysCount = 0;
  currentStreak = 0;
  bestWeekLabel = '--';
  weekAttendanceCount = 0;
  weekTotalDays = 7;
  todayRemainingCount = 0;
  nextBestActionText = '';
  hasAnyData = false;
  activeHabitsCount = 0;
  levelStats: LevelProgress = getLevelProgress(0);
  insightsOpen = true;
  isMobile = false;
  private hasSetInsightsDefault = false;
  private todayKey = '';
  private gridRows = 6;
  canShareWeeklyReport = false;
  weeklyReportBusy = false;
  weeklySharePayload: Parameters<BackupService['exportWeeklyReportPng']>[0] | null = null;
  selectedWeekIndex = 0;
  selectedWeekRangeLabel = '';
  private latestHabits: Habit[] = [];
  private latestCompletions: Record<string, Record<string, boolean>> = {};
  ready$!: Observable<boolean>;
  selectedDateHabits$!: Observable<SelectedDateHabits>;

  private subscription: Subscription = new Subscription();

  constructor(
    private habitStore: HabitStoreService,
    private themeService: ThemeService,
    private router: Router,
    private backupService: BackupService,
    private weeklyReportShareService: WeeklyReportShareService,
    private weeklyReportService: WeeklyReportService,
    private gamification: GamificationService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    this.todayKey = this.habitStore.toDateKey(new Date());
    this.canShareWeeklyReport = isPlatformBrowser(this.platformId);
    this.ready$ = this.habitStore.getReady();
    this.selectedDateHabits$ = this.habitStore.getSelectedDateHabitBreakdown();
    this.setViewportFlags();
    this.subscription.add(
      combineLatest([
        this.habitStore.getSelectedMonthYear(),
        this.habitStore.getHabits(),
        this.habitStore.getCompletions(),
        this.habitStore.getSkips(),
        this.habitStore.getSelectedDateKey(),
        this.habitStore.getLevelStats()
      ]).subscribe(([monthYear, habits, completions, skips, selectedDateKey, levelStats]) => {
        this.selectedMonthYear = monthYear;
        this.selectedDateKey = selectedDateKey;
        this.levelStats = levelStats;
        this.latestHabits = habits;
        this.latestCompletions = completions;
        this.updateData(habits, completions, skips);
      })
    );
    this.subscription.add(
      this.themeService.getReducedMotion().subscribe(reduce => {
        this.reduceMotion = reduce;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
  @HostListener('window:resize')
  onResize(): void {
    this.setViewportFlags();
  }

  private updateData(
    habits: Array<{ id: string; isActive: boolean }>,
    completions: Record<string, Record<string, boolean>>,
    skips: HabitSkips
  ): void {
    const today = this.normalizeDate(new Date());
    const todayKey = this.habitStore.toDateKey(today);
    this.activeHabitsCount = habits.filter(habit => habit.isActive).length;
    if (this.selectedMonthYear) {
      this.monthMatrix = DateUtils.getMonthMatrix(this.selectedMonthYear.year, this.selectedMonthYear.month);
      this.gridRows = this.getGridRows(this.selectedMonthYear.year, this.selectedMonthYear.month);
      this.buildCalendar(completions);
      const streakDateKey = this.selectedDateKey || this.todayKey;
      this.currentStreak = this.habitStore.getStreakCount(streakDateKey);
      const monthKey = `${this.selectedMonthYear.year}-${this.selectedMonthYear.month}`;
      if (this.lastMonthKey !== monthKey) {
        this.animationKey++;
        this.lastMonthKey = monthKey;
      }
    }
    const weeklyWins = this.habitStore.getWeeklyWins(this.selectedDateKey || todayKey);
    this.weekAttendanceCount = weeklyWins.wins;
    this.weekTotalDays = weeklyWins.total;
    this.todayRemainingCount = this.habitStore.getRemainingCount(today);
    this.nextBestActionText = this.todayRemainingCount > 0
      ? getDailyMotivation(today.getDate())
      : 'Level up complete 🧘🏼';
    this.hasAnyData = this.activeHabitsCount > 0 && (this.completionPercent > 0 || this.perfectDaysCount > 0 || this.weekAttendanceCount > 0);
  }

  private buildCalendar(completions: Record<string, Record<string, boolean>>): void {
    if (!this.selectedMonthYear) {
      return;
    }
    const { year, month } = this.selectedMonthYear;
    const dayStats = new Map<number, { done: number; percent: number; isPerfect: boolean }>();
    let monthDone = 0;
    let monthGoal = 0;
    let perfectDays = 0;

    for (let day = 1; day <= DateUtils.daysInMonth(year, month); day++) {
      const date = new Date(year, month, day);
      const dateKey = this.habitStore.toDateKey(date);
      const activeHabits = this.habitStore.getHabitsActiveOn(dateKey);
      const goalPerDay = activeHabits.length;
      const dayMap = completions[dateKey] || {};
      const done = activeHabits.reduce((sum, habit) => sum + (dayMap[habit.id] ? 1 : 0), 0);
      const percent = goalPerDay > 0 ? Math.round((done / goalPerDay) * 100) : 0;
      const isPerfect = goalPerDay > 0 && done === goalPerDay;
      dayStats.set(day, { done, percent, isPerfect });
      monthDone += done;
      monthGoal += goalPerDay;
      if (isPerfect) {
        perfectDays++;
      }
    }
    this.completionPercent = monthGoal > 0 ? Math.round((monthDone / monthGoal) * 100) : 0;
    this.perfectDaysCount = perfectDays;

    this.calendarCells = this.monthMatrix.flat().map(slot => {
      if (!slot.dayNumber) {
        return {
          dayNumber: null,
          dateKey: null,
          date: null,
          done: 0,
          goal: 0,
          percent: 0,
          isPerfect: false,
          isSelected: false,
          isToday: false,
          intensityClass: 'is-empty'
        };
      }
      const stats = dayStats.get(slot.dayNumber) || { done: 0, percent: 0, isPerfect: false };
      const date = new Date(year, month, slot.dayNumber);
      const dateKey = this.habitStore.toDateKey(date);
      const goalPerDay = this.habitStore.getHabitsActiveOn(dateKey).length;
      return {
        dayNumber: slot.dayNumber,
        dateKey,
        date,
        done: stats.done,
        goal: goalPerDay,
        percent: stats.percent,
        isPerfect: stats.isPerfect,
        isSelected: dateKey === this.selectedDateKey,
        isToday: dateKey === this.todayKey,
        intensityClass: this.getIntensityClass(stats.percent, stats.isPerfect)
      };
    });

    const allSummaries = this.monthMatrix.map((week, weekIndex) => {
      let done = 0;
      let goal = 0;
      let perfectDays = 0;
      const dateKeys: string[] = [];
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      week.forEach(slot => {
        if (!slot.dayNumber) {
          return;
        }
        const stats = dayStats.get(slot.dayNumber);
        if (!stats) {
          return;
        }
        const date = this.normalizeDate(new Date(year, month, slot.dayNumber));
        const dateKey = this.habitStore.toDateKey(date);
        dateKeys.push(dateKey);
        if (!startDate || date < startDate) {
          startDate = date;
        }
        if (!endDate || date > endDate) {
          endDate = date;
        }
        const goalPerDay = this.habitStore.getHabitsActiveOn(dateKey).length;
        done += stats.done;
        goal += goalPerDay;
        if (stats.isPerfect) {
          perfectDays++;
        }
      });
      const percent = goal > 0 ? Math.round((done / goal) * 100) : 0;
      return {
        weekIndex,
        done,
        goal,
        percent,
        perfectDays,
        dateKeys,
        startDate,
        endDate,
        rangeLabel: startDate && endDate ? this.formatWeekRange(startDate, endDate) : '--'
      };
    });
    this.weeklySummaries = allSummaries.slice(0, this.gridRows);
    this.syncSelectedWeek();

    const bestWeek = this.weeklySummaries
      .filter(week => week.goal > 0)
      .sort((a, b) => b.percent - a.percent)[0];
    this.bestWeekLabel = bestWeek ? `W${bestWeek.weekIndex + 1}` : '--';
  }

  selectDay(cell: CalendarCell): void {
    if (!cell.date || !this.selectedMonthYear) {
      return;
    }
    this.habitStore.setSelectedDate(cell.date);
    this.habitStore.setSelectedMonthYear(this.selectedMonthYear.year, this.selectedMonthYear.month);
    }

  trackByWeek(index: number, week: WeekSummary): number {
    return week.weekIndex;
  }

  selectWeekByIndex(index: number): void {
    this.selectedWeekIndex = index;
    this.syncSelectedWeekLabel();
  }

  toggleInsights(): void {
    this.insightsOpen = !this.insightsOpen;
  }

  goToTodayAction(): void {
    this.router.navigate(['/today'], { queryParams: { focus: 'todayList' } });
  }

  async shareWeeklyReport(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || this.weeklyReportBusy) {
      return;
    }
    this.weeklyReportBusy = true;
    try {
      this.weeklySharePayload = this.buildWeeklyReportPayload();
      this.cdr.detectChanges();
      await this.weeklyReportShareService.waitForStableLayout();
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      await new Promise<void>(resolve => setTimeout(() => resolve(), 50));

      const element = this.weeklyReportExportRoot?.nativeElement;
      if (!element) {
        throw new Error('Weekly report export element not found');
      }
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        throw new Error('Weekly report export element is not measurable');
      }
      element.scrollTop = 0;

      const safeKey = (this.weeklySharePayload.weekStartKey || 'weekly').replace(/[^0-9-]/g, '');
      const fileName = `weekly_report_${safeKey}_${Date.now()}.png`;
      const dataUrl = await this.weeklyReportShareService.withTimeout(
        this.weeklyReportShareService.captureElementToPngDataUrl(element, {
          width: 900,
          height: 1600,
          pixelRatio: 2,
          backgroundColor: '#05070f'
        }),
        8000
      );
      await this.weeklyReportShareService.sharePngDataUrl(dataUrl, fileName);
      this.snackBar.open('Weekly report shared', undefined, { duration: 1800 });
    } catch (error) {
      console.error('[WeeklyReportShare] export failed:', error);
      this.snackBar.open('Weekly report export failed', undefined, { duration: 2400 });
    } finally {
      this.weeklyReportBusy = false;
      this.weeklySharePayload = null;
      this.cdr.detectChanges();
    }
  }

  trackByCalendarCell(index: number, cell: CalendarCell): string {
    return cell.dateKey ?? `empty-${index}`;
  }

  trackByHabitId(index: number, habit: Habit): string {
    return habit.id;
  }

  private getIntensityClass(percent: number, isPerfect: boolean): string {
    if (isPerfect) {
      return 'is-perfect';
    }
    if (percent === 0) {
      return 'is-zero';
    }
    if (percent < 50) {
      return 'is-low';
    }
    if (percent < 100) {
      return 'is-mid';
    }
    return 'is-high';
  }

  private getGridRows(year: number, monthIndex: number): number {
    const firstDay = new Date(year, monthIndex, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const totalCells = startOffset + daysInMonth;
    return Math.ceil(totalCells / 7);
  }

  private setViewportFlags(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.isMobile = window.innerWidth < 768;
    if (!this.hasSetInsightsDefault) {
      this.insightsOpen = !this.isMobile;
      this.hasSetInsightsDefault = true;
      return;
    }
    if (!this.isMobile) {
      this.insightsOpen = true;
    }
  }

  private normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private buildWeeklyReportPayload(): Parameters<BackupService['exportWeeklyReportPng']>[0] {
    const selectedWeek = this.getSelectedWeekSummary();
    if (selectedWeek && selectedWeek.dateKeys.length > 0) {
      return this.buildWeeklyPayloadFromDateKeys(selectedWeek.dateKeys, selectedWeek.rangeLabel);
    }

    const baseDate = this.parseDateKey(this.selectedDateKey || this.todayKey) ?? this.normalizeDate(new Date());
    const weekDates = this.getWeekDatesMondayToSunday(baseDate);
    const fallbackKeys = weekDates.map(date => this.habitStore.toDateKey(date));
    return this.buildWeeklyPayloadFromDateKeys(fallbackKeys, this.formatWeekRange(weekDates[0], weekDates[6]));
  }
  private syncSelectedWeek(): void {
    if (this.weeklySummaries.length === 0) {
      this.selectedWeekIndex = 0;
      this.selectedWeekRangeLabel = '';
      return;
    }
    const activeDateKey = this.selectedDateKey || this.todayKey;
    const match = this.weeklySummaries.find(week => week.dateKeys.includes(activeDateKey));
    if (match) {
      this.selectedWeekIndex = match.weekIndex;
    } else if (!this.weeklySummaries.some(week => week.weekIndex === this.selectedWeekIndex)) {
      this.selectedWeekIndex = this.weeklySummaries[0].weekIndex;
    }
    this.syncSelectedWeekLabel();
  }

  private syncSelectedWeekLabel(): void {
    const selectedWeek = this.getSelectedWeekSummary();
    this.selectedWeekRangeLabel = selectedWeek?.rangeLabel ?? '';
  }

  private getSelectedWeekSummary(): WeekSummary | null {
    return this.weeklySummaries.find(week => week.weekIndex === this.selectedWeekIndex) ?? this.weeklySummaries[0] ?? null;
  }

  private buildWeeklyPayloadFromDateKeys(dateKeys: string[], rangeLabel: string): Parameters<BackupService['exportWeeklyReportPng']>[0] {
    const sortedKeys = [...dateKeys].sort();
    const weekStartKey = sortedKeys[0] || this.todayKey;
    const weekEndKey = sortedKeys[sortedKeys.length - 1] || this.todayKey;

    const computed = this.weeklyReportService.computeWeekStats(
      sortedKeys,
      this.latestCompletions,
      dateKey => this.habitStore.getHabitsActiveOn(dateKey)
    );

    const completed = computed.completed;
    const goal = computed.goal;
    const weekXp = computed.weekXP ?? 0;
    const perfectDays = computed.perfectDays;
    const weeklyPerfectStreak = computed.weeklyPerfectStreak;
    const habits: Array<{ name: string; doneCount: number; daysActive: number }> = computed.perHabit
      .map(habit => ({
        name: habit.name,
        doneCount: habit.doneCount,
        daysActive: habit.daysActive
      }))
      .sort((a, b) => (b.doneCount - a.doneCount) || (b.daysActive - a.daysActive) || a.name.localeCompare(b.name));

    const bestStreak = this.computeBestPerfectStreak();
    const levelLine = `Level ${this.levelStats.level} - XP ${this.levelStats.totalXp}`;
    const levelSubline = this.levelStats.remainingToNext > 0
      ? `Next level in ${this.levelStats.remainingToNext} XP`
      : 'Next level unlocked';
    const footerSummary = goal === 0
      ? 'No habits active this week'
      : perfectDays >= 5
        ? 'Strong consistency this week.'
        : perfectDays >= 3
          ? 'Good momentum. Keep pushing.'
          : 'A slow week - reset and rise.';

    return {
      weekStartKey,
      weekEndKey,
      weekRangeLabel: rangeLabel,
      dateKeys: sortedKeys,
      headerName: this.habitStore.getCurrentUsername(),
      headerMeta: `Level ${this.levelStats.level} - XP ${this.levelStats.totalXp}`,
      stats: {
        completed,
        goal,
        weekXp,
        perfectDays,
        weeklyPerfectStreak,
        bestStreak
      },
      habits,
      levelLine,
      levelSubline,
      footerSummary
    };
  }

  private computeBestPerfectStreak(): number {
    const keys = new Set<string>(Object.keys(this.latestCompletions || {}));
    keys.add(this.todayKey);
    const sorted = Array.from(keys).sort();
    let current = 0;
    let best = 0;
    for (const dateKey of sorted) {
      const activeHabits = this.habitStore.getHabitsActiveOn(dateKey);
      const goal = activeHabits.length;
      const dayMap = this.latestCompletions[dateKey] || {};
      const done = activeHabits.reduce((sum, habit) => sum + (dayMap[habit.id] ? 1 : 0), 0);
      const isPerfect = goal > 0 && done === goal;
      if (isPerfect) {
        current += 1;
        best = Math.max(best, current);
      } else {
        current = 0;
      }
    }
    return best;
  }
  private getWeekDatesMondayToSunday(date: Date): Date[] {
    const normalized = this.normalizeDate(date);
    const day = normalized.getDay(); // Sun=0
    const offsetToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(normalized);
    monday.setDate(normalized.getDate() + offsetToMonday);
    return Array.from({ length: 7 }, (_, index) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + index);
      return this.normalizeDate(d);
    });
  }

  private formatWeekRange(start: Date, end: Date): string {
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    const startDay = start.getDate();
    const endDay = end.getDate();
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  }

  private parseDateKey(dateKey: string): Date | null {
    if (!dateKey) {
      return null;
    }
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





