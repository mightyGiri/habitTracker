import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  template: `
    <div class="page-container">
      <mat-card class="aesthetic-card">
        <div class="section-header text-section">About Us</div>
        <mat-card-content>
          <p class="text-body">Owner of the app: Giri</p>
          <p class="text-body">
            Terms and conditions: This application is provided as-is for personal habit tracking.
            Additional terms will be published here.
          </p>
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class AboutComponent {}
