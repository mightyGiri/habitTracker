import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { HabitCheckComponent } from '../../shared/components/habit-check/habit-check.component';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Habit } from '../../models/habit.model';
import { HabitStoreService } from '../../services/habit-store.service';
import { HabitActionsSheetComponent } from './mobile-habits.actions-sheet.component';
import { DayCountPipe } from '../../shared/day-count.pipe';

type DayOption = { dayNumber: number; dayLabel: string };

@Component({
  selector: 'app-mobile-habits-view',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatBottomSheetModule, MatDialogModule, MatIconModule, DayCountPipe, HabitCheckComponent],
  template: `
    <section class="mobile-habits">
      <mat-card class="aesthetic-card mobile-card">
        <div class="card-header text-section">Day Picker</div>
        <mat-card-content class="card-body">
          <div class="day-meta">
            <span class="text-label">{{ monthLabel }} {{ year }}</span>
            <button
              *ngIf="todayDayNumber"
              class="btn btn-outline btn-sm today-btn"
              type="button"
              (click)="jumpToToday()">
              Today
            </button>
          </div>
          <div class="day-scroller" role="listbox" aria-label="Select day">
            <button
              class="day-chip"
              type="button"
              *ngFor="let day of dayOptions; trackBy: trackByDay"
              [class.selected]="day.dayNumber === selectedDayNumber"
              (click)="selectDay(day.dayNumber)">
              <span class="day-number">Day {{ day.dayNumber }}</span>
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="aesthetic-card mobile-card">
        <div class="card-header text-section">Quick Actions</div>
        <mat-card-content class="card-body actions-row">
          <button class="btn btn-outline btn-sm" type="button" (click)="markAll()" [disabled]="!selectedDayNumber">Mark All</button>
          <button class="btn btn-outline btn-sm" type="button" (click)="clearAll()" [disabled]="!selectedDayNumber">Clear All</button>
        </mat-card-content>
      </mat-card>

      <mat-card class="aesthetic-card mobile-card">
        <div class="card-header text-section">Habits</div>
        <mat-card-content class="card-body habit-list">
          <div
            class="habit-row"
            *ngFor="let habit of habits; trackBy: trackByHabitId"
            >
            <button
              type="button"
              class="habit-info"
              (click)="openHabitActions(habit)"
              aria-label="Edit habit">
              <div class="habit-name text-value">{{ habit.name }}</div>
              <div class="habit-meta text-muted">Goal {{ habit.goalDays | dayCount }}</div>
            </button>
            <div class="habit-actions" (click)="$event.stopPropagation()">
              <span class="habit-progress text-label">{{ getProgress(habit.id) }}%</span>
              <app-habit-check
                [checked]="isChecked(selectedDayNumber, habit.id)"
                (toggle)="toggleHabit(habit.id)">
              </app-habit-check>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styleUrls: ['./mobile-habits-view.component.sass']
})
export class MobileHabitsViewComponent implements OnChanges {
  @Input() habits: Habit[] = [];
  @Input() year = 2026;
  @Input() monthIndex = 0;
  @Input() daysInMonth = 0;
  @Input() todayDayNumber: number | null = null;

  dayOptions: DayOption[] = [];
  selectedDayNumber: number | null = null;
  monthLabel = 'Jan';

  private readonly dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  private readonly monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  constructor(
    private habitStore: HabitStoreService,
    private bottomSheet: MatBottomSheet,
    private dialog: MatDialog
  ) {}

  ngOnChanges(): void {
    this.monthLabel = this.monthLabels[this.monthIndex] || 'Jan';
    this.buildDayOptions();
    if (!this.selectedDayNumber || this.selectedDayNumber > this.daysInMonth) {
      this.selectedDayNumber = this.todayDayNumber || 1;
    }
  }

  private buildDayOptions(): void {
    this.dayOptions = Array.from({ length: this.daysInMonth }, (_, index) => {
      const dayNumber = index + 1;
      const weekday = new Date(this.year, this.monthIndex, dayNumber).getDay();
      return { dayNumber, dayLabel: this.dayLabels[weekday] };
    });
  }

  selectDay(dayNumber: number): void {
    this.selectedDayNumber = dayNumber;
  }

  jumpToToday(): void {
    if (this.todayDayNumber) {
      this.selectedDayNumber = this.todayDayNumber;
    }
  }

  markAll(): void {
    if (this.selectedDayNumber) {
      this.habitStore.setAllForDay(this.selectedDayNumber, true);
    }
  }

  clearAll(): void {
    if (this.selectedDayNumber) {
      this.habitStore.setAllForDay(this.selectedDayNumber, false);
    }
  }

  toggleHabit(habitId: string): void {
    if (this.selectedDayNumber) {
      this.habitStore.toggleCheck(this.selectedDayNumber, habitId);
    }
  }

  openHabitActions(habit: Habit): void {
    this.bottomSheet.open(HabitActionsSheetComponent, {
      data: {
        habit,
        maxGoalDays: Math.max(1, Math.min(31, this.daysInMonth || 31))
      },
      panelClass: 'habit-actions-sheet'
    });
  }

  isChecked(dayNumber: number | null, habitId: string): boolean {
    if (!dayNumber) {
      return false;
    }
    return this.habitStore.isChecked(dayNumber, habitId);
  }

  getProgress(habitId: string): number {
    return this.habitStore.getMonthlyCompletionPercent(habitId, this.getMonthKey());
  }

  private getMonthKey(): string {
    return `${this.year}-${String(this.monthIndex + 1).padStart(2, '0')}`;
  }

  trackByDay(index: number, day: DayOption): number {
    return day.dayNumber;
  }

  trackByHabitId(index: number, habit: Habit): string {
    return habit.id;
  }
}
