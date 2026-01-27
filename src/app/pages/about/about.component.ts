import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule],
  template: `
    <div class="page-container about-page">
      <div class="page-header">
        <h1 class="text-title">About Level-Up</h1>
        <button class="btn btn-ghost btn-sm" type="button" routerLink="/profile">Back</button>
      </div>

      <mat-card class="aesthetic-card">
        <div class="section-header text-section">How to use</div>
        <mat-card-content class="card-body">
          <ol class="about-list">
            <li>Add habits.</li>
            <li>Check them daily.</li>
            <li>Earn XP and levels by completed habits.</li>
            <li>Keep streak alive by winning days.</li>
            <li>Aim for Perfect Day by completing all with no skips.</li>
          </ol>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrls: ['./about.component.sass']
})
export class AboutComponent {}

