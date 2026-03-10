import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TabStateService {
  private currentTab$ = new BehaviorSubject<string>('today');

  setCurrentTab(tab: string): void {
    this.currentTab$.next(tab);
  }

  getCurrentTab(): Observable<string> {
    return this.currentTab$.asObservable();
  }

  getCurrentTabSync(): string {
    return this.currentTab$.value;
  }
}
