import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
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
  imports: [CommonModule, MatDialogModule, MatIconModule, FormsModule],
  template: `
    <div class="ped-wrap">
      <div class="ped-header">
        <div class="ped-header__icon">
          <mat-icon>person</mat-icon>
        </div>
        <div class="ped-header__text">
          <div class="ped-header__title">Edit Profile</div>
          <div class="ped-header__sub">Customize your hunter identity</div>
        </div>
        <button class="ped-close" type="button" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="ped-body">
        <div class="ped-field">
          <label class="ped-label">NAME</label>
          <input class="ped-input" type="text" [(ngModel)]="displayName"
                 placeholder="Your name" maxlength="50" autofocus>
        </div>
        <div class="ped-field">
          <label class="ped-label">PERSONA</label>
          <input class="ped-input" type="text" [(ngModel)]="persona"
                 placeholder="Disciplined, curious, focused...">
        </div>
        <div class="ped-field">
          <label class="ped-label">PRIMARY GOAL</label>
          <input class="ped-input" type="text" [(ngModel)]="goal"
                 placeholder="Build a calm morning routine">
        </div>
        <div class="ped-field">
          <label class="ped-label">MY WHY</label>
          <textarea class="ped-input ped-textarea" rows="3" [(ngModel)]="why"
                    placeholder="The deeper reason behind your habits"></textarea>
        </div>
      </div>

      <div class="ped-footer">
        <button class="btn btn-outline btn-sm" type="button" (click)="close()">Cancel</button>
        <button class="btn btn-primary btn-sm" type="button"
                [disabled]="!displayName.trim()" (click)="save()">Save Changes</button>
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
