import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { Subscription, combineLatest } from 'rxjs';
import { HabitStoreService } from '../../services/habit-store.service';
import { MonthKey, MonthlyTotals, TopHabit, MonthInsights } from '../../models/habit.model';
import type { ChartDataset } from 'chart.js';
import Chart from 'chart.js/auto';
import { ThemeService } from '../../services/theme.service';
import { staggerFadeUp, noopAnimation } from '../../shared/list-animations';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  animations: [staggerFadeUp || noopAnimation],
  template: `
    <div class="page-container" [@.disabled]="reduceMotion">
      <div class="kpi-grid" [@staggerFadeUp]="animationKey">
        <mat-card class="aesthetic-card kpi-card">
          <mat-card-content>
            <div class="kpi-value text-value">{{ completedTodayDisplay }}</div>
            <div class="kpi-label text-label">Daily Completion</div>
          </mat-card-content>
        </mat-card>
        <mat-card class="aesthetic-card kpi-card">
          <mat-card-content>
            <div class="kpi-value text-value">{{ monthlyPercentDisplay }}%</div>
            <div class="kpi-label text-label">Awakening Progress</div>
          </mat-card-content>
        </mat-card>
        <mat-card class="aesthetic-card kpi-card">
          <mat-card-content>
            <div class="kpi-value text-value">{{ totalHabitsDisplay }}</div>
            <div class="kpi-label text-label">Hunter Stats</div>
          </mat-card-content>
        </mat-card>
        <mat-card class="aesthetic-card kpi-card">
          <mat-card-content>
            <div class="kpi-value text-value">{{ currentStreakDisplay }}</div>
            <div class="kpi-label text-label">Current Streak</div>
          </mat-card-content>
        </mat-card>
      </div>

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
            <ul class="habits-list">
              <li *ngFor="let habit of topHabits; trackBy: trackByHabitId">
                <span>{{ habit.habit.name }}</span>
                <span class="habit-percent">{{ habit.completionPercent }}%</span>
              </li>
            </ul>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.component.sass']
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('lineCanvas') lineCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('doughnutCanvas') doughnutCanvas!: ElementRef<HTMLCanvasElement>;
  private lineChart?: Chart;
  private doughnutChart?: Chart;
  selectedMonthYear: MonthKey | null = null;
  daysInMonth = 0;
  monthlyTotals: MonthlyTotals = { completed: 0, goal: 0, left: 0, percent: 0 };
  dailyCounts: number[] = [];
  topHabits: TopHabit[] = [];
  habitsCount = 0;
  completedTodayDisplay = '--';
  monthlyPercentDisplay = 0;
  totalHabitsDisplay = 0;
  currentStreakDisplay = 0;
  totalHabits = 0;
  insights: MonthInsights = { bestDay: 0, worstDay: 0, currentStreak: 0, perfectDays: 0 };
  animationKey = 0;
  reduceMotion = false;
  private lastMonthKey: string | null = null;

  private subscription: Subscription = new Subscription();

  constructor(
    private habitStore: HabitStoreService,
    private themeService: ThemeService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      combineLatest([
        this.habitStore.getSelectedMonthYear(),
        this.habitStore.getCompletions(),
        this.habitStore.getHabits()
      ]).subscribe(([monthYear]) => {
        this.selectedMonthYear = monthYear;
        this.habitsCount = this.habitStore.getHabitsSync().length;
        this.updateData();
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
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.createCharts();
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
    }
  }

  private updateData(): void {
    if (this.selectedMonthYear) {
      this.daysInMonth = this.habitStore.getDaysInMonth();
      this.monthlyTotals = this.habitStore.getMonthlyTotals();
      this.dailyCounts = this.habitStore.getDailyCompletedCounts();
      this.topHabits = this.habitStore.getTopHabits(10);
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
    const dayNumber = this.habitStore.getTodayDayNumberIfInSelectedMonth();
    if (!dayNumber) {
      return null;
    }
    return this.dailyCounts[dayNumber - 1] || 0;
  }

  trackByHabitId(index: number, habit: TopHabit): string {
    return habit.habit.id;
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

    this.doughnutChart.data.datasets[0].backgroundColor = [accent, glow];
    if (this.doughnutChart.options.plugins?.legend?.labels) {
      this.doughnutChart.options.plugins.legend.labels.color = muted;
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
}
