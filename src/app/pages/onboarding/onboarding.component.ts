import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';
import { filter, take } from 'rxjs';
import { HabitStoreService } from '../../services/habit-store.service';
import { UserProfile } from '../../models/habit.model';

type OnboardingStep = 0 | 1 | 2;

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule],
  template: `
    <div class="page-container onboarding">
      <mat-card class="aesthetic-card onboarding-card">
        <div class="section-header text-section">Getting Started</div>
        <mat-card-content>
          <ng-container [ngSwitch]="step">
            <div *ngSwitchCase="0" class="onboarding-step">
              <h2 class="text-title">Build a streak that lasts</h2>
              <div class="step-cards">
                <div class="step-card">
                  <div class="step-title">Small wins</div>
                  <p class="text-body">Keep your list short so wins stay consistent.</p>
                </div>
                <div class="step-card">
                  <div class="step-title">Daily loop</div>
                  <p class="text-body">Check in fast on the Today screen.</p>
                </div>
                <div class="step-card">
                  <div class="step-title">Reflect</div>
                  <p class="text-body">Use Overview to spot streaks and patterns.</p>
                </div>
              </div>
            </div>

            <div *ngSwitchCase="1" class="onboarding-step">
              <h2 class="text-title">Choose your persona</h2>
              <p class="text-body">We will tailor your tips later.</p>
              <label class="text-label why-label" for="name-input">Name (optional)</label>
              <input
                id="name-input"
                type="text"
                class="onboarding-input"
                [(ngModel)]="name"
                placeholder="Your name">
              <div class="choice-grid">
                <button
                  class="btn btn-outline"
                  type="button"
                  *ngFor="let option of personas"
                  [class.is-active]="persona === option"
                  (click)="persona = option">
                  {{ option }}
                </button>
              </div>
            </div>

            <div *ngSwitchCase="2" class="onboarding-step">
              <h2 class="text-title">Your primary goal</h2>
              <p class="text-body">Pick the focus for your habits.</p>
              <div class="choice-grid">
                <button
                  class="btn btn-outline"
                  type="button"
                  *ngFor="let option of goals"
                  [class.is-active]="goal === option"
                  (click)="goal = option">
                  {{ option }}
                </button>
              </div>
              <label class="text-label why-label" for="why-input">Why? (optional)</label>
              <textarea
                id="why-input"
                class="onboarding-input"
                rows="3"
                [(ngModel)]="why"
                placeholder="Short reason to stay consistent"></textarea>
            </div>
          </ng-container>
        </mat-card-content>
        <div class="onboarding-actions">
          <button class="btn btn-outline" type="button" (click)="goBack()" [disabled]="step === 0">Back</button>
          <div class="actions-right">
            <button class="btn btn-ghost" type="button" (click)="skip()">Skip for now</button>
            <button class="btn btn-primary" type="button" (click)="goNext()">
              {{ step === 2 ? 'Finish' : 'Next' }}
            </button>
          </div>
        </div>
      </mat-card>
    </div>
  `,
  styleUrls: ['./onboarding.component.sass']
})
export class OnboardingComponent implements OnInit {
  step: OnboardingStep = 0;
  personas: Array<UserProfile['persona']> = ['Developer', 'Fitness', 'Student', 'Creator', 'Other'];
  goals: Array<UserProfile['primaryGoal']> = ['Skill', 'Consistency', 'Health', 'Discipline', 'Journal'];
  persona: UserProfile['persona'] = 'Other';
  goal: UserProfile['primaryGoal'] = 'Consistency';
  name = '';
  why = '';

  constructor(private router: Router, private habitStore: HabitStoreService) {}

  ngOnInit(): void {
    this.habitStore.getReady().pipe(
      filter(ready => ready),
      take(1)
    ).subscribe(() => {
      if (this.habitStore.onboardingCompletedSync()) {
        void this.router.navigate(['/today']);
      }
    });
  }

  goNext(): void {
    if (this.step < 2) {
      this.step = (this.step + 1) as OnboardingStep;
      return;
    }
    this.finish();
  }

  goBack(): void {
    if (this.step > 0) {
      this.step = (this.step - 1) as OnboardingStep;
    }
  }

  skip(): void {
    this.habitStore.skipOnboarding();
    void this.router.navigate(['/today']);
  }

  private finish(): void {
    this.saveProfile(this.persona, this.goal, this.why);
    void this.router.navigate(['/today']);
  }

  private saveProfile(persona: UserProfile['persona'], goal: UserProfile['primaryGoal'], why: string): void {
    const profile: UserProfile = {
      name: this.name.trim(),
      persona,
      primaryGoal: goal,
      why: why?.trim() || undefined,
      createdAt: Date.now()
    };
    this.habitStore.setUserProfile(profile);
    this.habitStore.completeOnboarding();
  }
}
