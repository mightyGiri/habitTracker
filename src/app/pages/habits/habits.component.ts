import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { Subscription, combineLatest } from 'rxjs';
import { HabitStoreService } from '../../services/habit-store.service';
import { Habit, MonthKey, MonthSlot } from '../../models/habit.model';
import { DateUtils } from '../../shared/date-utils';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/confirm-dialog.component';
import { ImportConfirmDialogComponent, ImportConfirmDialogData } from '../../shared/import-confirm-dialog.component';
import { ThemeService } from '../../services/theme.service';
import { BackupService } from '../../services/backup.service';
import { staggerFadeUp, fadeSlideInOut, noopAnimation } from '../../shared/list-animations';
import { MobileHabitsViewComponent } from './mobile-habits-view.component';

@Component({
  selector: 'app-habits',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatSelectModule, MatProgressBarModule, MatDialogModule, MatSlideToggleModule, MatSnackBarModule, FormsModule, MobileHabitsViewComponent],
  animations: [staggerFadeUp || noopAnimation, fadeSlideInOut || noopAnimation],
  template: `
    <div class="page-container" [@.disabled]="reduceMotion">
      <mat-card class="aesthetic-card add-habit-card">
        <div class="section-header text-section">Add New Habit</div>
        <mat-card-content>
          <form (ngSubmit)="addHabit()">
            <mat-form-field>
              <mat-label>Habit Name</mat-label>
              <input matInput [(ngModel)]="newHabitName" name="name" required placeholder="Habit name">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Goal Days</mat-label>
              <input matInput type="number" [(ngModel)]="newHabitGoal" name="goal" required min="1" placeholder="Goal days">
            </mat-form-field>
            <button mat-raised-button color="primary" type="submit">Add Habit</button>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="aesthetic-card controls-card">
        <div class="section-header text-section">Habit Controls</div>
        <mat-card-content>
          <div class="controls-row">
            <mat-form-field>
              <mat-label>Search Habits</mat-label>
              <input matInput [(ngModel)]="searchTerm" (input)="applyFilters()" placeholder="Search by name">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Filter</mat-label>
              <mat-select [(ngModel)]="filterType" (selectionChange)="applyFilters()">
                <mat-option value="all">All Habits</mat-option>
                <mat-option value="low">Low Completion (< 40%)</mat-option>
                <mat-option value="high">High Completion (> 80%)</mat-option>
              </mat-select>
            </mat-form-field>
            <button mat-stroked-button (click)="markAllToday()" [disabled]="!todayDayNumber" aria-label="Mark all habits for today">
              Mark All Today
            </button>
            <button mat-stroked-button (click)="clearToday()" [disabled]="!todayDayNumber" aria-label="Clear all habits for today">
              Clear Today
            </button>
            <mat-slide-toggle class="mobile-only" [(ngModel)]="collapseWeekHeaders">
              Collapse week headers
            </mat-slide-toggle>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="aesthetic-card backup-card">
        <div class="section-header text-section">Backup & Restore</div>
        <mat-card-content>
          <div class="backup-actions">
            <button mat-stroked-button (click)="exportJson()">Export JSON</button>
            <button mat-stroked-button (click)="triggerImportJson(importInput)">Import JSON</button>
            <button mat-stroked-button (click)="exportXlsx()" [disabled]="exportingXlsx">
              {{ exportingXlsx ? 'Exporting...' : 'Export Excel (XLSX)' }}
            </button>
            <button mat-stroked-button (click)="exportCsv()">Export CSV</button>
          </div>
          <input
            #importInput
            type="file"
            class="visually-hidden"
            accept=".json,application/json"
            (change)="onImportJson($event)">
        </mat-card-content>
      </mat-card>

      <app-mobile-habits-view
        *ngIf="isMobile"
        [habits]="filteredHabits"
        [year]="selectedMonthYear?.year || selectedYearFallback"
        [monthIndex]="selectedMonthYear?.month || 0"
        [daysInMonth]="daysInMonth"
        [todayDayNumber]="todayDayNumber">
      </app-mobile-habits-view>

      <mat-card *ngIf="!isMobile" class="aesthetic-card grid-card">
        <div class="section-header text-section">Habit Grid</div>
        <mat-card-content class="grid-container">
          <div class="habits-grid" [style.gridTemplateColumns]="gridTemplateColumns" [class.collapse-week-headers]="collapseWeekHeaders" [@staggerFadeUp]="animationKey">
            <div class="header-row" *ngIf="!collapseWeekHeaders">
              <div class="cell habit-cell sticky-left sticky-top text-label">Habit</div>
              <div class="cell goal-cell sticky-left sticky-top text-label">Goal</div>
              <div class="cell progress-cell sticky-left sticky-top text-label">Progress</div>
              <div class="cell actions-cell sticky-left sticky-top text-label">Actions</div>
              <div *ngFor="let week of monthMatrix; let weekIndex = index; trackBy: trackByWeekIndex" class="week-header sticky-top" [style.grid-column]="'span ' + week.length">
                Week {{ weekIndex + 1 }}
              </div>
            </div>
            <div class="subheader-row">
              <div class="cell habit-cell sticky-left sticky-top-secondary"></div>
              <div class="cell goal-cell sticky-left sticky-top-secondary"></div>
              <div class="cell progress-cell sticky-left sticky-top-secondary"></div>
              <div class="cell actions-cell sticky-left sticky-top-secondary"></div>
              <div *ngFor="let slot of flatDays; trackBy: trackBySlotIndex" class="cell day-cell sticky-top-secondary text-muted">
                {{ slot.dayLabel }}<br>{{ slot.dayNumber || '' }}
              </div>
            </div>
            <div *ngFor="let habit of filteredHabits; trackBy: trackByHabitId" class="habit-row" [@fadeSlideInOut]>
              <div class="cell habit-cell sticky-left">
                <input
                  *ngIf="editingHabit === habit.id"
                  matInput
                  [(ngModel)]="editName"
                  (keyup.enter)="saveRename(habit.id)"
                  aria-label="Rename habit">
              <span *ngIf="editingHabit !== habit.id" class="text-body">{{ habit.name }}</span>
              </div>
              <div class="cell goal-cell sticky-left">
                <input
                  class="goal-input"
                  type="number"
                  min="1"
                  [(ngModel)]="habit.goalDays"
                  (blur)="updateGoal(habit.id, habit.goalDays)"
                  aria-label="Goal days for habit">
              </div>
              <div class="cell progress-cell sticky-left">
                <mat-progress-bar mode="determinate" [value]="habitProgressMap[habit.id] || 0"></mat-progress-bar>
              <span class="text-label">{{ habitProgressMap[habit.id] || 0 }}%</span>
              </div>
              <div class="cell actions-cell sticky-left">
                <button
                  mat-icon-button
                  (click)="fillCurrentWeek(habit.id)"
                  [disabled]="currentWeekIndex < 0"
                  aria-label="Fill current week for this habit">
                  <mat-icon>playlist_add_check</mat-icon>
                </button>
                <ng-container *ngIf="editingHabit !== habit.id; else editActions">
                  <button mat-icon-button (click)="startEdit(habit)" aria-label="Edit habit name">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button (click)="confirmDelete(habit)" aria-label="Delete habit">
                    <mat-icon>delete</mat-icon>
                  </button>
                </ng-container>
                <ng-template #editActions>
                  <button mat-icon-button color="primary" (click)="saveRename(habit.id)" aria-label="Save habit name">
                    <mat-icon>check</mat-icon>
                  </button>
                  <button mat-icon-button (click)="cancelEdit()" aria-label="Cancel habit edit">
                    <mat-icon>close</mat-icon>
                  </button>
                </ng-template>
              </div>
              <div *ngFor="let slot of flatDays; trackBy: trackBySlotIndex" class="cell checkbox-cell" [class.is-checked]="slot.dayNumber && isChecked(slot.dayNumber!, habit.id)">
                <mat-checkbox
                  *ngIf="slot.dayNumber"
                  [checked]="isChecked(slot.dayNumber!, habit.id)"
                  (change)="toggleCheck(slot.dayNumber!, habit.id)"
                  [aria-label]="'Toggle ' + habit.name + ' for day ' + slot.dayNumber">
                </mat-checkbox>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrls: ['./habits.component.sass']
})
export class HabitsComponent implements OnInit, OnDestroy {
  habits: Habit[] = [];
  filteredHabits: Habit[] = [];
  monthMatrix: MonthSlot[][] = [];
  flatDays: MonthSlot[] = [];
  gridTemplateColumns = '';
  selectedMonthYear: MonthKey | null = null;
  selectedYearFallback = 2026;
  daysInMonth = 0;
  newHabitName = '';
  newHabitGoal = 30;
  editingHabit: string | null = null;
  editName = '';
  searchTerm = '';
  filterType = 'all';
  habitProgressMap: Record<string, number> = {};
  todayDayNumber: number | null = null;
  currentWeekIndex = -1;
  collapseWeekHeaders = false;
  animationKey = 0;
  reduceMotion = false;
  isMobile = false;
  exportingXlsx = false;
  private lastMonthKey: string | null = null;
  private resizeListener?: () => void;

  private subscription: Subscription = new Subscription();

  constructor(
    private habitStore: HabitStoreService,
    private dialog: MatDialog,
    private themeService: ThemeService,
    private snackBar: MatSnackBar,
    private backupService: BackupService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      combineLatest([
        this.habitStore.getSelectedMonthYear(),
        this.habitStore.getHabits(),
        this.habitStore.getCompletions()
      ]).subscribe(([monthYear, habits]) => {
        this.selectedMonthYear = monthYear;
        this.selectedYearFallback = monthYear.year;
        this.habits = habits;
        this.updateMatrix();
        this.updateComputed();
        this.applyFilters();
        const monthKey = `${monthYear.year}-${monthYear.month}`;
        if (this.lastMonthKey !== monthKey) {
          this.animationKey++;
          this.lastMonthKey = monthKey;
        }
      })
    );
    this.subscription.add(
      this.themeService.getReducedMotion().subscribe(reduce => {
        this.reduceMotion = reduce;
      })
    );

    if (isPlatformBrowser(this.platformId)) {
      this.updateViewport();
      this.resizeListener = () => this.updateViewport();
      window.addEventListener('resize', this.resizeListener);
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    if (this.resizeListener && isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  applyFilters(): void {
    let filtered = this.habits.filter(h => h.name.toLowerCase().includes(this.searchTerm.toLowerCase()));
    if (this.filterType === 'low') {
      filtered = filtered.filter(h => (this.habitProgressMap[h.id] || 0) < 40);
    } else if (this.filterType === 'high') {
      filtered = filtered.filter(h => (this.habitProgressMap[h.id] || 0) > 80);
    }
    this.filteredHabits = filtered;
  }

  markAllToday(): void {
    if (this.todayDayNumber) {
      this.habitStore.setAllForDay(this.todayDayNumber, true);
    }
  }

  clearToday(): void {
    if (this.todayDayNumber) {
      this.habitStore.setAllForDay(this.todayDayNumber, false);
    }
  }

  exportJson(): void {
    try {
      this.backupService.exportJsonBackup();
      this.snackBar.open('Export completed', 'Close', { duration: 2000 });
    } catch (error) {
      console.error('Export failed', error);
      this.snackBar.open('Export failed', 'Close', { duration: 2000 });
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
          if (parsed.appSettings?.theme === 'dark' || parsed.appSettings?.theme === 'light') {
            this.themeService.setTheme(parsed.appSettings.theme);
          }
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

  fillCurrentWeek(habitId: string): void {
    if (this.currentWeekIndex >= 0 && this.currentWeekIndex < this.monthMatrix.length) {
      this.monthMatrix[this.currentWeekIndex].forEach(slot => {
        if (slot.dayNumber && !this.isChecked(slot.dayNumber, habitId)) {
          this.toggleCheck(slot.dayNumber, habitId);
        }
      });
    }
  }

  getCurrentWeekIndex(): number {
    const todayDayNumber = this.habitStore.getTodayDayNumberIfInSelectedMonth();
    if (!todayDayNumber) {
      return -1;
    }
    return this.monthMatrix.findIndex(week => week.some(slot => slot.dayNumber === todayDayNumber));
  }

  private updateMatrix(): void {
    if (this.selectedMonthYear) {
      this.monthMatrix = DateUtils.getMonthMatrix(this.selectedMonthYear.year, this.selectedMonthYear.month);
      this.daysInMonth = DateUtils.daysInMonth(this.selectedMonthYear.year, this.selectedMonthYear.month);
      this.flatDays = this.monthMatrix.flat();
      this.gridTemplateColumns = `var(--habit-col-width) var(--goal-col-width) var(--progress-col-width) var(--actions-col-width) repeat(${this.flatDays.length}, var(--day-col-width))`;
    }
  }

  private updateComputed(): void {
    if (!this.selectedMonthYear) return;
    this.todayDayNumber = this.habitStore.getTodayDayNumberIfInSelectedMonth();
    this.currentWeekIndex = this.getCurrentWeekIndex();
    this.habitProgressMap = this.habits.reduce((acc, habit) => {
      acc[habit.id] = this.habitStore.getHabitCompletionPercent(
        habit.id,
        this.selectedMonthYear!.year,
        this.selectedMonthYear!.month
      );
      return acc;
    }, {} as Record<string, number>);
  }

  addHabit(): void {
    if (this.newHabitName.trim()) {
      this.habitStore.addHabit(this.newHabitName.trim(), this.newHabitGoal);
      this.newHabitName = '';
      this.newHabitGoal = 30;
    }
  }

  startEdit(habit: Habit): void {
    this.editingHabit = habit.id;
    this.editName = habit.name;
  }

  saveRename(habitId: string): void {
    if (this.editName.trim()) {
      this.habitStore.renameHabit(habitId, this.editName.trim());
    }
    this.editingHabit = null;
    this.editName = '';
  }

  cancelEdit(): void {
    this.editingHabit = null;
    this.editName = '';
  }

  updateGoal(habitId: string, goal: number): void {
    if (goal > 0) {
      this.habitStore.updateGoalDays(habitId, goal);
    }
  }

  confirmDelete(habit: Habit): void {
    const dialogRef = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        title: 'Delete habit?',
        message: `Delete "${habit.name}" from your habits list?`,
        confirmLabel: 'Delete'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.habitStore.deleteHabit(habit.id);
      }
    });
  }

  isChecked(dayNumber: number, habitId: string): boolean {
    return this.habitStore.isChecked(dayNumber, habitId);
  }

  toggleCheck(dayNumber: number, habitId: string): void {
    this.habitStore.toggleCheck(dayNumber, habitId);
  }

  trackByHabitId(index: number, habit: Habit): string {
    return habit.id;
  }

  trackByWeekIndex(index: number): number {
    return index;
  }

  trackBySlotIndex(index: number, slot: MonthSlot): string {
    return `${slot.dayLabel}-${slot.dayNumber ?? 'x'}-${index}`;
  }

  private updateViewport(): void {
    this.isMobile = window.innerWidth <= 768;
  }
}
