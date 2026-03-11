import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { filter, Subscription, take } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
import { HabitStoreService } from '../../services/habit-store.service';
import { ThemeService } from '../../services/theme.service';
import { DomainConfig, HabitDomain } from '../../models/habit.model';
import { DOMAINS } from '../../config/domains.config';
import { HABIT_TEMPLATES, HabitTemplate } from '../../config/habit-templates.config';

type Step = 0 | 1 | 2 | 3 | 4;

const fadeSlide = trigger('fadeSlide', [
  transition('* => *', [
    style({ opacity: 0, transform: 'translateY(16px)' }),
    animate('280ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
  ])
]);

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule],
  animations: [fadeSlide],
  template: `
<div class="onboarding-root" [class.reduce-motion]="reduceMotion">

  <!-- Floating particles — step 0 only -->
  @if (step === 0) {
    <div class="particles-layer" aria-hidden="true">
      @for (p of particles; track $index) {
        <span class="particle"
          [style.left.%]="p.left"
          [style.animation-duration.s]="p.duration"
          [style.animation-delay.s]="p.delay"
          [style.width.px]="p.size"
          [style.height.px]="p.size">
        </span>
      }
    </div>
  }

  <!-- Progress bar — steps 1–3 -->
  @if (step >= 1 && step <= 3) {
    <div class="ob-progress-bar" aria-hidden="true">
      <div class="ob-progress-fill" [style.width.%]="progressPercent"></div>
    </div>
  }

  <!-- Main panel -->
  <div class="system-panel" [@fadeSlide]="step">

    <!-- ── STEP 0: INTRO ──────────────────────────────────────── -->
    @if (step === 0) {
      <div class="step-intro">
        <div class="intro-icon-wrap">
          <div class="intro-icon-glow" aria-hidden="true"></div>
          <img class="intro-icon" src="icons/app_icon_192x192.png" alt="LetsLevelUp">
        </div>
        <div class="system-notification-label">SYSTEM NOTIFICATION</div>
        <h1 class="intro-title">The System Has<br>Chosen You</h1>
        <p class="intro-sub">Your journey to become the strongest begins now.</p>
        <button class="btn-system" type="button" (click)="goStep(1)">
          BEGIN INITIALIZATION →
        </button>
        <button class="btn-ghost-link" type="button" (click)="skipSetup()">
          Skip setup
        </button>
      </div>
    }

    <!-- ── STEP 1: NAME ───────────────────────────────────────── -->
    @if (step === 1) {
      <div class="step-inner">
        <div class="step-label">SYSTEM · STEP 01 / 03</div>
        <h2 class="step-title">What shall we call you, Hunter?</h2>
        <p class="step-sub">This name appears on your dashboard and profile.</p>
        <div class="input-wrap">
          <input
            class="system-input"
            type="text"
            [(ngModel)]="name"
            maxlength="20"
            placeholder="Enter your Hunter name..."
            autocomplete="name"
            (keydown.enter)="tryNextStep()">
          <span class="char-count" [class.near-limit]="name.length >= 16">{{ name.length }} / 20</span>
        </div>
        @if (showError && name.trim().length < 2) {
          <div class="field-error">⚠ Hunter name must be at least 2 characters.</div>
        }
        <div class="step-actions">
          <button class="btn-back" type="button" (click)="goStep(0)">← Back</button>
          <button class="btn-system btn-system--compact" type="button" (click)="tryNextStep()">
            Next →
          </button>
        </div>
        <div class="footer-skip">
          <button class="btn-ghost-link" type="button" (click)="skipSetup()">Skip setup</button>
        </div>
      </div>
    }

    <!-- ── STEP 2: DOMAINS ────────────────────────────────────── -->
    @if (step === 2) {
      <div class="step-inner">
        <div class="step-label">SYSTEM · STEP 02 / 03</div>
        <h2 class="step-title">Choose Your Domains</h2>
        <p class="step-sub">Select 1–3 domains to focus on. Each domain levels up independently.</p>

        <div class="domain-grid">
          @for (d of DOMAINS; track d.id) {
            <button
              class="domain-card"
              type="button"
              [class.selected]="selectedDomains.includes(d.id)"
              [class.dimmed]="selectedDomains.length >= 3 && !selectedDomains.includes(d.id)"
              [style.border-color]="selectedDomains.includes(d.id) ? d.color : null"
              [style.box-shadow]="selectedDomains.includes(d.id) ? '0 0 20px ' + d.glowColor + ', inset 0 0 0 1px ' + d.glowColor : null"
              (click)="toggleDomain(d.id)">
              @if (selectedDomains.includes(d.id)) {
                <div class="domain-card__check" [style.color]="d.color">✓</div>
              }
              <div class="domain-card__emoji">{{ d.emoji }}</div>
              <div class="domain-card__label" [style.color]="selectedDomains.includes(d.id) ? d.color : null">{{ d.label }}</div>
              <div class="domain-card__desc">{{ d.description }}</div>
            </button>
          }
        </div>

        @if (selectedDomains.length > 0) {
          <div class="domain-count-hint">{{ selectedDomains.length }} / 3 domains selected</div>
        }
        @if (showError && selectedDomains.length === 0) {
          <div class="field-error">⚠ Select at least one domain to continue.</div>
        }

        <div class="step-actions">
          <button class="btn-back" type="button" (click)="goStep(1)">← Back</button>
          <button class="btn-system btn-system--compact" type="button" (click)="tryNextStep()">Next →</button>
        </div>
        <div class="footer-skip">
          <button class="btn-ghost-link" type="button" (click)="skipToComplete()">Skip — add habits later</button>
        </div>
      </div>
    }

    <!-- ── STEP 3: TEMPLATES ──────────────────────────────────── -->
    @if (step === 3) {
      <div class="step-inner">
        <div class="step-label">SYSTEM · STEP 03 / 03</div>
        <h2 class="step-title">Load Starter Habits</h2>
        <p class="step-sub">Pick habits to add instantly. You can always customize later.</p>

        <div class="domain-tabs">
          <button class="domain-tab" type="button"
            [class.active]="activeFilterDomain === 'all'"
            (click)="setFilter('all')">All</button>
          @for (domainId of selectedDomains; track domainId) {
            <button class="domain-tab" type="button"
              [class.active]="activeFilterDomain === domainId"
              [style.color]="activeFilterDomain === domainId ? getDomainColor(domainId) : null"
              [style.border-color]="activeFilterDomain === domainId ? getDomainColor(domainId) : null"
              (click)="setFilter(domainId)">
              {{ getDomainEmoji(domainId) }} {{ getDomainLabel(domainId) }}
            </button>
          }
        </div>

        <div class="template-list">
          @for (tpl of visibleTemplates; track tpl.id) {
            <button
              class="template-item"
              type="button"
              [class.selected]="selectedTemplateIds.has(tpl.id)"
              [style.border-left-color]="selectedTemplateIds.has(tpl.id) ? getDomainColor(tpl.domain) : null"
              (click)="toggleTemplate(tpl.id)">
              <span class="tpl-icon">{{ tpl.icon }}</span>
              <span class="tpl-info">
                <span class="tpl-name">{{ tpl.name }}</span>
                <span class="tpl-meta">
                  <span class="diff-badge diff-{{ tpl.difficulty }}">{{ tpl.difficulty }}</span>
                  <span class="tpl-freq">{{ tpl.frequencyType === 'weekly' ? (tpl.weeklyTarget + 'x/wk') : 'daily' }}</span>
                  @if (tpl.timerEnabled && tpl.timerSeconds) {
                    <span class="tpl-timer">⏱ {{ formatTimer(tpl.timerSeconds) }}</span>
                  }
                </span>
              </span>
              @if (selectedTemplateIds.has(tpl.id)) {
                <span class="tpl-check" [style.color]="getDomainColor(tpl.domain)">✓</span>
              }
            </button>
          }
        </div>

        @if (selectedTemplateIds.size > 0) {
          <div class="selected-count">
            {{ selectedTemplateIds.size }} habit{{ selectedTemplateIds.size !== 1 ? 's' : '' }} selected
          </div>
        }

        <div class="step-actions step-actions--top-margin">
          <button class="btn-back" type="button" (click)="goStep(2)">← Back</button>
          <button class="btn-system btn-system--compact" type="button" (click)="goToComplete()">
            Initialize System →
          </button>
        </div>
        <div class="footer-skip">
          <button class="btn-ghost-link" type="button" (click)="skipToComplete()">Skip — no starter habits</button>
        </div>
      </div>
    }

    <!-- ── STEP 4: COMPLETE ───────────────────────────────────── -->
    @if (step === 4) {
      <div class="step-complete">
        <div class="complete-rings" aria-hidden="true">
          <div class="complete-ring complete-ring--1"></div>
          <div class="complete-ring complete-ring--2"></div>
        </div>
        <div class="complete-system-label">SYSTEM INITIALIZED</div>
        <h2 class="complete-title">Welcome, {{ displayName }}.</h2>
        <p class="complete-sub">Your journey begins now.</p>

        @if (selectedDomains.length > 0) {
          <div class="complete-domains">
            @for (id of selectedDomains; track id) {
              <span class="complete-domain-pill"
                [style.border-color]="getDomainColor(id)"
                [style.color]="getDomainColor(id)"
                [style.box-shadow]="'0 0 10px ' + getDomainGlow(id)">
                {{ getDomainEmoji(id) }} {{ getDomainLabel(id) }}
              </span>
            }
          </div>
        }

        @if (selectedTemplateIds.size > 0) {
          <div class="complete-habits-count">
            {{ selectedTemplateIds.size }} habit{{ selectedTemplateIds.size !== 1 ? 's' : '' }} loaded to your System
          </div>
        }

        <div class="complete-bar-track" aria-hidden="true">
          <div class="complete-bar-fill" [style.width.%]="completionPercent"></div>
        </div>
        <div class="complete-bar-label">{{ completionPercent }}%</div>

        @if (completionPercent >= 100 && !isCompleting) {
          <button class="btn-system" type="button" (click)="finalize()">
            ENTER THE SYSTEM →
          </button>
        }
      </div>
    }

  </div><!-- /system-panel -->
</div><!-- /onboarding-root -->
  `,
  styleUrls: ['./onboarding.component.sass']
})
export class OnboardingComponent implements OnInit, OnDestroy {
  step: Step = 0;
  reduceMotion = false;

