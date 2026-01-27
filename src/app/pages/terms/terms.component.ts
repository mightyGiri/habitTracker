import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule],
  template: `
    <div class="page-container terms-page">
      <div class="page-header">
        <h1 class="text-title">Terms & Conditions</h1>
        <button class="btn btn-ghost btn-sm" type="button" routerLink="/profile">Back</button>
      </div>

      <mat-card class="aesthetic-card">
        <mat-card-content class="card-body terms-body">
          <h2 class="text-section">Offline-first</h2>
          <p class="text-muted">Your data stays on your device unless you export it.</p>

          <h2 class="text-section">Self-improvement tool</h2>
          <p class="text-muted">Level-Up is for personal growth and habit consistency.</p>

          <h2 class="text-section">No guarantees</h2>
          <p class="text-muted">Results depend on your actions and consistency.</p>

          <h2 class="text-section">Contact</h2>
          <p class="text-muted">giri@dailylevel-up.com </p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrls: ['./terms.component.sass']
})
export class TermsComponent {}

