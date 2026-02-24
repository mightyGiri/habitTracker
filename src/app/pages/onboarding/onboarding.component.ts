import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, Subscription, take } from 'rxjs';
import { HabitStoreService } from '../../services/habit-store.service';
import { ThemeService } from '../../services/theme.service';
import { UserProfile } from '../../models/habit.model';

type WizardStep = 0 | 1 | 2 | 3;
type OnboardingView = 'intro' | 'wizard' | 'loading';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container onboarding-flow" [class.reduce-motion]="reduceMotion">
      <div class="onboarding-shell">
        <ng-container [ngSwitch]="view">
          <section *ngSwitchCase="'intro'" class="intro-screen panel-screen">
            <div class="intro-mark-wrap">
              <div class="intro-mark-glow" aria-hidden="true"></div>
              <img class="intro-mark" src="icons/app_icon_192x192.png" alt="Level-Up logo">
            </div>
            <div class="intro-copy cinematic-panel">
              <div class="kicker-label">SYSTEM</div>
              <h1 class="hero-title">Level up every day.</h1>
              <p class="hero-subtitle">Build habits, earn XP, and improve daily, one checkbox at a time.</p>
              <ul class="benefit-list">
                <li class="benefit-item">Track today in seconds</li>
                <li class="benefit-item">Gain XP and level up</li>
                <li class="benefit-item">See streaks and progress</li>
              </ul>
              <div class="cta-stack">
                <button class="btn btn-primary cta-primary" type="button" (click)="goToWizard()">
                  Get Started
                </button>
                <button class="btn btn-ghost cta-secondary" type="button" (click)="skipSetup()">
                  Skip setup
                </button>
              </div>
            </div>
          </section>

          <section *ngSwitchCase="'wizard'" class="wizard-screen panel-screen">
            <div class="wizard-progress-wrap" aria-hidden="true">
              <div class="wizard-progress-track">
                <div class="wizard-progress-fill" [style.width.%]="wizardProgressPercent"></div>
              </div>
              <div class="wizard-progress-label text-muted">Step {{ step + 1 }} / 4</div>
            </div>

            <div class="wizard-card cinematic-panel" *ngIf="step === 0">
              <div class="kicker-label">Step 1</div>
              <h1 class="hero-title">What should we call you?</h1>
              <p class="hero-subtitle">This is the name shown on your dashboard.</p>
              <label class="field-label" for="wizard-name">Name</label>
              <input
                id="wizard-name"
                type="text"
                class="onboarding-input"
                [(ngModel)]="name"
                maxlength="20"
                placeholder="Your name">
              <div class="validation-error" *ngIf="showNameErrorStepOne">Enter at least 2 characters.</div>
              <div class="wizard-actions">
                <button class="btn btn-primary cta-primary" type="button" (click)="nextStep()" [disabled]="!isNameStepValid">
                  Next
                </button>
              </div>
            </div>

            <div class="wizard-card cinematic-panel" *ngIf="step === 1">
              <div class="kicker-label">Step 2</div>
              <h1 class="hero-title">Choose your focus</h1>
              <p class="hero-subtitle">Pick the direction you want your habits to support.</p>
              <div class="goal-grid">
                <button
                  type="button"
                  class="goal-option"
                  *ngFor="let option of wizardGoals"
                  [class.is-active]="goalChoice === option"
                  (click)="selectGoal(option)">
                  {{ option }}
                </button>
              </div>
              <div class="custom-goal-wrap" *ngIf="goalChoice === 'Custom'">
                <label class="field-label" for="custom-goal">Custom goal</label>
                <input
                  id="custom-goal"
                  type="text"
                  class="onboarding-input"
                  [(ngModel)]="customGoal"
                  maxlength="40"
                  placeholder="Your custom goal">
              </div>
              <div class="validation-error" *ngIf="showGoalErrorStepTwo">Choose a goal to continue.</div>
              <div class="wizard-actions split">
                <button class="btn btn-outline" type="button" (click)="prevStep()">Back</button>
                <button class="btn btn-primary cta-primary compact" type="button" (click)="nextStep()" [disabled]="!isGoalStepValid">
                  Next
                </button>
              </div>
            </div>

            <div class="wizard-card cinematic-panel" *ngIf="step === 2">
              <div class="kicker-label">Step 3</div>
              <h1 class="hero-title">Why are you doing this?</h1>
              <p class="hero-subtitle">Optional, but useful when motivation drops.</p>
              <label class="field-label" for="why-line">Why (optional)</label>
              <textarea
                id="why-line"
                class="onboarding-input"
                rows="3"
                [attr.maxlength]="statementLimit"
                [(ngModel)]="statement"
                placeholder="One line reason (optional)"></textarea>
              <div class="char-count">{{ statementLength }}/{{ statementLimit }}</div>
              <div class="wizard-actions split">
                <button class="btn btn-outline" type="button" (click)="prevStep()">Back</button>
                <button class="btn btn-primary cta-primary compact" type="button" (click)="nextStep()">Next</button>
              </div>
            </div>

            <div class="wizard-card cinematic-panel" *ngIf="step === 3">
              <div class="kicker-label">Step 4</div>
              <h1 class="hero-title">Confirm your setup</h1>
              <p class="hero-subtitle">You can change this later in Profile.</p>
              <div class="summary-card">
                <div class="summary-row">
                  <span class="summary-key">Name</span>
                  <span class="summary-value">{{ trimmedName || 'Player' }}</span>
                </div>
                <div class="summary-row">
                  <span class="summary-key">Goal</span>
                  <span class="summary-value">{{ resolvedGoal }}</span>
                </div>
                <div class="summary-row" *ngIf="trimmedStatement">
                  <span class="summary-key">Why</span>
                  <span class="summary-value summary-why">{{ trimmedStatement }}</span>
                </div>
              </div>
              <div class="wizard-actions split">
                <button class="btn btn-outline" type="button" (click)="prevStep()">Back</button>
                <button class="btn btn-primary cta-primary compact" type="button" (click)="finish()">
                  Finish
                </button>
              </div>
            </div>

            <div class="wizard-footer">
              <button class="btn btn-ghost cta-secondary" type="button" (click)="skipSetup()">Skip setup</button>
            </div>
          </section>

          <section *ngSwitchCase="'loading'" class="loading-screen panel-screen" aria-live="polite">
            <div class="loading-shell cinematic-panel">
              <div class="aura-stage" aria-hidden="true">
                <div class="aura-ring aura-ring-one"></div>
                <div class="aura-ring aura-ring-two"></div>
                <div class="silhouette-core"></div>
                <div class="silhouette-shape"></div>
              </div>
              <div class="loading-title">Let’s level up...</div>
              <div class="loading-subtitle">Preparing your journey</div>
            </div>
          </section>
        </ng-container>
      </div>
    </div>
  `,
  styleUrls: ['./onboarding.component.sass']
})
export class OnboardingComponent implements OnInit, OnDestroy {
  view: OnboardingView = 'intro';
  step: WizardStep = 0;
  reduceMotion = false;

  name = '';
  goalChoice: string | null = null;
  customGoal = '';
  statement = '';

  readonly statementLimit = 140;
  readonly wizardGoals = ['Fitness', 'Productivity', 'Mindset', 'Health', 'Custom'] as const;

  private readonly subscriptions = new Subscription();
  private loadingTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private habitStore: HabitStoreService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.setTheme('dark');
    this.subscriptions.add(
      this.themeService.getReducedMotion().subscribe(reduce => {
        this.reduceMotion = reduce;
      })
    );
    this.setViewFromRoute();
    this.subscriptions.add(
      this.habitStore.getReady().pipe(filter(ready => ready), take(1)).subscribe(() => {
        if (this.habitStore.onboardingCompletedSync()) {
          void this.router.navigate(['/today']);
          return;
        }
        this.prefillFromExistingProfile();
      })
    );
  }

  ngOnDestroy(): void {
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
    }
    this.subscriptions.unsubscribe();
  }

  private setViewFromRoute(): void {
    const path = this.route.snapshot.routeConfig?.path || '';
    this.view = path === 'getting-started' ? 'intro' : 'wizard';
    this.step = 0;
  }

  private prefillFromExistingProfile(): void {
    const existing = this.habitStore.getUserProfileSync();
    if (!existing) {
      return;
    }
    if (!this.name && typeof existing.name === 'string') {
      this.name = existing.name;
    }
    const existingGoal = (existing.primaryGoal || '').trim();
    if (existingGoal) {
      if (this.wizardGoals.includes(existingGoal as (typeof this.wizardGoals)[number])) {
        this.goalChoice = existingGoal;
      } else {
        this.goalChoice = 'Custom';
        this.customGoal = existingGoal;
      }
    }
    const why = (existing.whyStatement || existing.statement || existing.why || '').trim();
    if (!this.statement && why) {
      this.statement = why.slice(0, this.statementLimit);
    }
  }

  goToWizard(): void {
    this.themeService.setTheme('dark');
    void this.router.navigate(['/onboarding']);
  }

  skipSetup(): void {
    this.themeService.setTheme('dark');
    this.habitStore.skipOnboarding();
    void this.router.navigate(['/today']);
  }

  nextStep(): void {
    if (this.step === 0 && !this.isNameStepValid) {
      return;
    }
    if (this.step === 1 && !this.isGoalStepValid) {
      return;
    }
    if (this.step >= 3) {
      this.finish();
      return;
    }
    this.step = (this.step + 1) as WizardStep;
  }

  prevStep(): void {
    if (this.step > 0) {
      this.step = (this.step - 1) as WizardStep;
    }
  }

  selectGoal(option: (typeof this.wizardGoals)[number]): void {
    this.goalChoice = option;
    if (option !== 'Custom') {
      this.customGoal = '';
    }
  }

  finish(): void {
    if (!this.isNameStepValid || !this.isGoalStepValid) {
      return;
    }
    this.themeService.setTheme('dark');
    const existing = this.habitStore.getUserProfileSync();
    const trimmedWhy = this.trimmedStatement || undefined;
    const profile: UserProfile = {
      name: this.trimmedName || 'Player',
      persona: existing?.persona,
      primaryGoal: this.resolvedGoal,
      statement: trimmedWhy,
      whyStatement: trimmedWhy,
      why: trimmedWhy,
      createdAt: existing?.createdAt ?? Date.now()
    };
    this.habitStore.setUserProfile(profile);
    this.habitStore.completeOnboarding();
    this.startLoadingTransition();
  }

  private startLoadingTransition(): void {
    this.view = 'loading';
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
    }
    this.loadingTimer = setTimeout(() => {
      void this.router.navigate(['/today']);
    }, this.reduceMotion ? 1200 : 1500);
  }

  get wizardProgressPercent(): number {
    return ((this.step + 1) / 4) * 100;
  }

  get trimmedName(): string {
    return this.name.trim();
  }

  get isNameStepValid(): boolean {
    return this.trimmedName.length >= 2;
  }

  get showNameErrorStepOne(): boolean {
    return this.step === 0 && this.trimmedName.length > 0 && !this.isNameStepValid;
  }

  get trimmedCustomGoal(): string {
    return this.customGoal.trim();
  }

  get isGoalStepValid(): boolean {
    if (!this.goalChoice) {
      return false;
    }
    if (this.goalChoice === 'Custom') {
      return this.trimmedCustomGoal.length >= 2;
    }
    return true;
  }

  get showGoalErrorStepTwo(): boolean {
    return this.step === 1 && !!this.goalChoice && !this.isGoalStepValid;
  }

  get trimmedStatement(): string {
    return this.statement.trim().slice(0, this.statementLimit);
  }

  get statementLength(): number {
    return this.trimmedStatement.length;
  }

  get resolvedGoal(): string {
    if (this.goalChoice === 'Custom') {
      return this.trimmedCustomGoal || 'Custom';
    }
    return this.goalChoice || 'Build consistency';
  }
}
