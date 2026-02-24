import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { filter, take } from 'rxjs';
import { HabitStoreService } from '../../services/habit-store.service';
import { ThemeService } from '../../services/theme.service';
import { UserProfile } from '../../models/habit.model';

type OnboardingStep = 0 | 1 | 2 | 3;

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container onboarding">
      <div class="onboarding-shell">
        <ng-container [ngSwitch]="step">
          <section *ngSwitchCase="0" class="onboarding-step">
            <div class="quick-setup-card aesthetic-card arcane-card">
              <div class="quick-setup-inner">
                <h1 class="text-title center-title">Quick setup</h1>
                <p class="text-muted center-subtitle">Start fast. Personalize anytime.</p>

                <label class="text-label why-label" for="quick-name-input">Display name</label>
                <input
                  id="quick-name-input"
                  type="text"
                  class="onboarding-input"
                  [(ngModel)]="name"
                  maxlength="20"
                  placeholder="Your name">
                <div class="text-muted validation-error" *ngIf="showQuickNameError">Name is required (min 2 characters).</div>

                <label class="text-label why-label" for="daily-target-input">Daily habit target</label>
                <input
                  id="daily-target-input"
                  type="number"
                  class="onboarding-input"
                  [(ngModel)]="dailyTarget"
                  min="1"
                  max="12"
                  (ngModelChange)="onDailyTargetChange($event)">
                <div class="text-muted helper-text">Choose 1-12 habits per day (recommended: 5).</div>

                <label class="toggle-row" for="reminders-input">
                  <span class="text-label">Reminders</span>
                  <input
                    id="reminders-input"
                    type="checkbox"
                    [(ngModel)]="remindersEnabled">
                </label>

                <div class="onboarding-actions quick-actions">
                  <button class="btn btn-primary" type="button" (click)="startNow()" [disabled]="!canStartQuick">
                    Start Now
                  </button>
                  <button class="btn btn-outline" type="button" (click)="personalize()" [disabled]="!canStartQuick">
                    Personalize
                  </button>
                </div>
                <button class="btn btn-ghost skip-link" type="button" (click)="skip()">Skip</button>
              </div>
            </div>
          </section>

          <section *ngSwitchCase="1" class="onboarding-step">
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
              <button class="btn btn-primary" type="button" (click)="goNext()" [disabled]="!canProceedPersona">Continue</button>
            </div>
          </section>

          <section *ngSwitchCase="2" class="onboarding-step">
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

          <section *ngSwitchCase="3" class="onboarding-step final-step">
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
  dailyTarget = 5;
  remindersEnabled = false;
  statement = '';
  readonly statementLimit = 140;
  readonly statementMin = 3;

  constructor(
    private router: Router,
    private habitStore: HabitStoreService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.setTheme('dark');
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
    if (this.step < 3) {
      if (this.step === 0 && !this.canStartQuick) {
        return;
      }
      if (this.step === 1 && !this.canProceedPersona) {
        return;
      }
      if (this.step === 2 && !this.canProceedGoal) {
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
    this.name = 'Player';
    this.dailyTarget = 5;
    this.remindersEnabled = false;
    this.completeAndGoToday('skip');
  }

  finish(): void {
    this.themeService.setTheme('dark');
    this.saveQuickSetup();
    this.saveProfile(this.persona, this.goal, this.statement);
    void this.router.navigate(['/today']);
  }

  startNow(): void {
    if (!this.canStartQuick) {
      return;
    }
    this.completeAndGoToday('complete');
  }

  personalize(): void {
    if (!this.canStartQuick) {
      return;
    }
    this.themeService.setTheme('dark');
    this.saveQuickSetup();
    this.step = 1;
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

  get canStartQuick(): boolean {
    return this.trimmedName.length >= 2;
  }

  get showQuickNameError(): boolean {
    return this.step === 0 && this.trimmedName.length > 0 && this.trimmedName.length < 2;
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
    return this.step === 1 && this.trimmedName.length === 0;
  }

  get showPersonaError(): boolean {
    return this.step === 1 && !this.personaSelected && this.trimmedName.length >= 2;
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
    return this.step === 2 && !this.goalSelected;
  }

  get showStatementError(): boolean {
    return this.step === 2 && this.goalSelected && this.statementLength < this.statementMin;
  }

  private trimStatement(value: string): string {
    return value.trim().slice(0, this.statementLimit);
  }

  onDailyTargetChange(value: number | string): void {
    this.dailyTarget = this.clampDailyTarget(value);
  }

  private clampDailyTarget(value: number | string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 5;
    }
    return Math.max(1, Math.min(12, Math.round(parsed)));
  }

  private saveQuickSetup(): void {
    const displayName = this.trimmedName || 'Player';
    const dailyWinTarget = this.clampDailyTarget(this.dailyTarget);
    const remindersEnabled = Boolean(this.remindersEnabled);

    this.habitStore.updateProfileSettings({
      displayName,
      dailyWinTarget,
      remindersEnabled
    });

    const existing = this.habitStore.getUserProfileSync();
    this.habitStore.setUserProfile({
      name: displayName,
      persona: existing?.persona,
      primaryGoal: existing?.primaryGoal,
      statement: existing?.statement,
      whyStatement: existing?.whyStatement,
      why: existing?.why,
      createdAt: existing?.createdAt ?? Date.now()
    });
  }

  private completeAndGoToday(mode: 'skip' | 'complete'): void {
    this.themeService.setTheme('dark');
    this.saveQuickSetup();
    if (mode === 'skip') {
      this.habitStore.skipOnboarding();
    } else {
      this.habitStore.completeOnboarding();
    }
    void this.router.navigate(['/today']);
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





