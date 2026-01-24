import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export type FinishDayConfirmData = {
  remainingCount: number;
};

@Component({
  selector: 'app-finish-day-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  template: `
    <div class="confirm-dialog">
      <h2 class="text-title">Finish today?</h2>
      <p class="text-body">
        You still have {{ data.remainingCount }} habits left. Finishing will mark the rest as skipped.
      </p>
      <div class="dialog-actions">
        <button class="btn btn-outline btn-sm btn-cancel" type="button" (click)="close(false)">Back</button>
        <button class="btn btn-primary btn-sm btn-finish" type="button" (click)="close(true)">Finish</button>
      </div>
    </div>
  `,
  styleUrls: ['./finish-day-confirm-dialog.component.sass']
})
export class FinishDayConfirmDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<FinishDayConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FinishDayConfirmData
  ) {}

  close(result: boolean): void {
    this.dialogRef.close(result);
  }
}
