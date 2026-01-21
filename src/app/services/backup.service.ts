import { Injectable } from '@angular/core';
import { HabitStoreService } from './habit-store.service';
import { ThemeService } from './theme.service';
import { HabitCompletion } from '../models/habit.model';
import { DateUtils } from '../shared/date-utils';
import * as XLSX from 'xlsx';

type BackupPayload = {
  schemaVersion: number;
  exportedAt: string;
  appSettings: {
    theme?: string;
    selectedYear?: number;
    selectedMonthIndex?: number;
  };
  habits: Array<{ id: string; name: string; goalDays: number }>;
  checks: Record<string, HabitCompletion>;
};

@Injectable({ providedIn: 'root' })
export class BackupService {
  constructor(private habitStore: HabitStoreService, private themeService: ThemeService) {}

  exportJsonBackup(): void {
    const snapshot = this.habitStore.getSnapshotForBackup();
    const payload: BackupPayload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      appSettings: {
        theme: this.themeService.getThemeSync(),
        selectedYear: snapshot.selectedMonthYear?.year,
        selectedMonthIndex: snapshot.selectedMonthYear?.month
      },
      habits: snapshot.habits.map(habit => ({
        id: habit.id,
        name: habit.name,
        goalDays: habit.goalDays
      })),
      checks: snapshot.completions
    };

    const json = JSON.stringify(payload, null, 2);
    this.downloadFile(json, `habit-tracker-backup-${this.getDateStamp()}.json`, 'application/json');
  }

  exportDailyCountsCsv(): void {
    const snapshot = this.habitStore.getSnapshotForBackup();
    const totalHabits = snapshot.habits.length;
    const lines: string[] = ['Year,Month,Day,CompletedHabitsCount,TotalHabits'];

    Object.keys(snapshot.completions)
      .sort()
      .forEach(monthKey => {
        const parsed = this.parseMonthKey(monthKey);
        if (!parsed) {
          return;
        }
        const { year, monthIndex } = parsed;
        const daysInMonth = DateUtils.daysInMonth(year, monthIndex);
        const monthData = snapshot.completions[monthKey] || {};
        for (let day = 1; day <= daysInMonth; day++) {
          const completedCount = monthData[day]?.length || 0;
          lines.push(`${year},${monthIndex + 1},${day},${completedCount},${totalHabits}`);
        }
      });

    const csv = lines.join('\n');
    this.downloadFile(csv, `habit-tracker-dailycounts-${this.getDateStamp()}.csv`, 'text/csv');
  }

  exportHabitChecksCsv(): void {
    const snapshot = this.habitStore.getSnapshotForBackup();
    const lines: string[] = ['Year,Month,Day,HabitId,Checked'];

    Object.keys(snapshot.completions)
      .sort()
      .forEach(monthKey => {
        const parsed = this.parseMonthKey(monthKey);
        if (!parsed) {
          return;
        }
        const { year, monthIndex } = parsed;
        const monthData = snapshot.completions[monthKey] || {};
        Object.keys(monthData).forEach(dayKey => {
          const day = Number(dayKey);
          const checks = monthData[day];
          if (!Array.isArray(checks)) {
            return;
          }
          checks.forEach(check => {
            lines.push(`${year},${monthIndex + 1},${day},${check.habitId},${check.checked ? 'true' : 'false'}`);
          });
        });
      });

    const csv = lines.join('\n');
    this.downloadFile(csv, `habit-tracker-habitchecks-${this.getDateStamp()}.csv`, 'text/csv');
  }

  exportXlsx(): void {
    const snapshot = this.habitStore.getSnapshotForBackup();
    const totalHabits = snapshot.habits.length;
    const monthKeys = Object.keys(snapshot.completions).sort();
    const summaryRows: Array<Array<string | number>> = [
      ['Year', 'Month', 'TotalHabits', 'CompletedChecks', 'GoalChecks', 'Percent']
    ];
    const dailyCountRows: Array<Array<string | number>> = [
      ['Year', 'Month', 'Day', 'CompletedHabitsCount', 'TotalHabits']
    ];
    const habitCheckRows: Array<Array<string | number>> = [
      ['Year', 'Month', 'Day', 'HabitId', 'Checked']
    ];

    monthKeys.forEach(monthKey => {
      const parsed = this.parseMonthKey(monthKey);
      if (!parsed) {
        return;
      }
      const { year, monthIndex } = parsed;
      const daysInMonth = DateUtils.daysInMonth(year, monthIndex);
      const monthData = snapshot.completions[monthKey] || {};
      let completedChecks = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const checks = monthData[day] || [];
        completedChecks += checks.length;
        dailyCountRows.push([year, monthIndex + 1, day, checks.length, totalHabits]);
        checks.forEach(check => {
          habitCheckRows.push([year, monthIndex + 1, day, check.habitId, check.checked ? 'true' : 'false']);
        });
      }

      const goalChecks = snapshot.habits.reduce((sum, habit) => sum + (habit.goalDays || 0), 0);
      const percent = goalChecks > 0 ? Math.round((completedChecks / goalChecks) * 100) : 0;
      summaryRows.push([year, monthIndex + 1, totalHabits, completedChecks, goalChecks, percent]);
    });

    const habitsRows: Array<Array<string | number>> = [
      ['HabitId', 'HabitName', 'GoalDays'],
      ...snapshot.habits.map(habit => [habit.id, habit.name, habit.goalDays])
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(habitsRows), 'Habits');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(dailyCountRows), 'DailyCounts');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(habitCheckRows), 'HabitChecks');

    XLSX.writeFile(workbook, `habit-tracker-backup-${this.getDateStamp()}.xlsx`);
  }

  private downloadFile(contents: string, fileName: string, mimeType: string): void {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  private parseMonthKey(monthKey: string): { year: number; monthIndex: number } | null {
    const parts = monthKey.split('-');
    if (parts.length !== 2) {
      return null;
    }
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return null;
    }
    const monthIndex = month - 1;
    if (monthIndex < 0 || monthIndex > 11) {
      return null;
    }
    return { year, monthIndex };
  }

  private getDateStamp(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
