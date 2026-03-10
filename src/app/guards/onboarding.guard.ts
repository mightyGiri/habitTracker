import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { HabitStoreService } from '../services/habit-store.service';

export const onboardingGuard: CanMatchFn = () => {
  const habitStore = inject(HabitStoreService);
  const router = inject(Router);
  return habitStore.getReady().pipe(
    filter(ready => ready),
    take(1),
    map(() => {
      if (habitStore.onboardingCompletedSync()) {
        return true;
      }
      return router.createUrlTree(['/getting-started']);
    })
  );
};
