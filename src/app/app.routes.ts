import { Routes } from '@angular/router';
import { onboardingGuard } from './guards/onboarding.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'today',
    pathMatch: 'full'
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./pages/onboarding/onboarding.component').then(m => m.OnboardingComponent),
    data: { animation: 'onboarding' }
  },
  {
    path: 'today',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    data: { animation: 'dashboard' },
    canMatch: [onboardingGuard]
  },
  {
    path: 'overview',
    loadComponent: () => import('./pages/overview/overview.component').then(m => m.OverviewComponent),
    data: { animation: 'overview' },
    canMatch: [onboardingGuard]
  },
  {
    path: 'habits',
    loadComponent: () => import('./pages/habits/habits.component').then(m => m.HabitsComponent),
    data: { animation: 'habits' },
    canMatch: [onboardingGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
    data: { animation: 'profile' },
    canMatch: [onboardingGuard]
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent),
    data: { animation: 'about' },
    canMatch: [onboardingGuard]
  },
  {
    path: '**',
    redirectTo: 'today'
  }
];
