import { MonthSlot } from '../models/habit.model';

export class DateUtils {
  static daysInMonth(year: number, monthIndex: number): number {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  static getMonthMatrix(year: number, monthIndex: number): MonthSlot[][] {
    const daysInMonth = this.daysInMonth(year, monthIndex);
    const firstDay = new Date(year, monthIndex, 1).getDay(); // 0 = Sun, 1 = Mon, etc.
    const weeks: MonthSlot[][] = [];
    let week: MonthSlot[] = [];
    let dayCounter = 1;

    // Fill leading empty slots
    for (let i = 0; i < firstDay; i++) {
      week.push({ dayNumber: null, dayLabel: this.getDayLabel(i) });
    }

    // Fill days
    for (let day = 1; day <= daysInMonth; day++) {
      week.push({ dayNumber: day, dayLabel: this.getDayLabel((firstDay + day - 1) % 7) });
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }

    // Fill trailing empty slots
    while (week.length < 7) {
      week.push({ dayNumber: null, dayLabel: this.getDayLabel((firstDay + dayCounter - 1) % 7) });
      dayCounter++;
    }
    if (week.length > 0) {
      weeks.push(week);
    }

    return weeks;
  }

  private static getDayLabel(dayIndex: number): string {
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return labels[dayIndex];
  }
}