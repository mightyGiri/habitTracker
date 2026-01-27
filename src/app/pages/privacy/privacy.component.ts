import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule],
  template: `
    <div class="page-container privacy-page">
      <div class="page-header">
        <h1 class="text-title">Privacy Policy</h1>
        <button class="btn btn-ghost btn-sm" type="button" routerLink="/profile">Back</button>
      </div>

      <mat-card class="aesthetic-card">
        <mat-card-content class="card-body privacy-body">
          <h2 class="text-section">Offline-first</h2>
          <p class="text-muted">Your data stays on your device by default.</p>

          <h2 class="text-section">No tracking</h2>
          <p class="text-muted">We don’t collect analytics or track your usage.</p>

          <h2 class="text-section">No cloud sync</h2>
          <p class="text-muted">Use export/import if you want to move your data.</p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrls: ['./privacy.component.sass']
})
export class PrivacyComponent {}

