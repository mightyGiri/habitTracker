import { Component, OnInit, OnDestroy, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { Subscription, combineLatest, Observable } from 'rxjs';
import { HabitStoreService } from '../../services/habit-store.service';
import { MonthKey, MonthSlot, HabitSkips } from '../../models/habit.model';
import { DateUtils } from '../../shared/date-utils';
import { getDailyMotivation } from '../../shared/daily-motivations';
import { DayCountPipe } from '../../shared/day-count.pipe';
import { ThemeService } from '../../services/theme.service';
import { staggerFadeUp, noopAnimation } from '../../shared/list-animations';
import { Router } from '@angular/router';
import { getLevelProgress, LevelProgress } from '../../shared/level-utils';

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
};

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, MatCardModule, DayCountPipe],
  animations: [staggerFadeUp || noopAnimation],
    template: `
    <div class="page-container" [@.disabled]="reduceMotion" [class.reduce-motion]="reduceMotion">
      <h1 class="text-title page-title">Overview</h1>
      <ng-container *ngIf="ready$ | async; else loading">
        <ng-container *ngIf="hasAnyData; else emptyState">
          <mat-card class="aesthetic-card overview-hero" [@staggerFadeUp]="animationKey">
            <div class="hero-grid">
              <div class="hero-block">
                <div class="hero-label">Level streak</div>
                <div class="hero-value">{{ currentStreak | dayCount }}</div>
              </div>
              <div class="hero-block">
                <div class="hero-label">Level</div>
                <div class="hero-value">Level {{ levelStats.level }}</div>
                <div class="text-muted">Total wins: {{ levelStats.totalDone }}</div>
                <div class="text-muted">Next: Level {{ levelStats.nextLevel }} in {{ levelStats.remainingToNext }} wins</div>
              </div>
              <div class="hero-block">
                <div class="hero-label">Wins</div>
                <div class="hero-value">You leveled up {{ weekAttendanceCount }} of {{ weekTotalDays | dayCount }}</div>
              </div>
              <div class="hero-block hero-action">
                <div class="hero-label">Next best action</div>
                <div class="hero-value">{{ nextBestActionText }}</div>
                <button class="btn btn-primary btn-sm" type="button" (click)="goToTodayAction()" [disabled]="todayRemainingCount === 0">
                  Go to Today
                </button>
              </div>
            </div>
            <button class="btn btn-outline btn-sm details-button" type="button" (click)="toggleInsights()">
              {{ insightsOpen ? 'Hide Details' : 'Show Details' }}
            </button>
          </mat-card>

          <div class="details-section" [class.is-collapsed]="!insightsOpen">
            <mat-card class="aesthetic-card calendar-card" [@staggerFadeUp]="animationKey">
              <div class="card-header text-section">Monthly Calendar</div>
              <mat-card-content class="card-body">
                <div class="calendar-grid">
                  <div class="calendar-weekday" *ngFor="let label of weekDayLabels">{{ label }}</div>
                  <ng-container *ngFor="let cell of calendarCells; trackBy: trackByCalendarCell">
                    <button
                      *ngIf="cell.dayNumber"
                      type="button"
                      class="calendar-cell {{ cell.intensityClass }}"
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

            <mat-card class="aesthetic-card summary-card" [@staggerFadeUp]="animationKey">
              <div class="card-header text-section">Weekly Summary</div>
              <mat-card-content class="card-body">
                <div class="weekly-row weekly-header">
                  <span>Week</span>
                  <span>Done/Goal</span>
                  <span>Progress</span>
                  <span>%</span>
                  <span>Perfect level</span>
                </div>
                <div class="weekly-row" *ngFor="let week of weeklySummaries; trackBy: trackByWeek">
                  <span class="week-label">W{{ week.weekIndex + 1 }}</span>
                  <span class="week-metric">{{ week.done }}/{{ week.goal }}</span>
                  <div class="week-bar">
                    <div class="week-bar-fill" [style.width.%]="week.percent"></div>
                  </div>
                  <span class="week-percent">{{ week.percent }}%</span>
                  <span class="week-perfect">&#x1F525;{{ week.perfectDays }}</span>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </ng-container>
        <ng-template #emptyState>
          <mat-card class="aesthetic-card empty-state" [@staggerFadeUp]="animationKey">
            <mat-card-content>
              <div class="empty-title">Start with 1 habit today</div>
              <div class="text-muted">Small steps build your level streak.</div>
              <button class="btn btn-primary btn-sm" type="button" (click)="goToTodayAction()">
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
    </div>
  `,

  styleUrls: ['./overview.component.sass']
})
export class OverviewComponent implements OnInit, OnDestroy {
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
  ready$!: Observable<boolean>;