  name = '';
  selectedDomains: HabitDomain[] = [];
  selectedTemplateIds = new Set<string>();
  activeFilterDomain: HabitDomain | 'all' = 'all';
  showError = false;
  isCompleting = false;
  completionPercent = 0;

  readonly DOMAINS: DomainConfig[] = DOMAINS;

  readonly particles = Array.from({ length: 20 }, () => ({
    left: Math.random() * 100,
    duration: 5 + Math.random() * 15,
    delay: -(Math.random() * 20),
    size: 1 + Math.random() * 2
  }));

  private completionTimer: ReturnType<typeof setInterval> | null = null;
  private navTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly subscriptions = new Subscription();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private habitStore: HabitStoreService,
    private themeService: ThemeService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.themeService.getReducedMotion().subscribe(r => { this.reduceMotion = r; })
    );
    this.subscriptions.add(
      this.habitStore.getReady().pipe(filter(r => r), take(1)).subscribe(() => {
        if (this.habitStore.onboardingCompletedSync()) {
          void this.router.navigate(['/today']);
          return;
        }
        this.prefillFromExistingProfile();
      })
    );
    const path = this.route.snapshot.routeConfig?.path || '';
    if (path === 'getting-started') {
      this.step = 0;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.completionTimer) clearInterval(this.completionTimer);
    if (this.navTimer) clearTimeout(this.navTimer);
  }

  private prefillFromExistingProfile(): void {
    const existing = this.habitStore.getUserProfileSync();
    if (!existing) return;
    if (!this.name && typeof existing.name === 'string') {
      this.name = existing.name;
    }
  }

  // ── Navigation ────────────────────────────────────────────────

  goStep(n: number): void {
    this.showError = false;
    this.step = n as Step;
  }

  tryNextStep(): void {
    this.showError = false;
    if (this.step === 1) {
      if (this.name.trim().length < 2) { this.showError = true; return; }
      this.goStep(2);
    } else if (this.step === 2) {
      if (this.selectedDomains.length === 0) { this.showError = true; return; }
      this.goStep(3);
    }
  }

  skipToComplete(): void {
    this.showError = false;
    this.goToComplete();
  }

  goToComplete(): void {
    this.step = 4;
    this.startCompletionBar();
  }

  skipSetup(): void {
    this.habitStore.skipOnboarding();
    void this.router.navigate(['/today']);
  }

  // ── Domain selection ──────────────────────────────────────────

  toggleDomain(id: HabitDomain): void {
    if (this.selectedDomains.includes(id)) {
      this.selectedDomains = this.selectedDomains.filter(d => d !== id);
    } else if (this.selectedDomains.length < 3) {
      this.selectedDomains = [...this.selectedDomains, id];
    }
  }

  // ── Template selection ────────────────────────────────────────

  setFilter(domain: HabitDomain | 'all'): void {
    this.activeFilterDomain = domain;
  }

  toggleTemplate(id: string): void {
    const next = new Set(this.selectedTemplateIds);
    next.has(id) ? next.delete(id) : next.add(id);
    this.selectedTemplateIds = next;
  }

  get visibleTemplates(): HabitTemplate[] {
    const pool = this.selectedDomains.length > 0
      ? HABIT_TEMPLATES.filter(t => this.selectedDomains.includes(t.domain))
      : HABIT_TEMPLATES;
    return this.activeFilterDomain === 'all'
      ? pool
      : pool.filter(t => t.domain === this.activeFilterDomain);
  }

  // ── Domain helpers ────────────────────────────────────────────

  getDomainColor(id: HabitDomain): string {
    return DOMAINS.find(d => d.id === id)?.color ?? '#3d7fff';
  }

  getDomainGlow(id: HabitDomain): string {
    return DOMAINS.find(d => d.id === id)?.glowColor ?? 'rgba(61,127,255,0.25)';
  }

  getDomainLabel(id: HabitDomain): string {
    return DOMAINS.find(d => d.id === id)?.label ?? id;
  }

  getDomainEmoji(id: HabitDomain): string {
    return DOMAINS.find(d => d.id === id)?.emoji ?? '✦';
  }

  // ── Completion ────────────────────────────────────────────────

  get displayName(): string {
    return this.name.trim() || 'Hunter';
  }

  get progressPercent(): number {
    return ((this.step - 1) / 3) * 100;
  }

  startCompletionBar(): void {
    this.completionPercent = 0;
    if (this.completionTimer) clearInterval(this.completionTimer);
    this.completionTimer = setInterval(() => {
      this.completionPercent = Math.min(100, this.completionPercent + 2);
      this.cdr.detectChanges();
      if (this.completionPercent >= 100) {
        clearInterval(this.completionTimer!);
        this.completionTimer = null;
      }
    }, 40);
  }

  finalize(): void {
    if (this.isCompleting) return;
    this.isCompleting = true;

    const trimmedName = this.name.trim() || 'Hunter';
    const existing = this.habitStore.getUserProfileSync();
    this.habitStore.setUserProfile({
      name: trimmedName,
      persona: existing?.persona,
      primaryGoal: existing?.primaryGoal,
      statement: existing?.statement,
      whyStatement: existing?.whyStatement,
      why: existing?.why,
      createdAt: existing?.createdAt ?? Date.now()
    });

    for (const templateId of this.selectedTemplateIds) {
      const tpl = HABIT_TEMPLATES.find(t => t.id === templateId);
      if (tpl) {
        this.habitStore.addHabit(
          tpl.name, tpl.frequencyType, tpl.weeklyTarget, '', 30,
          tpl.timerEnabled, tpl.timerSeconds ?? 0, true, tpl.difficulty, tpl.domain, tpl.icon
        );
      }
    }

    this.habitStore.completeOnboarding();
    this.navTimer = setTimeout(() => void this.router.navigate(['/today']), 600);
  }

  // ── Utils ─────────────────────────────────────────────────────

  formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
}
