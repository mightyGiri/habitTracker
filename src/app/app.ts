import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { HabitStoreService } from './services/habit-store.service';
import { ThemeService } from './services/theme.service';
import { routeAnimations } from './shared/route-animations';
import { BottomNavComponent } from './shared/bottom-nav/bottom-nav.component';
import { NotificationService } from './services/notification.service';
import { NotificationPermissionService } from './services/notification-permission.service';
import { TabStateService } from './services/tab-state.service';
import { SoundService } from './services/sound.service';
import { environment } from '../environments/environment';

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
    MatIconModule,
    MatMenuModule,
    BottomNavComponent,
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

  reduceMotion = false;
  pageTitle = 'Today';
  showChrome = true;

  private subscription: Subscription = new Subscription();

  constructor(
    private habitStore: HabitStoreService,
    private themeService: ThemeService,
    private router: Router,
    private notificationService: NotificationService,
    private notificationPermissionService: NotificationPermissionService,
    private soundService: SoundService,
    private tabState: TabStateService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    console.log(`App Version ${environment.appVersion} (Build ${environment.buildNumber})`);
    this.enforceDarkTheme();
    this.subscription.add(
      this.habitStore.getSelectedMonthYear().subscribe(monthYear => {
        this.selectedYear = monthYear.year;
        this.selectedMonth = monthYear.month;
      })
    );
    this.subscription.add(
      this.themeService.getReducedMotion().subscribe(reduce => {
        this.reduceMotion = reduce;
      })
    );
    this.subscription.add(
      this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => {
        this.pageTitle = this.getTitleFromUrl(this.router.url);
        this.showChrome = !this.isSplashOrOnboarding(this.router.url);
        this.tabState.setCurrentTab(this.getTabFromUrl(this.router.url));
      })
    );
    this.pageTitle = this.getTitleFromUrl(this.router.url);
    this.showChrome = !this.isSplashOrOnboarding(this.router.url);
    this.tabState.setCurrentTab(this.getTabFromUrl(this.router.url));
    this.notificationService.init();
    this.soundService.init();
    if (this.notificationService.isNativeSchedulingAvailable()) {
      void this.notificationPermissionService.ensurePermission(false);
    }
    if (this.notificationService.isEnabled()) {
      void this.notificationService.resyncForToday();
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.notificationService.dispose();
  }

  onYearChange(): void {
    this.habitStore.setSelectedMonthYear(this.selectedYear, this.selectedMonth);
  }

  onMonthChange(): void {
    this.habitStore.setSelectedMonthYear(this.selectedYear, this.selectedMonth);
  }

  prepareRoute(outlet: RouterOutlet): string {
    return outlet?.activatedRouteData?.['animation'] || '';
  }

  private getTitleFromUrl(url: string): string {
    if (url.startsWith('/overview')) return 'Overview';
    if (url.startsWith('/habits')) return 'Habits';
    if (url.startsWith('/profile')) return 'Profile';
    return 'Today';
  }

  private isSplashOrOnboarding(url: string): boolean {
    return url.startsWith('/splash')
      || url.startsWith('/onboarding')
      || url.startsWith('/getting-started')
      || url.startsWith('/welcome')
      || url.includes('setup');
  }

  private getTabFromUrl(url: string): string {
    if (url.startsWith('/overview')) return 'overview';
    if (url.startsWith('/habits')) return 'habits';
    if (url.startsWith('/profile')) return 'profile';
    return 'today';
  }

  private enforceDarkTheme(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.remove('light-theme');
    document.documentElement.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
  }

}
