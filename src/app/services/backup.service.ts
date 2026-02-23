import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HabitStoreService } from './habit-store.service';
import { HabitCompletion, HabitSkips, UserProfile, ProfileSettings, TimerStateMap } from '../models/habit.model';
import { DateUtils } from '../shared/date-utils';
import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

type BackupPayload = {
  schemaVersion: number;
  exportedAt: string;
  appSettings: {
    theme?: string;
    selectedYear?: number;
    selectedMonthIndex?: number;
  };
  habits: Array<Record<string, unknown>>;
  checks: HabitCompletion;
  completions?: HabitCompletion;
  skips?: HabitSkips;
  timerStates?: TimerStateMap;
  selectedMonthYear?: { year: number; month: number };
  onboardingCompleted?: boolean;
  userProfile?: UserProfile;
  profile?: ProfileSettings;
  defaultsSeeded?: boolean;
};

export type BackupExportResult = {
  status: 'success' | 'cancelled' | 'error';
  fileName: string;
  location?: string;
  error?: unknown;
};

@Injectable({ providedIn: 'root' })
export class BackupService {
  constructor(
    private habitStore: HabitStoreService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  async exportBackup(): Promise<BackupExportResult> {
    const fileName = `LevelUp-backup-${this.getTimestampStamp()}.json`;
    if (!isPlatformBrowser(this.platformId)) {
      return {
        status: 'error',
        fileName,
        error: new Error('Export is only available in browser or native app runtime.')
      };
    }

    const payload = this.createBackupPayload();
    if (!payload || typeof payload !== 'object') {
      return {
        status: 'error',
        fileName,
        error: new Error('Backup payload is empty.')
      };
    }
    const json = JSON.stringify(payload, null, 2);

    try {
      if (Capacitor.isNativePlatform()) {
        return await this.exportJsonNative(fileName, json);
      }
      return await this.exportJsonWeb(fileName, json);
    } catch (error) {
      console.error('Backup export failed:', error);
      return { status: 'error', fileName, error };
    }
  }

  async exportJsonBackup(): Promise<BackupExportResult> {
    return this.exportBackup();
  }

  private createBackupPayload(): BackupPayload {
    const snapshot = this.habitStore.getSnapshotForBackup();
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      appSettings: {
        theme: 'dark',
        selectedYear: snapshot.selectedMonthYear?.year,
        selectedMonthIndex: snapshot.selectedMonthYear?.month
      },
      habits: snapshot.habits.map(habit => ({ ...habit })),
      checks: snapshot.completions,
      completions: snapshot.completions,
      skips: snapshot.skips,
      timerStates: snapshot.timerStates,
      selectedMonthYear: snapshot.selectedMonthYear,
      onboardingCompleted: snapshot.onboardingCompleted,
      userProfile: snapshot.userProfile ?? undefined,
      profile: snapshot.profile ?? undefined,
      defaultsSeeded: snapshot.defaultsSeeded
    };
  }

  private async exportJsonWeb(fileName: string, json: string): Promise<BackupExportResult> {
    const savePicker = (window as Window & {
      showSaveFilePicker?: (options?: {
        suggestedName?: string;
        types?: Array<{ description?: string; accept: Record<string, string[]> }>;
      }) => Promise<{
        name?: string;
        createWritable: () => Promise<{ write: (data: Blob | string) => Promise<void>; close: () => Promise<void> }>;
      }>;
    }).showSaveFilePicker;

    if (typeof savePicker === 'function') {
      try {
        const handle = await savePicker({
          suggestedName: fileName,
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        return {
          status: 'success',
          fileName,
          location: handle.name || fileName
        };
      } catch (error) {
        if (this.isCancellationError(error)) {
          return { status: 'cancelled', fileName };
        }
        throw error;
      }
    }

    this.downloadFile(json, fileName, 'application/json');
    return { status: 'success', fileName, location: 'Browser downloads' };
  }

  private async exportJsonNative(fileName: string, json: string): Promise<BackupExportResult> {
    const directory = Directory.Documents;
    const write = await Filesystem.writeFile({
      path: fileName,
      data: json,
      directory,
      encoding: Encoding.UTF8,
      recursive: true
    });

    let fileUri = '';
    try {
      const uriResult = await Filesystem.getUri({ directory, path: fileName });
      fileUri = uriResult.uri;
    } catch (uriError) {
      console.error('Backup export: getUri failed', uriError);
    }
    if (!fileUri) {
      fileUri = write.uri || `file://Documents/${fileName}`;
    }

    try {
      await Share.share({
        title: 'LevelUp Backup',
        text: 'Backup JSON file',
        url: fileUri
      });
    } catch (shareError) {
      if (!this.isCancellationError(shareError)) {
        console.error('Backup export: share failed', shareError);
        return { status: 'error', fileName, error: shareError };
      }
    }

    return { status: 'success', fileName, location: fileUri };
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

    const habitsRows: Array<Array<string | number | boolean>> = [
      ['HabitId', 'HabitName', 'GoalDays', 'Frequency', 'WeeklyTarget', 'MinimumVersion', 'TimerEnabled', 'TimerSeconds', 'TimerAutoComplete', 'Type', 'TargetSeconds', 'AllowManualComplete'],
      ...snapshot.habits.map(habit => [
        habit.id,
        habit.name,
        habit.goalDays,
        habit.frequencyType || 'daily',
        habit.weeklyTarget ?? '',
        habit.minimumVersion ?? '',
        habit.timerEnabled ?? false,
        habit.timerSeconds ?? 0,
        habit.timerAutoComplete ?? true,
        habit.type ?? 'check',
        habit.targetSeconds ?? 0,
        habit.allowManualComplete ?? false
      ])
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(habitsRows), 'Habits');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(dailyCountRows), 'DailyCounts');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(habitCheckRows), 'HabitChecks');

    XLSX.writeFile(workbook, `habit-tracker-backup-${this.getDateStamp()}.xlsx`);
  }

  private downloadFile(contents: string, fileName: string, mimeType: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.click();

    setTimeout(() => URL.revokeObjectURL(url), 0);
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

  private getTimestampStamp(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${y}${m}${d}-${hh}${mm}`;
  }

  private isCancellationError(error: unknown): boolean {
    if (!error) {
      return false;
    }
    const maybeDom = error as { name?: string };
    if (maybeDom.name === 'AbortError') {
      return true;
    }
    const message = String((error as { message?: string }).message || error).toLowerCase();
    return message.includes('cancel') || message.includes('dismiss');
  }
}
