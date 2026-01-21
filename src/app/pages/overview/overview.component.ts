import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { Subscription, combineLatest } from 'rxjs';
import { HabitStoreService } from '../../services/habit-store.service';
import { MonthKey, MonthSlot, MonthlyTotals, MonthInsights } from '../../models/habit.model';
import { DateUtils } from '../../shared/date-utils';
import { ThemeService } from '../../services/theme.service';
import { staggerFadeUp, noopAnimation } from '../../shared/list-animations';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatProgressBarModule, MatChipsModule],
  animations: [staggerFadeUp || noopAnimation],
  template: `
    <div class="page-container" [@.disabled]="reduceMotion">
      <div class="overview-grid" [@staggerFadeUp]="animationKey">
        <mat-card class="aesthetic-card overview-card">
          <div class="card-header text-section">Mission Progress</div>
          <mat-card-content class="card-body">
            <div class="summary-row">
              <span class="text-label">Completed</span>
              <strong>{{ monthlyTotals.completed }}</strong>
            </div>
            <div class="summary-row">
              <span class="text-label">Goal</span>
              <strong>{{ monthlyTotals.goal }}</strong>
            </div>
            <div class="summary-row">
              <span class="text-label">Left</span>
              <strong>{{ monthlyTotals.left }}</strong>
            </div>
            <div class="summary-row">
              <span class="text-label">Percent</span>
              <strong>
                {{ monthlyTotals.percent }}%
                <span class="rank-badge" [ngClass]="'rank-' + getRankClass(monthlyTotals.percent)">
                  {{ getRankLabel(monthlyTotals.percent) }}
                </span>
              </strong>
            </div>
            <div class="progress-row">
              <mat-progress-bar mode="determinate" [value]="monthlyTotals.percent"></mat-progress-bar>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="aesthetic-card overview-card">
          <div class="card-header text-section">Insights</div>
          <mat-card-content class="card-body">
            <div class="summary-row">
              <span class="text-label">Best Day</span>
              <strong>{{ insights.bestDay ? 'Day ' + insights.bestDay : '--' }}</strong>
            </div>
            <div class="summary-row">
              <span class="text-label">Worst Day</span>
              <strong>{{ insights.worstDay ? 'Day ' + insights.worstDay : '--' }}</strong>
            </div>
            <div class="summary-row">
              <span class="text-label">Current Streak</span>
              <strong>{{ insights.currentStreak }} days</strong>
            </div>
            <div class="summary-row">
              <span class="text-label">Perfect Days</span>
              <strong>{{ insights.perfectDays }}</strong>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="weeks-grid" [@staggerFadeUp]="animationKey">
        <mat-card *ngFor="let week of weekSummaries; trackBy: trackByWeek" class="aesthetic-card week-card">
          <div class="card-header text-section">Week {{ week.weekIndex + 1 }}</div>
          <mat-card-content class="card-body">
            <div class="week-chips">
              <span *ngFor="let day of week.days; trackBy: trackByWeekDay" class="chip-tag" [class.is-empty]="!day.dayNumber">
                {{ day.dayLabel }} {{ day.dayNumber || '' }}
              </span>
            </div>
            <div class="week-counts">
              <div *ngFor="let day of week.days; trackBy: trackByWeekDay" class="count-cell">
                <span *ngIf="day.dayNumber" class="count-pill">{{ day.completedCount }}</span>
                <span *ngIf="!day.dayNumber">-</span>
              </div>
            </div>
            <div class="divider"></div>
            <div class="summary-row">
              <span class="text-label">Completed</span>
              <strong>{{ week.completed }}</strong>
            </div>
            <div class="summary-row">
              <span class="text-label">Goal</span>
              <strong>{{ week.goal }}</strong>
            </div>
            <div class="summary-row">
              <span class="text-label">Left</span>
              <strong>{{ week.left }}</strong>
            </div>
            <div class="progress-row">
              <mat-progress-bar mode="determinate" [value]="week.percent"></mat-progress-bar>
              <span class="percent-label">{{ week.percent }}%</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styleUrls: ['./overview.component.sass']
})
export class OverviewComponent implements OnInit, OnDestroy {
  monthMatrix: MonthSlot[][] = [];
  selectedMonthYear: MonthKey | null = null;
  dailyCounts: number[] = [];
  monthlyTotals: MonthlyTotals = { completed: 0, goal: 0, left: 0, percent: 0 };
  insights: MonthInsights = { bestDay: 0, worstDay: 0, currentStreak: 0, perfectDays: 0 };
  animationKey = 0;
  reduceMotion = false;
  private lastMonthKey: string | null = null;
  weekSummaries: Array<{
    weekIndex: number;
    days: Array<{ dayNumber: number | null; dayLabel: string; completedCount: number }>;
    completed: number;
    goal: number;
    left: number;
    percent: number;
  }> = [];

  private subscription: Subscription = new Subscription();

  constructor(private habitStore: HabitStoreService, private themeService: ThemeService) {}

  ngOnInit(): void {
    this.subscription.add(
      combineLatest([
        this.habitStore.getSelectedMonthYear(),
        this.habitStore.getHabits(),
        this.habitStore.getCompletions()
      ]).subscribe(([monthYear]) => {
        this.selectedMonthYear = monthYear;
        this.updateData();
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

  private updateData(): void {
    if (this.selectedMonthYear) {
      this.monthMatrix = DateUtils.getMonthMatrix(this.selectedMonthYear.year, this.selectedMonthYear.month);
      this.dailyCounts = this.habitStore.getDailyCompletedCounts();
      this.monthlyTotals = this.habitStore.getMonthlyTotals();
      this.insights = this.habitStore.getMonthInsights(this.selectedMonthYear.year, this.selectedMonthYear.month);
      this.buildWeekSummaries();
      const monthKey = `${this.selectedMonthYear.year}-${this.selectedMonthYear.month}`;
      if (this.lastMonthKey !== monthKey) {
        this.animationKey++;
        this.lastMonthKey = monthKey;
      }
    }
  }

  private buildWeekSummaries(): void {
    const habits = this.habitStore.getHabitsSync().length;
    this.weekSummaries = this.monthMatrix.map((week, weekIndex) => {
      const days = week.map(slot => ({
        dayNumber: slot.dayNumber,
        dayLabel: slot.dayLabel,
        completedCount: slot.dayNumber ? (this.dailyCounts[slot.dayNumber - 1] || 0) : 0
      }));
      const completed = days.reduce((sum, day) => sum + (day.dayNumber ? day.completedCount : 0), 0);
      const validDays = days.filter(day => day.dayNumber).length;
      const goal = habits * validDays;
      const left = goal - completed;
      const percent = goal > 0 ? Math.round((completed / goal) * 100) : 0;

      return {
        weekIndex,
        days,
        completed,
        goal,
        left,
        percent
      };
    });
  }

  trackByWeek(index: number, week: { weekIndex: number }): number {
    return week.weekIndex;
  }

  trackByWeekDay(index: number, day: { dayLabel: string; dayNumber: number | null }): string {
    return `${day.dayLabel}-${day.dayNumber ?? 'x'}-${index}`;
  }

  getRankClass(percent: number): 's' | 'a' | 'b' | 'c' | 'd' {
    if (percent >= 90) return 's';
    if (percent >= 75) return 'a';
    if (percent >= 60) return 'b';
    if (percent >= 40) return 'c';
    return 'd';
  }

  getRankLabel(percent: number): string {
    return this.getRankClass(percent).toUpperCase();
  }
}
