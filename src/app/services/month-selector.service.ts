import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MonthKey } from '../models/habit.model';

@Injectable({
  providedIn: 'root'
})
export class MonthSelectorService {
  private currentMonth$ = new BehaviorSubject<MonthKey>({
    year: new Date().getFullYear(),
    month: new Date().getMonth()
  });

  constructor() {}

  getCurrentMonth(): Observable<MonthKey> {
    return this.currentMonth$.asObservable();
  }

  getCurrentMonthSync(): MonthKey {
    return this.currentMonth$.value;
  }

  setMonth(year: number, month: number): void {
    this.currentMonth$.next({ year, month });
  }

  nextMonth(): void {
    const current = this.currentMonth$.value;
    let { year, month } = current;
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
    this.currentMonth$.next({ year, month });
  }

  previousMonth(): void {
    const current = this.currentMonth$.value;
    let { year, month } = current;
    month--;
    if (month < 0) {
      month = 11;
      year--;
    }
    this.currentMonth$.next({ year, month });
  }

  getAvailableYears(): number[] {
    return [2026, 2027, 2028];
  }

  getMonths(): { value: number; label: string }[] {
    return [
      { value: 0, label: 'January' },
      { value: 1, label: 'February' },
      { value: 2, label: 'March' },
      { value: 3, label: 'April' },
      { value: 4, label: 'May' },
      { value: 5, label: 'June' },
      { value: 6, label: 'July' },
      { value: 7, label: 'August' },
      { value: 8, label: 'September' },
      { value: 9, label: 'October' },
      { value: 10, label: 'November' },
      { value: 11, label: 'December' }
    ];
  }

  getMonthLabel(month: number): string {
    return this.getMonths()[month]?.label || '';
  }

  getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  getWeeksInMonth(year: number, month: number): Date[][] {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = this.getDaysInMonth(year, month);
    const weeks: Date[][] = [];
    let week: Date[] = [];

    // Fill in empty days from previous month
    for (let i = 0; i < firstDay; i++) {
      week.push(new Date(year, month, 0 - (firstDay - 1 - i)));
    }

    // Fill in days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      week.push(new Date(year, month, day));
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }

    // Fill in remaining days from next month
    if (week.length > 0) {
      let nextDay = 1;
      while (week.length < 7) {
        week.push(new Date(year, month + 1, nextDay++));
      }
      weeks.push(week);
    }

    return weeks;
  }
}
