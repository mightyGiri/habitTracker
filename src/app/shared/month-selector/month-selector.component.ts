import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonthSelectorService } from '../../services/month-selector.service';
import { MonthKey } from '../../models/habit.model';

@Component({
  selector: 'app-month-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="month-selector">
      <select [value]="currentMonth.month" (change)="onMonthChange($event)">
        <option *ngFor="let m of months" [value]="m.value">
          {{ m.label }}
        </option>
      </select>

      <select [value]="currentMonth.year" (change)="onYearChange($event)">
        <option *ngFor="let y of years" [value]="y">
          {{ y }}
        </option>
      </select>
    </div>
  `,
  styleUrl: './month-selector.component.sass'
})
export class MonthSelectorComponent implements OnInit {
  currentMonth: MonthKey = { year: 2026, month: 0 };
  months: { value: number; label: string }[] = [];
  years: number[] = [];

  constructor(private monthService: MonthSelectorService) {}

  ngOnInit(): void {
    this.months = this.monthService.getMonths();
    this.years = this.monthService.getAvailableYears();

    this.monthService.getCurrentMonth().subscribe(month => {
      this.currentMonth = month;
    });
  }

  onMonthChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const month = parseInt(target.value, 10);
    this.monthService.setMonth(this.currentMonth.year, month);
  }

  onYearChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const year = parseInt(target.value, 10);
    this.monthService.setMonth(year, this.currentMonth.month);
  }
}

