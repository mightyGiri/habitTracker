import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-onboarding-loading-screen',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './onboarding-loading-screen.component.html',
  styleUrl: './onboarding-loading-screen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OnboardingLoadingScreenComponent implements OnInit, OnDestroy {
  private timerId: ReturnType<typeof setTimeout> | null = null;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.timerId = setTimeout(() => {
      void this.router.navigate(['/home']);
    }, 2500);
  }

  ngOnDestroy(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}

