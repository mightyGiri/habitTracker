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
      <div class="page-header">
        <button class="back-button" type="button" routerLink="/profile" aria-label="Back to profile">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div>
          <h1 class="page-title">About Level-Up</h1>
          <div class="page-subtitle">Offline-first habit tracker</div>
        </div>
      </div>

      <div class="app-meta">
        <img class="app-icon" src="/icons/app_icon_192x192.png" alt="Level-Up app icon">
        <div>
          <div class="app-name">Level-Up</div>
          <div class="app-version">{{ versionLabel }}</div>
        </div>
      </div>

      <section class="about-section">
        <div class="section-title">How it works</div>
        <ol class="about-list">
          <li>Add habits.</li>
          <li>Check them daily.</li>
          <li>Earn levels by completing habits.</li>
          <li>Keep streak alive by winning days.</li>
          <li>Aim for Perfect Day (all done, no skips).</li>
        </ol>
      </section>

      <section class="about-section">
        <div class="section-title">Privacy</div>
        <ul class="about-bullets">
          <li>Offline-first</li>
          <li>No cloud sync in beta</li>
          <li>No tracking</li>
        </ul>
      </section>

      <section class="about-section">
        <div class="section-title">Beta note</div>
        <p class="section-body">
          This is a beta build. More improvements are coming. Buyers of this version will receive the full release.
        </p>
      </section>
    </div>
  `,
  styleUrls: ['./about.component.sass']
})
export class AboutComponent {
  readonly versionLabel = `${environment.appVersion} (Build ${environment.buildNumber})`;
}
