import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

type ProfileEditDialogData = {
  displayName: string;
  persona: string;
  goal: string;
  why: string;
};

export type ProfileEditResult = {
  displayName: string;
  persona: string;
  goal: string;
  why: string;
};

@Component({
  selector: 'app-profile-edit-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <div class="profile-edit-dialog">
      <div class="dialog-title">Edit profile</div>
      <div class="dialog-subtitle text-muted">Make it feel like your space.</div>
      <div class="dialog-fields">
        <mat-form-field appearance="fill" class="dialog-field">
          <mat-label>Name</mat-label>
          <input matInput [(ngModel)]="displayName" placeholder="Your name">
        </mat-form-field>
        <mat-form-field appearance="fill" class="dialog-field">
          <mat-label>Persona</mat-label>
          <input matInput [(ngModel)]="persona" placeholder="Disciplined, curious, focused...">
        </mat-form-field>
        <mat-form-field appearance="fill" class="dialog-field">
          <mat-label>Primary goal</mat-label>
          <input matInput [(ngModel)]="goal" placeholder="Build a calm morning routine">
        </mat-form-field>
        <mat-form-field appearance="fill" class="dialog-field">
          <mat-label>Why</mat-label>
          <textarea matInput rows="3" [(ngModel)]="why" placeholder="The deeper reason behind your habits"></textarea>
        </mat-form-field>
      </div>
      <div class="dialog-actions">
        <button class="btn btn-outline btn-sm" type="button" (click)="close()">Cancel</button>
        <button class="btn btn-primary btn-sm" type="button" (click)="save()">Save</button>
      </div>
    </div>
  `,
  styleUrls: ['./profile-edit-dialog.component.sass']
})
export class ProfileEditDialogComponent {
  displayName = '';
  persona = '';
  goal = '';
  why = '';

  constructor(
    private dialogRef: MatDialogRef<ProfileEditDialogComponent, ProfileEditResult | null>,
    @Inject(MAT_DIALOG_DATA) data: ProfileEditDialogData
  ) {
    this.displayName = data.displayName || '';
    this.persona = data.persona || '';
    this.goal = data.goal || '';
    this.why = data.why || '';
  }

  close(): void {
    this.dialogRef.close(null);
  }

  save(): void {
    this.dialogRef.close({
      displayName: this.displayName.trim(),
      persona: this.persona.trim(),
      goal: this.goal.trim(),
      why: this.why.trim()
    });
  }
}
