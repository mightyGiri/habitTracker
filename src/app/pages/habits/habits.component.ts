import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ToggleComponent } from '../../shared/ui/toggle/toggle.component';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors, FormGroup } from '@angular/forms';
import { Subscription, Observable } from 'rxjs';
import { HabitStoreService } from '../../services/habit-store.service';
import { Habit } from '../../models/habit.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/confirm-dialog.component';
import { ThemeService } from '../../services/theme.service';
import { staggerFadeUp, fadeSlideInOut, noopAnimation } from '../../shared/list-animations';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-habits',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatDialogModule,
    ToggleComponent,
    ReactiveFormsModule
  ],
  animations: [staggerFadeUp || noopAnimation, fadeSlideInOut || noopAnimation],
    template: `
    <div class="page-container" [@.disabled]="reduceMotion">
      <h1 class="text-title page-title">Your Habits</h1>
      <ng-container *ngIf="ready$ | async; else loading">
      <mat-card class="aesthetic-card habits-card arcane-card">
        <mat-card-content>
          <div class="habits-guidance arcane-card--tight" [class.is-warning]="isOverRecommended">
            <div class="text-body">{{ guidanceMessage }}</div>
            <div class="text-muted">Active: {{ activeCount }} / Recommended: 6</div>
          </div>
          <div class="habits-toolbar">
            <button class="add-habit-btn btn btn-primary btn-sm glass-btn glass-btn--primary" type="button" (click)="startAdd()" aria-label="Add habit">
              <mat-icon>add</mat-icon>
              Add Habit
            </button>
          </div>

          <form class="habit-form" *ngIf="formOpen" [formGroup]="habitForm" (ngSubmit)="saveHabit()">
            <mat-form-field appearance="fill">
              <mat-label>Habit Name</mat-label>
              <input matInput formControlName="name" placeholder="Habit name">
              <mat-error *ngIf="nameControl?.hasError('required')">Name is required</mat-error>
              <mat-error *ngIf="nameControl?.hasError('minlength')">Minimum 2 characters</mat-error>
              <mat-error *ngIf="nameControl?.hasError('maxlength')">Maximum 24 characters</mat-error>
              <mat-error *ngIf="nameControl?.hasError('duplicate')">Name already exists</mat-error>
            </mat-form-field>
            <mat-form-field appearance="fill">
              <mat-label>Frequency</mat-label>
              <mat-select formControlName="frequencyType">
                <mat-option value="daily">Daily</mat-option>
                <mat-option value="weekly">Weekly</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="fill" *ngIf="habitForm.get('frequencyType')?.value === 'weekly'">
              <mat-label>Days per week</mat-label>
              <mat-select formControlName="weeklyTarget">
                <mat-option *ngFor="let target of weeklyTargetOptions" [value]="target">{{ target }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="fill">
              <mat-label>Minimum version (optional)</mat-label>
              <input matInput formControlName="minimumVersion" placeholder="e.g., 1 page, 5 minutes">
            </mat-form-field>
            <mat-form-field appearance="fill">
              <mat-label>Difficulty</mat-label>
              <mat-select formControlName="difficulty">
                <mat-option value="easy">Easy (+1 XP)</mat-option>
                <mat-option value="medium">Medium (+2 XP)</mat-option>
                <mat-option value="hard">Hard (+3 XP)</mat-option>
              </mat-select>
            </mat-form-field>
            <div class="reminder-controls">
              <div class="text-label">Habit reminder</div>
              <app-toggle [checked]="habitForm.get('reminderEnabled')?.value" [disabled]="!remindersNativeSupported" (checkedChange)="setReminderEnabled($event)"></app-toggle>
            </div>
            <mat-form-field appearance="fill" *ngIf="habitForm.get('reminderEnabled')?.value">
              <mat-label>Reminder time</mat-label>
              <input matInput type="time" formControlName="reminderTime" [disabled]="!remindersNativeSupported">
            </mat-form-field>
            <div class="text-muted reminder-note" *ngIf="!remindersNativeSupported">Reminders work in the installed app.</div>
            <div class="form-actions">
              <button class="btn btn-primary glass-btn glass-btn--primary" type="submit" [disabled]="habitForm.invalid">
                {{ editingHabitId ? 'Save' : 'Add' }}
              </button>
              <button class="btn btn-outline glass-btn glass-btn--ghost" type="button" (click)="cancelEdit()">Cancel</button>
            </div>
          </form>

          <div class="habits-empty" *ngIf="habits.length === 0">
            No habits yet. Add your first habit.
          </div>

          <div class="habits-list" *ngIf="habits.length > 0">
            <div class="habit-row arcane-card--tight" *ngFor="let habit of habits; let i = index; trackBy: trackByHabitId">
              <div class="habit-header">
                <div class="habit-left">
                  <div class="habit-title text-body">{{ habit.name }}</div>
                  <div class="habit-sub text-muted">
                    {{ habit.isActive ? 'Active' : 'Inactive' }}
                    <span *ngIf="habit.frequencyType">- {{ habit.frequencyType === 'daily' ? 'Daily' : 'Weekly' }}</span>
                    <span *ngIf="habit.frequencyType === 'weekly' && habit.weeklyTarget">- {{ habit.weeklyTarget }}x/week</span>
                  </div>
                  <div class="habit-sub text-muted">Difficulty - {{ (habit.difficulty || 'easy') | titlecase }}</div>
                  <div class="habit-sub text-muted" *ngIf="habit.minimumVersion">{{ habit.minimumVersion }}</div>
                  <div class="habit-sub text-muted" *ngIf="habit.reminderEnabled && habit.reminderTime">Reminder - {{ habit.reminderTime }}</div>
                </div>
                <app-toggle class="glass-toggle" [checked]="habit.isActive" (checkedChange)="toggleActive(habit.id)"></app-toggle>
              </div>
              <div class="habit-actions">
                <button class="btn btn-icon glass-btn glass-btn--ghost" type="button" (click)="moveHabit(i, i - 1)" [disabled]="i === 0" aria-label="Move habit up">
                  <mat-icon>arrow_upward</mat-icon>
                </button>
                <button class="btn btn-icon glass-btn glass-btn--ghost" type="button" (click)="moveHabit(i, i + 1)" [disabled]="i === habits.length - 1" aria-label="Move habit down">
                  <mat-icon>arrow_downward</mat-icon>
                </button>
                <button class="btn btn-icon glass-btn glass-btn--ghost" type="button" (click)="startEdit(habit)" aria-label="Edit habit">
                  <mat-icon>edit</mat-icon>
                </button>
                <button class="btn btn-icon glass-btn glass-btn--ghost" type="button" (click)="confirmDelete(habit)" aria-label="Delete habit">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
      </ng-container>
      <ng-template #loading>
        <mat-card class="aesthetic-card">
          <mat-card-content>Loading habits...</mat-card-content>
        </mat-card>
      </ng-template>

    </div>
  `,
  styleUrls: ['./habits.component.sass']
})
export class HabitsComponent implements OnInit, OnDestroy {
  habits: Habit[] = [];
  formOpen = false;
  editingHabitId: string | null = null;
  habitForm: FormGroup;
  reduceMotion = false;
  ready$!: Observable<boolean>;
  activeCount = 0;
  weeklyTargetOptions = [1, 2, 3, 4, 5, 6, 7];
  remindersNativeSupported = false;
  private subscription: Subscription = new Subscription();

