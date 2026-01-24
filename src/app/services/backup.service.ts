import { Injectable } from '@angular/core';
import { HabitStoreService } from './habit-store.service';
import { ThemeService } from './theme.service';
import { HabitCompletion, HabitSkips, UserProfile } from '../models/habit.model';
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
  habits: Array<{ id: string; name: string; goalDays: number; frequency?: 'daily' | 'weekly'; minimum?: string }>;
  checks: HabitCompletion;
  skips?: HabitSkips;
  onboardingCompleted?: boolean;
  userProfile?: UserProfile;
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
        goalDays: habit.goalDays,
        frequency: habit.frequency,
        minimum: habit.minimum
      })),
      checks: snapshot.completions,
      skips: snapshot.skips,
      onboardingCompleted: snapshot.onboardingCompleted,
      userProfile: snapshot.userProfile ?? undefined
    };

    const json = JSON.stringify(payload, null, 2);
    this.downloadFile(json, `habit-tracker-backup-${this.getDateStamp()}.json`, 'application/json');
  }

  exportDailyCountsCsv(): void {
    const snapshot = this.habitStore.getSnapshotForBackup();
    const totalHabits = snapshot.habits.length;
    const lines: string[] = ['Year,Month,Day,CompletedHabitsCount,TotalHabits'];
    const monthKeys = this.getMonthKeys(snapshot.completions);

    monthKeys.forEach(({ year, monthIndex }) => {
      const daysInMonth = DateUtils.daysInMonth(year, monthIndex);
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = this.toIsoDateLocal(new Date(year, monthIndex, day));
        const dayMap = snapshot.completions[dateKey] || {};
        const completedCount = Object.values(dayMap).filter(Boolean).length;
        lines.push(`${year},${monthIndex + 1},${day},${completedCount},${totalHabits}`);
      }
    });

    const csv = lines.join('\n');
    this.downloadFile(csv, `habit-tracker-dailycounts-${this.getDateStamp()}.csv`, 'text/csv');
  }

  exportHabitChecksCsv(): void {
    const snapshot = this.habitStore.getSnapshotForBackup();
    const lines: string[] = ['Year,Month,Day,HabitId,Checked'];
    Object.entries(snapshot.completions).forEach(([dateKey, dayMap]) => {
      const parsed = this.parseDateKey(dateKey);
      if (!parsed || !dayMap || typeof dayMap !== 'object' || Array.isArray(dayMap)) {
        return;
      }
      Object.entries(dayMap).forEach(([habitId, completed]) => {
        lines.push(`${parsed.year},${parsed.monthIndex + 1},${parsed.day},${habitId},${completed ? 'true' : 'false'}`);
      });
    });

    const csv = lines.join('\n');
    this.downloadFile(csv, `habit-tracker-habitchecks-${this.getDateStamp()}.csv`, 'text/csv');
  }

  exportXlsx(): void {
    const snapshot = this.habitStore.getSnapshotForBackup();
    const totalHabits = snapshot.habits.length;
    const monthKeys = this.getMonthKeys(snapshot.completions);
    const summaryRows: Array<Array<string | number>> = [
      ['Year', 'Month', 'TotalHabits', 'CompletedChecks', 'GoalChecks', 'Percent']
    ];
    const dailyCountRows: Array<Array<string | number>> = [
      ['Year', 'Month', 'Day', 'CompletedHabitsCount', 'TotalHabits']
    ];
    const habitCheckRows: Array<Array<string | number>> = [
      ['Year', 'Month', 'Day', 'HabitId', 'Checked']
    ];

    monthKeys.forEach(({ year, monthIndex }) => {
      const daysInMonth = DateUtils.daysInMonth(year, monthIndex);
      let completedChecks = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = this.toIsoDateLocal(new Date(year, monthIndex, day));
        const dayMap = snapshot.completions[dateKey] || {};
        const dayCount = Object.values(dayMap).filter(Boolean).length;
        completedChecks += dayCount;
        dailyCountRows.push([year, monthIndex + 1, day, dayCount, totalHabits]);
        Object.entries(dayMap).forEach(([habitId, completed]) => {
          habitCheckRows.push([year, monthIndex + 1, day, habitId, completed ? 'true' : 'false']);
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

  private getMonthKeys(completions: HabitCompletion): Array<{ year: number; monthIndex: number }> {
    const keys = new Map<string, { year: number; monthIndex: number }>();
    Object.keys(completions).forEach(dateKey => {
      const parsed = this.parseDateKey(dateKey);
      if (!parsed) {
        return;
      }
      const key = `${parsed.year}-${parsed.monthIndex}`;
      keys.set(key, { year: parsed.year, monthIndex: parsed.monthIndex });
    });
    return Array.from(keys.values()).sort((a, b) => (a.year - b.year) || (a.monthIndex - b.monthIndex));
  }

  private parseDateKey(dateKey: string): { year: number; monthIndex: number; day: number } | null {
    const parts = dateKey.split('-');
    if (parts.length !== 3) {
      return null;
    }
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    const monthIndex = month - 1;
    if (monthIndex < 0 || monthIndex > 11) {
      return null;
    }
    return { year, monthIndex, day };
  }

  private toIsoDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getDateStamp(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
