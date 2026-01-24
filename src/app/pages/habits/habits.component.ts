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
      <mat-card class="aesthetic-card habits-card">
        <mat-card-content>
          <div class="habits-toolbar">
            <button class="add-habit-btn btn btn-outline btn-sm" type="button" (click)="startAdd()" [disabled]="isHabitLimitReached" aria-label="Add habit">
              <mat-icon>add</mat-icon>
              Add Habit
            </button>
          </div>
          <div class="habit-warning text-muted" *ngIf="showSoftLimitWarning">
            More habits = less consistency. Try staying under 5.
          </div>
          <div class="habit-warning text-muted" *ngIf="isHabitLimitReached">
            Habit limit reached. Focus on consistency first.
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
              <mat-select formControlName="frequency">
                <mat-option value="daily">Daily</mat-option>
                <mat-option value="weekly">Weekly</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="fill">
              <mat-label>Minimum version</mat-label>
              <input matInput formControlName="minimum" placeholder="e.g., 1 page, 5 minutes">
            </mat-form-field>
            <div class="form-actions">
              <button class="btn btn-primary" type="submit" [disabled]="habitForm.invalid">
                {{ editingHabitId ? 'Save' : 'Add' }}
              </button>
              <button class="btn btn-outline" type="button" (click)="cancelEdit()">Cancel</button>
            </div>
          </form>

          <div class="habits-empty" *ngIf="habits.length === 0">
            No habits yet. Add your first habit.
          </div>

          <div class="habits-list" *ngIf="habits.length > 0">
            <div class="habit-row" *ngFor="let habit of habits; let i = index; trackBy: trackByHabitId">
              <div class="habit-header">
                <div class="habit-name">
                  <div class="text-body">{{ habit.name }}</div>
                  <div class="text-muted">
                    {{ habit.isActive ? 'Active' : 'Inactive' }}
                    <span *ngIf="habit.frequency">• {{ habit.frequency === 'daily' ? 'Daily' : 'Weekly' }}</span>
                    <span *ngIf="habit.minimum">• {{ habit.minimum }}</span>
                  </div>
                </div>
                <app-toggle [checked]="habit.isActive" (checkedChange)="toggleActive(habit.id)"></app-toggle>
              </div>
              <div class="habit-actions">
                <button class="btn btn-icon" type="button" (click)="moveHabit(i, i - 1)" [disabled]="i === 0" aria-label="Move habit up">
                  <mat-icon>arrow_upward</mat-icon>
                </button>
                <button class="btn btn-icon" type="button" (click)="moveHabit(i, i + 1)" [disabled]="i === habits.length - 1" aria-label="Move habit down">
                  <mat-icon>arrow_downward</mat-icon>
                </button>
                <button class="btn btn-icon" type="button" (click)="startEdit(habit)" aria-label="Edit habit">
                  <mat-icon>edit</mat-icon>
                </button>
                <button class="btn btn-icon" type="button" (click)="confirmDelete(habit)" aria-label="Delete habit">
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
  totalHabits = 0;
  private subscription: Subscription = new Subscription();

  constructor(
    private habitStore: HabitStoreService,
    private dialog: MatDialog,
    private themeService: ThemeService,
    private fb: FormBuilder
  ) {
    this.habitForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(24), this.nameUniqueValidator]],
      frequency: ['daily', [Validators.required]],
      minimum: ['']
    });
  }

  ngOnInit(): void {
    this.ready$ = this.habitStore.getReady();
    this.subscription.add(
      this.habitStore.getHabits().subscribe(habits => {
        this.habits = [...habits].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        this.totalHabits = habits.length;
        this.nameControl?.updateValueAndValidity({ emitEvent: false });
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

  get nameControl() {
    return this.habitForm.get('name');
  }

  startAdd(): void {
    this.editingHabitId = null;
    this.habitForm.reset({ frequency: 'daily', minimum: '' });
    this.formOpen = true;
  }

  startEdit(habit: Habit): void {
    this.editingHabitId = habit.id;
    this.habitForm.setValue({
      name: habit.name,
      frequency: habit.frequency ?? 'daily',
      minimum: habit.minimum ?? ''
    });
    this.formOpen = true;
  }

  cancelEdit(): void {
    this.formOpen = false;
    this.editingHabitId = null;
    this.habitForm.reset({ frequency: 'daily', minimum: '' });
  }

  saveHabit(): void {
    if (this.habitForm.invalid) {
      return;
    }
    const name = this.nameControl?.value?.toString().trim() || '';
    const frequency = (this.habitForm.get('frequency')?.value as 'daily' | 'weekly') || 'daily';
    const minimum = String(this.habitForm.get('minimum')?.value || '').trim();
    if (!name) {
      return;
    }
    if (this.editingHabitId) {
      this.habitStore.updateHabit(this.editingHabitId, { name, frequency, minimum });
    } else {
      this.habitStore.addHabit(name, frequency, minimum);
    }
    this.cancelEdit();
  }

  get showSoftLimitWarning(): boolean {
    return this.totalHabits > 5 && this.totalHabits < 7;
  }

  get isHabitLimitReached(): boolean {
    return this.totalHabits >= 7;
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
