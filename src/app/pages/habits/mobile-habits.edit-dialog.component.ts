import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

export type HabitEditDialogData = {
  mode: 'name' | 'goal';
  title: string;
  value: string | number;
  min?: number;
  max?: number;
};

@Component({
  selector: 'app-habit-edit-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
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
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button class="btn btn-outline btn-sm" type="button" (click)="dialogRef.close()">Cancel</button>
      <button
        class="btn btn-primary btn-sm"
        type="button"
        [disabled]="!isValid()"
        (click)="save()">
        Save
      </button>
    </mat-dialog-actions>
  `,
  styleUrls: ['./mobile-habits.edit-dialog.component.sass']
})
export class HabitEditDialogComponent {
  modelValue: string | number;

  constructor(
    public dialogRef: MatDialogRef<HabitEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: HabitEditDialogData
  ) {
    this.modelValue = data.value;
  }

  isValid(): boolean {
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
    if (this.data.mode === 'name') {
      this.dialogRef.close(String(this.modelValue));
    } else {
      this.dialogRef.close(Number(this.modelValue));
    }
  }
}