  constructor(
    private habitStore: HabitStoreService,
    private dialog: MatDialog,
    private themeService: ThemeService,
    private fb: FormBuilder,
    private notificationService: NotificationService
  ) {
    this.habitForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(24), this.nameUniqueValidator]],
      frequencyType: ['daily', [Validators.required]],
      weeklyTarget: [3],
      minimumVersion: [''],
      difficulty: ['easy'],
      reminderEnabled: [false],
      reminderTime: ['20:30'],
      timerEnabled: [false],
      timerMinutes: [10]
    });
  }

  ngOnInit(): void {
    this.ready$ = this.habitStore.getReady();
    this.subscription.add(
      this.habitStore.getHabits().subscribe(habits => {
        this.habits = [...habits].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        this.activeCount = habits.filter(habit => habit.isActive).length;
        this.nameControl?.updateValueAndValidity({ emitEvent: false });
      })
    );
    this.subscription.add(
      this.themeService.getReducedMotion().subscribe(reduce => {
        this.reduceMotion = reduce;
      })
    );
    this.remindersNativeSupported = this.notificationService.isNativeSchedulingAvailable();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  get nameControl() {
    return this.habitForm.get('name');
  }

  startAdd(): void {
    this.editingHabitId = null;
    this.habitForm.reset({ frequencyType: 'daily', weeklyTarget: 3, minimumVersion: '', difficulty: 'easy', reminderEnabled: false, reminderTime: '20:30', timerEnabled: false, timerMinutes: 10 });
    this.formOpen = true;
  }

  startEdit(habit: Habit): void {
    this.editingHabitId = habit.id;
    this.habitForm.setValue({
      name: habit.name,
      frequencyType: habit.frequencyType ?? 'daily',
      weeklyTarget: habit.weeklyTarget ?? 3,
      minimumVersion: habit.minimumVersion ?? '',
      difficulty: habit.difficulty ?? 'easy',
      reminderEnabled: habit.reminderEnabled ?? false,
      reminderTime: habit.reminderTime ?? '20:30',
      timerEnabled: habit.timerEnabled ?? false,
      timerMinutes: habit.timerSeconds ? Math.max(1, Math.round(habit.timerSeconds / 60)) : 10
    });
    this.formOpen = true;
  }

  cancelEdit(): void {
    this.formOpen = false;
    this.editingHabitId = null;
    this.habitForm.reset({ frequencyType: 'daily', weeklyTarget: 3, minimumVersion: '', difficulty: 'easy', reminderEnabled: false, reminderTime: '20:30', timerEnabled: false, timerMinutes: 10 });
  }

  saveHabit(): void {
    if (this.habitForm.invalid) {
      return;
    }
    const name = this.nameControl?.value?.toString().trim() || '';
    const frequencyType = (this.habitForm.get('frequencyType')?.value as 'daily' | 'weekly') || 'daily';
    const weeklyTargetRaw = Number(this.habitForm.get('weeklyTarget')?.value);
    const weeklyTarget = frequencyType === 'weekly' && Number.isFinite(weeklyTargetRaw)
      ? Math.min(7, Math.max(1, weeklyTargetRaw))
      : undefined;
    const minimumVersion = String(this.habitForm.get('minimumVersion')?.value || '').trim();
    const difficulty = String(this.habitForm.get('difficulty')?.value || 'easy') as 'easy' | 'medium' | 'hard';
    const reminderEnabled = this.remindersNativeSupported && Boolean(this.habitForm.get('reminderEnabled')?.value);
    const reminderTime = String(this.habitForm.get('reminderTime')?.value || '20:30');
    const timerEnabled = Boolean(this.habitForm.get('timerEnabled')?.value);
    const timerMinutesRaw = Number(this.habitForm.get('timerMinutes')?.value);
    const timerMinutes = Number.isFinite(timerMinutesRaw) ? Math.max(1, Math.min(120, timerMinutesRaw)) : 10;
    const timerSeconds = timerEnabled ? timerMinutes * 60 : 0;
    if (!name) {
      return;
    }
    if (this.editingHabitId) {
      this.habitStore.updateHabit(this.editingHabitId, {
        name,
        frequencyType,
        weeklyTarget,
        minimumVersion,
        difficulty,
        timerEnabled,
        timerSeconds,
        timerAutoComplete: true,
        type: timerEnabled ? 'timer' : 'check',
        targetSeconds: timerSeconds,
        allowManualComplete: false
        ,
        reminderEnabled,
        reminderTime
      });
    } else {
      this.habitStore.addHabit(name, frequencyType, weeklyTarget, minimumVersion, 30, timerEnabled, timerSeconds, true, difficulty);
      const created = this.habitStore.getHabitsSync().find(h => h.name.toLowerCase() === name.toLowerCase());
      if (created && reminderEnabled) {
        this.habitStore.updateHabitReminder(created.id, true, reminderTime);
      }
    }
    this.cancelEdit();
  }

  setTimerEnabled(enabled: boolean): void {
    this.habitForm.patchValue({ timerEnabled: enabled });
    if (!enabled) {
      this.habitForm.patchValue({ timerMinutes: 10 });
    }
  }

  setReminderEnabled(enabled: boolean): void {
    this.habitForm.patchValue({ reminderEnabled: enabled });
    if (!enabled) {
      this.habitForm.patchValue({ reminderTime: '20:30' });
    }
  }

  get isOverRecommended(): boolean {
    return this.activeCount > 6;
  }

  get guidanceMessage(): string {
    if (this.activeCount <= 3) {
      return 'Great - keep it small. Consistency beats intensity.';
    }
    if (this.activeCount <= 6) {
      return 'Nice. Try to keep it under 6 for the best streak success.';
    }
    return 'More habits = less consistency. Consider pausing some.';
  }

  toggleActive(habitId: string): void {
    this.habitStore.toggleHabitActive(habitId);
  }

  moveHabit(fromIndex: number, toIndex: number): void {
    this.habitStore.reorderHabits(fromIndex, toIndex);
  }


  confirmDelete(habit: Habit): void {
    const dialogRef = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        title: 'Delete habit?',
        message: `Delete "${habit.name}"? This won't remove history unless you confirm.`,
        confirmLabel: 'Delete'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.habitStore.deleteHabit(habit.id);
      }
    });
  }

  trackByHabitId(index: number, habit: Habit): string {
    return habit.id;
  }

  private nameUniqueValidator = (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value || '').trim().toLowerCase();
    if (!value) {
      return null;
    }
    const duplicate = this.habits.some(habit => {
      if (this.editingHabitId && habit.id === this.editingHabitId) {
        return false;
      }
      return habit.name.toLowerCase() === value;
    });
    return duplicate ? { duplicate: true } : null;
  };
}
