import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

export type SkipReasonResult = {
  reason: string;
  note?: string;
};

@Component({
  selector: 'app-skip-remaining-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="skip-dialog-content">
      <h2>Skip remaining</h2>
      <p class="text-muted">Choose a reason for skipping the remaining habits.</p>

      <div class="reason-list">
        <label class="reason-option" *ngFor="let option of reasons">
          <input
            type="radio"
            name="skipReason"
            [value]="option"
            [(ngModel)]="selectedReason">
          <span>{{ option }}</span>
        </label>
      </div>

      <div class="other-note" *ngIf="selectedReason === 'Other'">
        <label for="skipNote">Optional note</label>
        <input id="skipNote" type="text" [(ngModel)]="note" placeholder="Add a short note" />
      </div>

      <div class="dialog-actions">
        <button class="btn btn-ghost btn-sm" type="button" (click)="close()">Cancel</button>
        <button class="btn btn-outline btn-sm" type="button" [disabled]="!canConfirm" (click)="confirm()">Skip</button>
      </div>
    </div>
  `,
  styleUrls: ['./skip-remaining-dialog.component.sass']
})
export class SkipRemainingDialogComponent {
  reasons = ['Busy', 'Sick', 'Travel', 'Rest', 'Other'];
  selectedReason = 'Busy';
  note = '';

  constructor(private dialogRef: MatDialogRef<SkipRemainingDialogComponent>) {}

  get canConfirm(): boolean {
    if (this.selectedReason !== 'Other') {
      return true;
    }
    return this.note.trim().length > 0;
  }

  close(): void {
    this.dialogRef.close(null);
  }

  confirm(): void {
    const note = this.note.trim();
    this.dialogRef.close({
      reason: this.selectedReason,
      note: note ? note : undefined
    } as SkipReasonResult);
  }
}
