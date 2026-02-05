import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, filter, take } from 'rxjs';
import { HabitStoreService } from '../../services/habit-store.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="splash" [class.reduce-motion]="reduceMotion" [class.is-fading]="isFadingOut">
      <div class="splash-inner">
        <img class="splash-icon" src="icons/app_icon_192x192.png" alt="Level-Up logo">
        <div class="splash-sub">Level Up every freaking day</div>
      </div>
    </div>
  `,
  styleUrls: ['./splash.component.sass']
})
export class SplashComponent implements OnInit, OnDestroy {
  reduceMotion = false;
  private subscription = new Subscription();
  private delayTimer?: ReturnType<typeof setTimeout>;
  private fadeTimer?: ReturnType<typeof setTimeout>;
  private delayDone = false;
  private readyDone = false;
  private hasNavigated = false;
  isFadingOut = false;

  constructor(
    private habitStore: HabitStoreService,
    private themeService: ThemeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const delay = 3000;
    this.delayTimer = setTimeout(() => {
      this.delayDone = true;
      this.tryNavigate();
    }, delay);
    this.subscription.add(
      this.themeService.getReducedMotion().subscribe(reduce => {
        this.reduceMotion = reduce;
      })
    );
    this.subscription.add(
      this.habitStore.getReady().pipe(
        filter(ready => ready),
        take(1)
      ).subscribe(() => {
        this.readyDone = true;
        this.tryNavigate();
      })
    );
  }

  ngOnDestroy(): void {
    if (this.delayTimer) {
      clearTimeout(this.delayTimer);
    }
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
    }
    this.subscription.unsubscribe();
  }

  private tryNavigate(): void {
    if (this.hasNavigated || !this.delayDone || !this.readyDone) {
      return;
    }
    this.hasNavigated = true;
    this.isFadingOut = true;
    this.fadeTimer = setTimeout(() => {
    void this.router.navigate(['/today']);
  }, this.reduceMotion ? 0 : 400);
  }
}

// Manual test checklist
// - Hard refresh -> splash 3s -> correct landing route
// - Onboarding complete -> splash ~1.2s -> Today
// - Onboarding shows only once
// - Splash uses Shadow Monarch gradient
// - Logo has no white border box
// - Skip works and still marks onboardingComplete
// - Header never overlaps notch/time
// - After Finish -> Today
// - After app reopen -> Splash -> Today
