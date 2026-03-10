import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface ImportConfirmDialogData {
  title: string;
  message: string;
}

@Component({
  selector: 'app-import-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button class="btn btn-outline btn-sm" type="button" mat-dialog-close>Cancel</button>
      <button class="btn btn-outline btn-sm" type="button" [mat-dialog-close]="'merge'">Merge</button>
      <button class="btn btn-primary btn-sm" type="button" [mat-dialog-close]="'replace'">Replace</button>
    </mat-dialog-actions>
  `
})
export class ImportConfirmDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: ImportConfirmDialogData) {}
}
