import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { filter, take } from 'rxjs';
import { HabitStoreService } from '../../services/habit-store.service';
import { ThemeService, AppTheme } from '../../services/theme.service';
import { SettingsService } from '../../services/settings.service';
import { UserProfile } from '../../models/habit.model';

type OnboardingStep = 0 | 1 | 2 | 3 | 4;

type ThemeOption = {
  key: string;
  label: string;
  description: string;
  theme: AppTheme;
  accent?: 'blue' | 'green';
};

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container onboarding">
      <div class="onboarding-shell">
        <ng-container [ngSwitch]="step">
          <section *ngSwitchCase="0" class="onboarding-step">
            <h1 class="text-title center-title">Choose your default theme</h1>
            <p class="text-muted center-subtitle">You can change this anytime in Profile.</p>
            <div class="theme-grid">
              <button
                class="theme-card"
                type="button"
                *ngFor="let option of themeOptions"
                [class.is-active]="selectedThemeKey === option.key"
                (click)="selectTheme(option)">
                <div class="theme-card-title">{{ option.label }}</div>
                <div class="theme-card-sub text-muted">{{ option.description }}</div>
              </button>
            </div>
            <div class="onboarding-actions">
              <button class="btn btn-primary" type="button" (click)="goNext()" [disabled]="!selectedThemeKey">Continue</button>
              <button class="btn btn-ghost" type="button" (click)="skip()">Skip for now</button>
            </div>
          </section>

          <section *ngSwitchCase="1" class="onboarding-step">
            <h1 class="text-title center-title">Getting started</h1>
            <ul class="intro-list">
              <li>Small levels. Big change.</li>
              <li>Open -> tap -> level up -> leave.</li>
              <li>Keep the chain alive.</li>
              <li>Your identity grows with repetition.</li>
              <li>Small wins. Real change.</li>
            </ul>
            <div class="onboarding-actions">
              <button class="btn btn-primary" type="button" (click)="goNext()">Next</button>
              <button class="btn btn-ghost" type="button" (click)="skip()">Skip for now</button>
            </div>
          </section>

          <section *ngSwitchCase="2" class="onboarding-step">
            <h1 class="text-title center-title">Choose your persona</h1>
            <p class="text-muted center-subtitle">We'll tailor your tone.</p>
            <label class="text-label why-label" for="name-input">Name</label>
            <input
              id="name-input"
              type="text"
              class="onboarding-input"
              [(ngModel)]="name"
              placeholder="Your name">
            <div class="text-muted helper-text">This is how we’ll address you.</div>
            <div class="text-muted validation-error" *ngIf="showNameError">Name is required.</div>
            <div class="pill-row">
              <button
                class="pill-button"
                type="button"
                *ngFor="let option of personas"
                [class.is-active]="persona === option"
                (click)="persona = option">
                {{ option }}
              </button>
            </div>
            <div class="text-muted validation-error" *ngIf="showPersonaError">Please choose a persona.</div>
            <div class="onboarding-actions split">
              <button class="btn btn-outline" type="button" (click)="goBack()">Back</button>
              <button class="btn btn-primary" type="button" (click)="goNext()" [disabled]="!canProceedPersona">Next</button>
            </div>
          </section>

          <section *ngSwitchCase="3" class="onboarding-step">
            <h1 class="text-title center-title">Your primary goal</h1>
            <p class="text-muted center-subtitle">Pick the focus for your habits.</p>
            <div class="pill-row">
              <button
                class="pill-button"
                type="button"
                *ngFor="let option of goals"
                [class.is-active]="goal === option"
                (click)="goal = option">
                {{ option }}
              </button>
            </div>
            <div class="text-muted validation-error" *ngIf="showGoalError">Please choose a primary goal.</div>
            <label class="text-label why-label" for="statement-input">Why</label>
            <textarea
              id="statement-input"
              class="onboarding-input"
              rows="3"
              [attr.maxlength]="statementLimit"
              [(ngModel)]="statement"
              placeholder="Short reason to stay consistent"></textarea>
            <div class="text-muted validation-error" *ngIf="showStatementError">Why is required (min 3 characters).</div>
            <div class="text-muted char-count">{{ statementLength }}/{{ statementLimit }}</div>
            <div class="onboarding-actions split">
              <button class="btn btn-outline" type="button" (click)="goBack()">Back</button>
              <button class="btn btn-primary" type="button" (click)="goNext()" [disabled]="!canProceedGoal">Finish</button>
            </div>
          </section>

          <section *ngSwitchCase="4" class="onboarding-step final-step">
            <h1 class="text-title center-title">You're all set, {{ displayName }}.</h1>
            <p class="text-muted center-subtitle">The first step to win is to start now.</p>
            <p class="text-muted center-subtitle">{{ personaFinalLine }}</p>
            <p class="text-muted center-subtitle">
              You're all set. Taking the first step is already a win. Keep showing up and you'll feel the shift.
            </p>
            <div class="onboarding-actions">
              <button class="btn btn-primary" type="button" (click)="finish()">Start Today</button>
            </div>
          </section>
        </ng-container>
      </div>
    </div>
  `,
  styleUrls: ['./onboarding.component.sass']
})
export class OnboardingComponent implements OnInit {
  step: OnboardingStep = 0;
  selectedThemeKey: string | null = null;
  themeOptions: ThemeOption[] = [
    { key: 'dark', label: 'Dark', description: 'Focused, low-glare', theme: 'dark' },
    { key: 'light', label: 'Light', description: 'Clean and bright', theme: 'light' },
    { key: 'blue', label: 'Blue', description: 'Light with blue accent', theme: 'light', accent: 'blue' },
    { key: 'mint', label: 'Mint', description: 'Light with mint accent', theme: 'light', accent: 'green' }
  ];
  personas: Array<UserProfile['persona']> = [
    'Developer',
    'Fitness',
    'Student',
    'Creator',
    'Entrepreneur',
    'Leader',
    'Artist',
    'Learner',
    'Athlete',
    'Other'
  ];
  goals: Array<UserProfile['primaryGoal']> = [
    'Build consistency',
    'Improve health & energy',
    'Learn a skill',
    'Boost focus & productivity',
    'Reduce stress & feel calm',
    'Transform lifestyle'
  ];
  persona: UserProfile['persona'] | null = null;
  goal: UserProfile['primaryGoal'] | null = null;
  name = '';
  statement = '';
  readonly statementLimit = 140;
  readonly statementMin = 3;

  constructor(
    private router: Router,
    private habitStore: HabitStoreService,
    private themeService: ThemeService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.habitStore.getReady().pipe(
      filter(ready => ready),
      take(1)
    ).subscribe(() => {
      if (this.habitStore.onboardingCompletedSync()) {
        void this.router.navigate(['/today']);
      }
    });
    const savedThemeKey = this.themeService.getSavedThemeKey();
    if (savedThemeKey) {
      this.selectedThemeKey = savedThemeKey;
      this.step = 1;
    }
  }

  goNext(): void {
    if (this.step < 4) {
      if (this.step === 0 && !this.selectedThemeKey) {
        return;
      }
      if (this.step === 2 && !this.canProceedPersona) {
        return;
      }
      if (this.step === 3 && !this.canProceedGoal) {
        return;
      }
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
    this.ensureThemeSelected();
    this.habitStore.skipOnboarding();
    void this.router.navigate(['/today']);
  }

  finish(): void {
    this.ensureThemeSelected();
    this.saveProfile(this.persona, this.goal, this.statement);
    void this.router.navigate(['/today']);
  }

  selectTheme(option: ThemeOption): void {
    this.selectedThemeKey = option.key;
    this.themeService.setTheme(option.theme, option.key);
    if (option.accent) {
      this.settingsService.updateSettings({ accent: { type: 'preset', value: option.accent } });
    }
  }

  private ensureThemeSelected(): void {
    if (!this.selectedThemeKey) {
      this.selectTheme(this.themeOptions[0]);
    }
  }

  private saveProfile(persona: UserProfile['persona'] | null, goal: UserProfile['primaryGoal'] | null, statement: string): void {
    const trimmedStatement = this.trimStatement(statement);
    const profile: UserProfile = {
      name: this.name.trim(),
      persona: persona ?? 'Developer',
      primaryGoal: goal ?? 'Build consistency',
      statement: trimmedStatement || undefined,
      whyStatement: trimmedStatement || undefined,
      createdAt: Date.now()
    };
    this.habitStore.setUserProfile(profile);
    this.habitStore.completeOnboarding();
  }

  get trimmedName(): string {
    return this.name.trim();
  }

  get nameValid(): boolean {
    return this.trimmedName.length >= 2;
  }

  get personaSelected(): boolean {
    return Boolean(this.persona);
  }

  get canProceedPersona(): boolean {
    return this.nameValid && this.personaSelected;
  }

  get showNameError(): boolean {
    return this.step === 2 && this.trimmedName.length === 0;
  }

  get showPersonaError(): boolean {
    return this.step === 2 && !this.personaSelected && this.trimmedName.length >= 2;
  }

  get goalSelected(): boolean {
    return Boolean(this.goal);
  }

  get statementLength(): number {
    return this.statement.trim().length;
  }

  get canProceedGoal(): boolean {
    return this.goalSelected && this.statementLength >= this.statementMin;
  }

  get showGoalError(): boolean {
    return this.step === 3 && !this.goalSelected;
  }

  get showStatementError(): boolean {
    return this.step === 3 && this.goalSelected && this.statementLength < this.statementMin;
  }

  private trimStatement(value: string): string {
    return value.trim().slice(0, this.statementLimit);
  }

  get displayName(): string {
    return this.trimmedName || 'there';
  }

  get personaFinalLine(): string {
    const persona = this.persona ?? 'Other';
    switch (persona) {
      case 'Developer':
        return 'Ship small. Improve daily. You’ll look back amazed.';
      case 'Fitness':
        return 'Show up. Move. Recover. Repeat.';
      case 'Student':
        return 'One focused session at a time.';
      case 'Entrepreneur':
        return 'Momentum beats perfect. Execute.';
      case 'Creator':
        return 'Create daily. Confidence follows.';
      case 'Leader':
        return 'Lead yourself first.';
      case 'Artist':
        return 'Practice becomes identity.';
      case 'Learner':
        return 'Curiosity wins.';
      case 'Athlete':
        return 'Train the basics.';
      default:
        return 'Start small. Repeat daily. Never miss twice.';
    }
  }
}

// Manual test checklist
// - Splash always shows on refresh/reopen
// - Onboarding shows only once
// - Skip works and still marks onboardingComplete
// - Header never overlaps notch/time
// - After Finish -> Today
// - After app reopen -> Splash -> Today
// - Next disabled until name+persona
// - Persists after refresh
// - Profile shows name+persona later
// - Goal/why required, Finish disabled until valid
// - No negative wording in onboarding copy





