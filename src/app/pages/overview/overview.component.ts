import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { Subscription, combineLatest, Observable } from 'rxjs';
import { HabitStoreService } from '../../services/habit-store.service';
import { MonthKey, MonthSlot } from '../../models/habit.model';
import { DateUtils } from '../../shared/date-utils';
import { ThemeService } from '../../services/theme.service';
import { staggerFadeUp, noopAnimation } from '../../shared/list-animations';

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
  imports: [CommonModule, MatCardModule],
  animations: [staggerFadeUp || noopAnimation],
  template: `
    <div class="page-container" [@.disabled]="reduceMotion" [class.reduce-motion]="reduceMotion">
      <h1 class="text-title page-title">Overview</h1>
      <ng-container *ngIf="ready$ | async; else loading">
      <mat-card class="aesthetic-card kpi-strip" [@staggerFadeUp]="animationKey">
        <div class="kpi-item">
          <span class="kpi-label">Completion</span>
          <strong class="kpi-value">{{ completionPercent }}%</strong>
        </div>
        <div class="kpi-item">
          <span class="kpi-label">Perfect Days</span>
          <strong class="kpi-value">{{ perfectDaysCount }}</strong>
        </div>
        <div class="kpi-item">
          <span class="kpi-label">Current Streak</span>
          <strong class="kpi-value">{{ currentStreak }} days</strong>
        </div>
        <div class="kpi-item">
          <span class="kpi-label">Best Week</span>
          <strong class="kpi-value">{{ bestWeekLabel }}</strong>
        </div>
      </mat-card>

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
            <span>Perfect</span>
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
  private todayKey = '';
  private gridRows = 6;
  ready$!: Observable<boolean>;

  private subscription: Subscription = new Subscription();

  constructor(
    private habitStore: HabitStoreService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.todayKey = this.habitStore.toDateKey(new Date());
    this.ready$ = this.habitStore.getReady();
    this.subscription.add(
      combineLatest([
        this.habitStore.getSelectedMonthYear(),
        this.habitStore.getHabits(),
        this.habitStore.getCompletions(),
        this.habitStore.getSelectedDateKey()
      ]).subscribe(([monthYear, habits, completions, selectedDateKey]) => {
        this.selectedMonthYear = monthYear;
        this.selectedDateKey = selectedDateKey;
        this.updateData(habits, completions);
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
  private updateData(habits: Array<{ id: string; isActive: boolean }>, completions: Record<string, Record<string, boolean>>): void {
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
}