  private subscription: Subscription = new Subscription();

  constructor(
    private habitStore: HabitStoreService,
    private themeService: ThemeService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    this.todayKey = this.habitStore.toDateKey(new Date());
    this.ready$ = this.habitStore.getReady();
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
      this.buildCalendar(habits, completions);
      this.currentStreak = this.habitStore.getCurrentStreak(this.todayKey);
      const monthKey = `${this.selectedMonthYear.year}-${this.selectedMonthYear.month}`;
      if (this.lastMonthKey !== monthKey) {
        this.animationKey++;
        this.lastMonthKey = monthKey;
      }
    }
    this.weekAttendanceCount = this.getWeekAttendance(habits, completions, skips, today);
    this.todayRemainingCount = this.habitStore.getRemainingCount(today);
    this.nextBestActionText = this.todayRemainingCount > 0
      ? getDailyMotivation(today.getDate())
      : 'Level up complete 🔥';
    this.hasAnyData = this.activeHabitsCount > 0 && (this.completionPercent > 0 || this.perfectDaysCount > 0 || this.weekAttendanceCount > 0);
  }

  private buildCalendar(habits: Array<{ id: string; isActive: boolean }>, completions: Record<string, Record<string, boolean>>): void {
    if (!this.selectedMonthYear) {
      return;
    }
    const { year, month } = this.selectedMonthYear;
    const activeHabits = habits.filter(habit => habit.isActive);
    const goalPerDay = activeHabits.length;
    const dayStats = new Map<number, { done: number; percent: number; isPerfect: boolean }>();
    let monthDone = 0;
    let monthGoal = 0;
    let perfectDays = 0;

    for (let day = 1; day <= DateUtils.daysInMonth(year, month); day++) {
      const date = new Date(year, month, day);
      const dateKey = this.habitStore.toDateKey(date);
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
      week.forEach(slot => {
        if (!slot.dayNumber) {
          return;
        }
        const stats = dayStats.get(slot.dayNumber);
        if (!stats) {
          return;
        }
        done += stats.done;
        goal += goalPerDay;
        if (stats.isPerfect) {
          perfectDays++;
        }
      });
      const percent = goal > 0 ? Math.round((done / goal) * 100) : 0;
      return { weekIndex, done, goal, percent, perfectDays };
    });
    this.weeklySummaries = allSummaries.slice(0, this.gridRows);

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

  toggleInsights(): void {
    this.insightsOpen = !this.insightsOpen;
  }

  goToTodayAction(): void {
    this.router.navigate(['/today'], { queryParams: { focus: 'todayList' } });
  }

  trackByCalendarCell(index: number, cell: CalendarCell): string {
    return cell.dateKey ?? `empty-${index}`;
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

  private getWeekAttendance(
    habits: Array<{ id: string; isActive: boolean }>,
    completions: Record<string, Record<string, boolean>>,
    skips: HabitSkips,
    today: Date
  ): number {
    const activeHabits = habits.filter(habit => habit.isActive);
    if (activeHabits.length === 0) {
      return 0;
    }
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateKey = this.habitStore.toDateKey(date);
      const dayMap = completions[dateKey] || {};
      const skipMap = skips[dateKey] || {};
      const handled = activeHabits.reduce((sum, habit) => {
        if (dayMap[habit.id] || skipMap[habit.id]) {
          return sum + 1;
        }
        return sum;
      }, 0);
      if (handled > 0) {
        count++;
      }
    }
    return count;
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
}




