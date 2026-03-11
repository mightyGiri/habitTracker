import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  template: `
    <div class="page-container privacy-page">

      <!-- Header -->
      <header class="info-page-header">
        <button class="info-back-btn" type="button" routerLink="/profile" aria-label="Back">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="info-page-header__icon-wrap">
          <mat-icon>shield</mat-icon>
        </div>
        <div>
          <h1 class="info-page-header__title">Privacy Policy</h1>
          <p class="info-page-header__subtitle">Your data, your control</p>
        </div>
      </header>

      <!-- Privacy principles -->
      <div class="info-card">
        <div class="info-card__header">
          <mat-icon>storage</mat-icon>
          <span>DATA STORAGE</span>
        </div>
        <div class="info-bullets">
          <div class="info-bullet">
            <mat-icon>check_circle</mat-icon>
            <span>All data is stored locally on your device</span>
          </div>
          <div class="info-bullet">
            <mat-icon>check_circle</mat-icon>
            <span>No cloud sync or remote servers in beta</span>
          </div>
          <div class="info-bullet">
            <mat-icon>check_circle</mat-icon>
            <span>Export your data anytime as a JSON backup</span>
          </div>
        </div>
      </div>

      <div class="info-card">
        <div class="info-card__header">
          <mat-icon>visibility_off</mat-icon>
          <span>NO TRACKING</span>
        </div>
        <p class="info-card__body">
          We do not collect analytics, track your usage, or send any data to external services.
          What happens in Level-Up stays on your device.
        </p>
      </div>

      <div class="info-card info-card--accent">
        <div class="info-card__header">
          <mat-icon>sync</mat-icon>
          <span>DATA PORTABILITY</span>
        </div>
        <p class="info-card__body">
          Use the export/import backup feature in Profile to transfer your data between devices or keep a backup copy.
        </p>
      </div>

    </div>
  `,
  styleUrls: ['./privacy.component.sass']
})
export class PrivacyComponent {}
