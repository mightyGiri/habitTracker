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
    <div class="splash-screen" [class.reduce-motion]="reduceMotion" [class.is-fading]="isFadingOut">
      <div class="splash-shell">
        <div class="splash-panel">
          <div class="splash-mark-wrap">
            <div class="splash-mark-glow" aria-hidden="true"></div>
            <img class="splash-icon" src="icons/app_icon_192x192.png" alt="Level-Up logo">
          </div>
          <div class="splash-label">SYSTEM</div>
          <div class="splash-title">Level-Up</div>
          <div class="splash-sub">Preparing your next session</div>
        </div>
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
    const delay = 2200;
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
    const target = this.habitStore.onboardingCompletedSync() ? '/today' : '/getting-started';
    this.fadeTimer = setTimeout(() => {
      void this.router.navigate([target]);
    }, this.reduceMotion ? 0 : 350);
  }
}
