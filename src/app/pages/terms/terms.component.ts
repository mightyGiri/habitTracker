import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  template: `
    <div class="page-container terms-page">

      <!-- Header -->
      <header class="info-page-header">
        <button class="info-back-btn" type="button" routerLink="/profile" aria-label="Back">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="info-page-header__icon-wrap">
          <mat-icon>gavel</mat-icon>
        </div>
        <div>
          <h1 class="info-page-header__title">Terms & Conditions</h1>
          <p class="info-page-header__subtitle">Simple and honest</p>
        </div>
      </header>

      <div class="info-card">
        <div class="info-card__header">
          <mat-icon>storage</mat-icon>
          <span>OFFLINE-FIRST</span>
        </div>
        <p class="info-card__body">
          Your data stays on your device unless you explicitly export it. No hidden cloud transfers.
        </p>
      </div>

      <div class="info-card">
        <div class="info-card__header">
          <mat-icon>self_improvement</mat-icon>
          <span>PURPOSE</span>
        </div>
        <p class="info-card__body">
          Level-Up is a personal growth and habit consistency tool. It is not a substitute for professional advice.
        </p>
      </div>

      <div class="info-card">
        <div class="info-card__header">
          <mat-icon>warning_amber</mat-icon>
          <span>NO GUARANTEES</span>
        </div>
        <p class="info-card__body">
          Results depend entirely on your actions and consistency. We provide the system — you provide the effort.
        </p>
      </div>

      <div class="info-card info-card--accent">
        <div class="info-card__header">
          <mat-icon>mail</mat-icon>
          <span>CONTACT</span>
        </div>
        <p class="info-card__body">giri&#64;dailylevel-up.com</p>
      </div>

    </div>
  `,
  styleUrls: ['./terms.component.sass']
})
export class TermsComponent {}
