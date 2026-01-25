import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

type ProfileNameDialogData = {
  displayName: string;
};

@Component({
  selector: 'app-profile-name-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <div class="profile-name-dialog">
      <div class="dialog-title">Set display name</div>
      <mat-form-field appearance="fill" class="name-field">
        <mat-label>Name</mat-label>
        <input matInput [(ngModel)]="name" placeholder="Your name">
      </mat-form-field>
      <div class="dialog-actions">
        <button class="btn btn-outline btn-sm" type="button" (click)="close()">Cancel</button>
        <button class="btn btn-primary btn-sm" type="button" (click)="save()">Save</button>
      </div>
    </div>
  `,
  styleUrls: ['./profile-name-dialog.component.sass']
})
export class ProfileNameDialogComponent {
  name = '';

  constructor(
    private dialogRef: MatDialogRef<ProfileNameDialogComponent, string | null>,
    @Inject(MAT_DIALOG_DATA) data: ProfileNameDialogData
  ) {
    this.name = data.displayName || '';
  }

  close(): void {
    this.dialogRef.close(null);
  }

  save(): void {
    const trimmed = this.name.trim();
    this.dialogRef.close(trimmed || null);
  }
}
