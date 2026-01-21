import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Habit } from '../../models/habit.model';
import { HabitStoreService } from '../../services/habit-store.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/confirm-dialog.component';
import { HabitEditDialogComponent, HabitEditDialogData } from './mobile-habits.edit-dialog.component';

type HabitActionsData = {
  habit: Habit;
  maxGoalDays: number;
};

@Component({
  selector: 'app-habit-actions-sheet',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <div class="sheet">
      <div class="sheet-header">
        <div class="sheet-title">{{ data.habit.name }}</div>
        <div class="sheet-subtitle text-muted">Goal {{ data.habit.goalDays }} days</div>
      </div>
      <div class="sheet-actions">
        <button mat-stroked-button (click)="editName()">
          <mat-icon>edit</mat-icon>
          Edit name
        </button>
        <button mat-stroked-button (click)="editGoal()">
          <mat-icon>calendar_month</mat-icon>
          Edit goal days
        </button>
        <button mat-stroked-button color="warn" (click)="confirmDelete()">
          <mat-icon>delete</mat-icon>
          Delete
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./mobile-habits.actions-sheet.component.sass']
})
export class HabitActionsSheetComponent {
  constructor(
    private sheetRef: MatBottomSheetRef<HabitActionsSheetComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: HabitActionsData,
    private dialog: MatDialog,
    private habitStore: HabitStoreService
  ) {}

  editName(): void {
    const dialogRef = this.dialog.open<HabitEditDialogComponent, HabitEditDialogData, string>(
      HabitEditDialogComponent,
      {
        data: {
          mode: 'name',
          title: 'Edit habit name',
          value: this.data.habit.name
        }
      }
    );

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.trim()) {
        this.habitStore.renameHabit(this.data.habit.id, result.trim());
        this.sheetRef.dismiss();
      }
    });
  }

  editGoal(): void {
    const dialogRef = this.dialog.open<HabitEditDialogComponent, HabitEditDialogData, number>(
      HabitEditDialogComponent,
      {
        data: {
          mode: 'goal',
          title: 'Edit goal days',
          value: this.data.habit.goalDays,
          min: 1,
          max: this.data.maxGoalDays
        }
      }
    );

    dialogRef.afterClosed().subscribe(result => {
      if (typeof result === 'number' && result > 0) {
        this.habitStore.updateGoalDays(this.data.habit.id, result);
        this.sheetRef.dismiss();
      }
    });
  }

  confirmDelete(): void {
    const dialogRef = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        title: 'Delete habit?',
        message: `Delete "${this.data.habit.name}" from your habits list?`,
        confirmLabel: 'Delete'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.habitStore.deleteHabit(this.data.habit.id);
        this.sheetRef.dismiss();
      }
    });
  }
}
