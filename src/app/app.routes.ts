import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'today',
    pathMatch: 'full'
  },
  {
    path: 'today',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    data: { animation: 'dashboard' }
  },
  {
    path: 'overview',
    loadComponent: () => import('./pages/overview/overview.component').then(m => m.OverviewComponent),
    data: { animation: 'overview' }
  },
  {
    path: 'habits',
    loadComponent: () => import('./pages/habits/habits.component').then(m => m.HabitsComponent),
    data: { animation: 'habits' }
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
    data: { animation: 'profile' }
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent),
    data: { animation: 'about' }
  },
  {
    path: '**',
    redirectTo: 'today'
  }
];
