import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { HabitStoreService } from './services/habit-store.service';
import { ThemeService } from './services/theme.service';
import { routeAnimations } from './shared/route-animations';
import { BottomNavComponent } from './shared/bottom-nav/bottom-nav.component';
import { SettingsService } from './services/settings.service';

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

  currentTheme: 'dark' | 'light' = 'dark';
  reduceMotion = false;
  pageTitle = 'Today';

  private subscription: Subscription = new Subscription();

  constructor(
    private habitStore: HabitStoreService,
    private themeService: ThemeService,
    private settingsService: SettingsService,
    private router: Router
  ) {}

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
    this.subscription.add(
      this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => {
        this.pageTitle = this.getTitleFromUrl(this.router.url);
      })
    );
    this.pageTitle = this.getTitleFromUrl(this.router.url);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onYearChange(): void {
    this.habitStore.setSelectedMonthYear(this.selectedYear, this.selectedMonth);
  }

  onMonthChange(): void {
    this.habitStore.setSelectedMonthYear(this.selectedYear, this.selectedMonth);
  }

  toggleTheme(): void {
    const nextTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.settingsService.updateSettings({ themeMode: nextTheme });
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
}
