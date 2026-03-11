import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { Habit, HabitDomain } from '../../models/habit.model';
import { DOMAINS } from '../../config/domains.config';
import { HabitStoreService } from '../../services/habit-store.service';

export type HabitEditDialogData = {
  mode: 'name' | 'goal' | 'create' | 'edit';
  title: string;
  value?: string | number;
  min?: number;
  max?: number;
  habit?: Habit;
};

@Component({
  selector: 'app-habit-edit-dialog',
  standalone: true,
  imports: [MatDialogModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>

      <!-- ── SIMPLE MODES (name / goal) ─────────────────────────────────────── -->
      @if (data.mode === 'name' || data.mode === 'goal') {
        <mat-form-field>
          <mat-label>{{ data.mode === 'name' ? 'Habit name' : 'Goal days' }}</mat-label>
          <input
            matInput
            [type]="data.mode === 'name' ? 'text' : 'number'"
            [(ngModel)]="modelValue"
            [min]="data.min"
            [max]="data.max"
            required>
        </mat-form-field>
      }

      <!-- ── CREATE / EDIT MODE ──────────────────────────────────────────────── -->
      @if (data.mode === 'create' || data.mode === 'edit') {

        <!-- NAME -->
        <div class="field-block">
          <label class="field-label">HABIT NAME</label>
          <input class="field-input" type="text" [(ngModel)]="habitName"
                 placeholder="e.g. Morning Run" maxlength="60" autofocus>
        </div>

        <!-- DOMAIN PICKER -->
        <div class="field-block">
          <label class="field-label">DOMAIN</label>
          <div class="domain-chips">
            @for (d of domains; track d.id) {
              <button type="button" class="domain-chip"
                      [class.selected]="selectedDomain === d.id"
                      [style.--chip-color]="d.color"
                      [style.--chip-glow]="d.glowColor"
                      (click)="selectedDomain = d.id">
                <span>{{ d.emoji }}</span>
                <span class="chip-label">{{ d.label }}</span>
              </button>
            }
          </div>
        </div>

        <!-- ICON PICKER -->
        <div class="field-block">
          <label class="field-label">ICON</label>
          <div class="icon-grid">
            @for (emoji of iconOptions; track emoji) {
              <button type="button" class="icon-btn"
                      [class.selected]="selectedIcon === emoji"
                      (click)="selectedIcon = emoji">
                {{ emoji }}
              </button>
            }
          </div>
        </div>

        <!-- FREQUENCY TOGGLE -->
        <div class="field-block">
          <label class="field-label">FREQUENCY</label>
          <div class="freq-toggle">
            <button type="button" class="freq-btn"
                    [class.active]="frequencyType === 'daily'"
                    (click)="frequencyType = 'daily'">Daily</button>
            <button type="button" class="freq-btn"
                    [class.active]="frequencyType === 'weekly'"
                    (click)="frequencyType = 'weekly'">Weekly</button>
          </div>
          @if (frequencyType === 'weekly') {
            <div class="weekly-target">
              <button type="button" class="qty-btn" (click)="weeklyTarget = max(1, weeklyTarget - 1)">−</button>
              <span class="qty-val">{{ weeklyTarget }} days / week</span>
              <button type="button" class="qty-btn" (click)="weeklyTarget = min(7, weeklyTarget + 1)">+</button>
            </div>
          }
        </div>

        <!-- DIFFICULTY CHIPS -->
        <div class="field-block">
          <label class="field-label">DIFFICULTY</label>
          <div class="difficulty-chips">
            <button type="button" class="diff-chip easy"
                    [class.active]="difficulty === 'easy'"
                    (click)="difficulty = 'easy'">
              <span>Easy</span><span class="xp-badge">+1 XP</span>
            </button>
            <button type="button" class="diff-chip medium"
                    [class.active]="difficulty === 'medium'"
                    (click)="difficulty = 'medium'">
              <span>Medium</span><span class="xp-badge">+2 XP</span>
            </button>
            <button type="button" class="diff-chip hard"
                    [class.active]="difficulty === 'hard'"
                    (click)="difficulty = 'hard'">
              <span>Hard</span><span class="xp-badge">+3 XP</span>
            </button>
          </div>
        </div>

      }

    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button class="btn btn-outline btn-sm" type="button" (click)="dialogRef.close()">Cancel</button>
      <button
        class="btn btn-primary btn-sm"
        type="button"
        [disabled]="!isValid()"
        (click)="save()">
        {{ data.mode === 'create' ? 'Add Habit' : data.mode === 'edit' ? 'Save Changes' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styleUrls: ['./mobile-habits.edit-dialog.component.sass']
})
export class HabitEditDialogComponent {
  modelValue: string | number;

  // Create/Edit-mode fields
  habitName = '';
  selectedDomain: HabitDomain = 'health';
  selectedIcon = '⚡';
  frequencyType: 'daily' | 'weekly' = 'daily';
  weeklyTarget = 3;
  difficulty: 'easy' | 'medium' | 'hard' = 'medium';

  protected max = Math.max;
  protected min = Math.min;

  readonly domains = DOMAINS;
  readonly iconOptions = ['⚡','🎯','🔥','💎','🌟','🚀','📚','💪','🧠','🎨','💻','🏃','🧘','✍️','🎸','💰','📈','🤝','🌱','⚙️'];

  constructor(
    public dialogRef: MatDialogRef<HabitEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: HabitEditDialogData,
    private habitStore: HabitStoreService
  ) {
    this.modelValue = data.value ?? '';

    // Pre-fill fields when editing an existing habit
    if (data.mode === 'edit' && data.habit) {
      this.habitName = data.habit.name;
      this.selectedDomain = data.habit.domain || 'health';
      this.selectedIcon = data.habit.icon || '⚡';
      this.frequencyType = data.habit.frequencyType || 'daily';
      this.weeklyTarget = data.habit.weeklyTarget || 3;
      this.difficulty = data.habit.difficulty || 'medium';
    }
  }

  isValid(): boolean {
    if (this.data.mode === 'create' || this.data.mode === 'edit') {
      return this.habitName.trim().length > 0;
    }
    if (this.data.mode === 'name') {
      return typeof this.modelValue === 'string' && this.modelValue.trim().length > 0;
    }
    const value = Number(this.modelValue);
    if (Number.isNaN(value) || value < (this.data.min || 1)) {
      return false;
    }
    if (this.data.max && value > this.data.max) {
      return false;
    }
    return true;
  }

  save(): void {
    if (!this.isValid()) return;

    if (this.data.mode === 'create') {
      this.habitStore.addHabit(
        this.habitName.trim(),
        this.frequencyType,
        this.frequencyType === 'weekly' ? this.weeklyTarget : undefined,
        '1.0.0',
        30,
        false,
        0,
        true,
        this.difficulty,
        this.selectedDomain,
        this.selectedIcon
      );
      this.dialogRef.close(true);
    } else if (this.data.mode === 'edit' && this.data.habit) {
      this.habitStore.updateHabit(this.data.habit.id, {
        name: this.habitName.trim(),
        frequencyType: this.frequencyType,
        weeklyTarget: this.frequencyType === 'weekly' ? this.weeklyTarget : undefined,
        difficulty: this.difficulty,
        domain: this.selectedDomain,
        icon: this.selectedIcon,
      });
      this.dialogRef.close(true);
    } else if (this.data.mode === 'name') {
      this.dialogRef.close(String(this.modelValue));
    } else {
      this.dialogRef.close(Number(this.modelValue));
    }
  }
}
