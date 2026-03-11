import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  template: `
    <div class="page-container about-page">

      <!-- Header -->
      <header class="info-page-header">
        <button class="info-back-btn" type="button" routerLink="/profile" aria-label="Back">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="info-page-header__icon-wrap">
          <mat-icon>info</mat-icon>
        </div>
        <div>
          <h1 class="info-page-header__title">About</h1>
          <p class="info-page-header__subtitle">Level-Up · {{ versionLabel }}</p>
        </div>
      </header>

      <!-- App identity card -->
      <div class="app-identity-card">
        <div class="app-identity__icon-wrap">
          <img class="app-identity__icon" src="/icons/app_icon_192x192.png" alt="Level-Up app icon"
               onerror="this.style.display='none'">
          <mat-icon class="app-identity__fallback-icon">bolt</mat-icon>
        </div>
        <div class="app-identity__info">
          <div class="app-identity__name">Level-Up</div>
          <div class="app-identity__tagline">Offline-first habit tracker</div>
        </div>
        <div class="app-identity__version-chip">
          <mat-icon>tag</mat-icon>
          {{ versionLabel }}
        </div>
      </div>

      <!-- How it works -->
      <div class="info-card">
        <div class="info-card__header">
          <mat-icon>play_arrow</mat-icon>
          <span>HOW IT WORKS</span>
        </div>
        <ol class="info-steps">
          <li class="info-step">
            <span class="info-step__num">01</span>
            <span>Add habits you want to build</span>
          </li>
          <li class="info-step">
            <span class="info-step__num">02</span>
            <span>Check them every day to earn XP</span>
          </li>
          <li class="info-step">
            <span class="info-step__num">03</span>
            <span>Level up by completing habits consistently</span>
          </li>
          <li class="info-step">
            <span class="info-step__num">04</span>
            <span>Keep your streak alive by winning days</span>
          </li>
          <li class="info-step">
            <span class="info-step__num">05</span>
            <span>Aim for Perfect Day — all habits done, no skips</span>
          </li>
        </ol>
      </div>

      <!-- Privacy -->
      <div class="info-card">
        <div class="info-card__header">
          <mat-icon>shield</mat-icon>
          <span>PRIVACY</span>
        </div>
        <div class="info-bullets">
          <div class="info-bullet">
            <mat-icon>check_circle</mat-icon>
            <span>Offline-first — your data stays on your device</span>
          </div>
          <div class="info-bullet">
            <mat-icon>check_circle</mat-icon>
            <span>No cloud sync in beta</span>
          </div>
          <div class="info-bullet">
            <mat-icon>check_circle</mat-icon>
            <span>No tracking or analytics</span>
          </div>
        </div>
      </div>

      <!-- Beta note -->
      <div class="info-card info-card--accent">
        <div class="info-card__header">
          <mat-icon>science</mat-icon>
          <span>BETA NOTE</span>
        </div>
        <p class="info-card__body">
          This is a beta build. More improvements are coming. Buyers of this version will receive the full release.
        </p>
      </div>

    </div>
  `,
  styleUrls: ['./about.component.sass']
})
export class AboutComponent {
  readonly versionLabel = `${environment.appVersion} (Build ${environment.buildNumber})`;
}
