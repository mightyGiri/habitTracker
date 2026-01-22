import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { HabitStoreService } from './services/habit-store.service';
import { ThemeService } from './services/theme.service';
import { routeAnimations } from './shared/route-animations';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSelectModule,
    MatTabsModule,
    MatCardModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    CommonModule,
    FormsModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.sass',
  animations: [routeAnimations]
})
export class App implements OnInit, OnDestroy {
  selectedYear = 2026;
  selectedMonth = 0; // 0 for Jan

  years = [2026, 2027, 2028];
  months = [
    { value: 0, label: 'Jan' },
    { value: 1, label: 'Feb' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Apr' },
    { value: 4, label: 'May' },
    { value: 5, label: 'Jun' },
    { value: 6, label: 'Jul' },
    { value: 7, label: 'Aug' },
    { value: 8, label: 'Sep' },
    { value: 9, label: 'Oct' },
    { value: 10, label: 'Nov' },
    { value: 11, label: 'Dec' }
  ];

  currentTheme: 'dark' | 'light' = 'dark';
  reduceMotion = false;
  showInstallBanner = false;
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private installListener?: (event: Event) => void;

  private subscription: Subscription = new Subscription();

  constructor(private habitStore: HabitStoreService, private themeService: ThemeService) {}

  ngOnInit(): void {
    this.subscription.add(
      this.habitStore.getSelectedMonthYear().subscribe(monthYear => {
        this.selectedYear = monthYear.year;
        this.selectedMonth = monthYear.month;
      })
    );
    this.subscription.add(
      this.themeService.getTheme().subscribe(theme => {
        this.currentTheme = theme;
      })
    );
    this.subscription.add(
      this.themeService.getReducedMotion().subscribe(reduce => {
        this.reduceMotion = reduce;
      })
    );

    if (typeof window !== 'undefined') {
      const dismissed = window.localStorage?.getItem('pwa_install_banner_dismissed') === 'true';
      this.installListener = (event: Event) => {
        event.preventDefault();
        this.deferredPrompt = event as BeforeInstallPromptEvent;
        if (!dismissed && this.isMobileDevice()) {
          this.showInstallBanner = true;
        }
      };
      window.addEventListener('beforeinstallprompt', this.installListener);
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    if (typeof window !== 'undefined' && this.installListener) {
      window.removeEventListener('beforeinstallprompt', this.installListener);
    }
  }

  onYearChange(): void {
    this.habitStore.setSelectedMonthYear(this.selectedYear, this.selectedMonth);
  }

  onMonthChange(): void {
    this.habitStore.setSelectedMonthYear(this.selectedYear, this.selectedMonth);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  installPwa(): void {
    if (!this.deferredPrompt) {
      return;
    }
    void this.deferredPrompt.prompt();
    void this.deferredPrompt.userChoice.then(choice => {
      this.showInstallBanner = false;
      this.deferredPrompt = null;
      if (choice.outcome === 'dismissed') {
        this.dismissInstallBanner();
      }
    });
  }

  dismissInstallBanner(): void {
    this.showInstallBanner = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('pwa_install_banner_dismissed', 'true');
    }
  }

  prepareRoute(outlet: RouterOutlet): string {
    return outlet?.activatedRouteData?.['animation'] || '';
  }

  private isMobileDevice(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia?.('(max-width: 768px)').matches ?? window.innerWidth <= 768;
  }
}
