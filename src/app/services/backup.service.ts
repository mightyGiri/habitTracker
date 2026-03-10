import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HabitStoreService } from './habit-store.service';
import { HabitCompletion, HabitSkips, UserProfile, ProfileSettings, TimerStateMap } from '../models/habit.model';
import { DateUtils } from '../shared/date-utils';
import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { environment } from '../../environments/environment';

type BackupPayload = {
  schemaVersion: number;
  exportedAt: string;
  version?: string;
  build?: number;
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

export type WeeklyReportSharePayload = {
  weekStartKey: string;
  weekEndKey: string;
  weekRangeLabel: string;
  dateKeys: string[];
  headerName?: string | null;
  headerMeta?: string | null;
  stats: {
    completed: number;
    goal: number;
    weekXp?: number;
    perfectDays: number;
    weeklyPerfectStreak: number;
    bestStreak: number;
  };
  habits: Array<{ name: string; doneCount: number; daysActive: number }>;
  levelLine?: string | null;
  levelSubline?: string | null;
  footerSummary?: string | null;
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

  async exportWeeklyReportPng(payload: WeeklyReportSharePayload): Promise<BackupExportResult> {
    const fileName = `weekly-report-${payload.weekStartKey}.png`;
    if (!isPlatformBrowser(this.platformId)) {
      return {
        status: 'error',
        fileName,
        error: new Error('Weekly report export is only available in browser or native app runtime.')
      };
    }

    try {
      const pages = await this.renderWeeklyReportPngPages(payload);
      if (pages.length === 0) {
        throw new Error('No weekly report pages rendered');
      }
      if (Capacitor.isNativePlatform()) {
        return await this.exportPngNativePages(fileName, pages);
      }
      pages.forEach((page, index) => {
        const pageFileName = pages.length === 1
          ? fileName
          : `weekly-report-${payload.weekStartKey}-p${index + 1}.png`;
        this.downloadBlob(page.blob, pageFileName);
      });
      return { status: 'success', fileName, location: 'Browser downloads' };
    } catch (error) {
      console.error('Weekly report export failed:', error);
      return { status: 'error', fileName, error };
    }
  }

  private createBackupPayload(): BackupPayload {
    const snapshot = this.habitStore.getSnapshotForBackup();
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      version: environment.appVersion,
      build: environment.buildNumber,
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

  private async exportPngNative(fileName: string, base64Data: string): Promise<BackupExportResult> {
    const directory = Directory.Documents;
    const write = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory,
      recursive: true
    });

    let fileUri = '';
    try {
      const uriResult = await Filesystem.getUri({ directory, path: fileName });
      fileUri = uriResult.uri;
    } catch (uriError) {
      console.error('Weekly report export: getUri failed', uriError);
    }
    if (!fileUri) {
      fileUri = write.uri || `file://Documents/${fileName}`;
    }

    try {
      await Share.share({
        title: 'Weekly Report',
        text: 'Weekly progress report',
        url: fileUri
      });
    } catch (shareError) {
      if (!this.isCancellationError(shareError)) {
        console.error('Weekly report export: share failed', shareError);
        return { status: 'error', fileName, error: shareError };
      }
    }

    return { status: 'success', fileName, location: fileUri };
  }

  private async exportPngNativePages(fileName: string, pages: Array<{ blob: Blob; base64: string }>): Promise<BackupExportResult> {
    if (pages.length === 1) {
      return this.exportPngNative(fileName, pages[0].base64);
    }
    const directory = Directory.Documents;
    const fileUris: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      const pageFileName = `weekly-report-${fileName.replace(/^weekly-report-/, '').replace(/\.png$/, '')}-p${i + 1}.png`;
      const write = await Filesystem.writeFile({
        path: pageFileName,
        data: pages[i].base64,
        directory,
        recursive: true
      });
      let fileUri = '';
      try {
        const uriResult = await Filesystem.getUri({ directory, path: pageFileName });
        fileUri = uriResult.uri;
      } catch {
        fileUri = write.uri || '';
      }
      if (fileUri) {
        fileUris.push(fileUri);
      }
    }

    try {
      await Share.share({
        title: 'Weekly Report',
        text: 'Weekly progress report',
        files: fileUris as unknown as string[]
      } as unknown as Parameters<typeof Share.share>[0]);
      return { status: 'success', fileName, location: `${fileUris.length} files` };
    } catch (shareError) {
      if (this.isCancellationError(shareError)) {
        return { status: 'cancelled', fileName };
      }
      if (fileUris[0]) {
        try {
          await Share.share({
            title: 'Weekly Report',
            text: `Weekly progress report (${fileUris.length} pages)`,
            url: fileUris[0]
          });
          return { status: 'success', fileName, location: `Shared first page of ${fileUris.length}` };
        } catch (fallbackError) {
          if (!this.isCancellationError(fallbackError)) {
            return { status: 'error', fileName, error: fallbackError };
          }
          return { status: 'cancelled', fileName };
        }
      }
      return { status: 'error', fileName, error: shareError };
    }
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

  private downloadBlob(blob: Blob, fileName: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  private async renderWeeklyReportPngPages(payload: WeeklyReportSharePayload): Promise<Array<{ blob: Blob; base64: string }>> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Canvas rendering requires browser runtime');
    }
    const rowsPerPage = 9;
    const habitRows = payload.habits.length > 0
      ? payload.habits
      : [{ name: 'No habits active this week', doneCount: 0, daysActive: 0 }];
    const pageCount = Math.max(1, Math.ceil(habitRows.length / rowsPerPage));
    const pages: Array<{ blob: Blob; base64: string }> = [];

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const pageRows = habitRows.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
      pages.push(await this.renderWeeklyReportPage(payload, pageRows, pageIndex, pageCount));
    }
    return pages;
  }

  private async renderWeeklyReportPage(
    payload: WeeklyReportSharePayload,
    habitsPage: Array<{ name: string; doneCount: number; daysActive: number }>,
    pageIndex: number,
    pageCount: number
  ): Promise<{ blob: Blob; base64: string }> {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }

    const rootStyles = getComputedStyle(document.documentElement);
    const accent = (rootStyles.getPropertyValue('--theme-accent') || rootStyles.getPropertyValue('--accent') || '#4c8dff').trim() || '#4c8dff';
    const text = '#ffffff';
    const muted = 'rgba(255,255,255,0.78)';
    const faint = 'rgba(255,255,255,0.55)';

    ctx.fillStyle = '#070b16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const glow1 = ctx.createRadialGradient(170, 180, 0, 170, 180, 520);
    glow1.addColorStop(0, this.withAlpha(accent, 0.22));
    glow1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const glow2 = ctx.createRadialGradient(900, 320, 0, 900, 320, 540);
    glow2.addColorStop(0, 'rgba(34,211,238,0.10)');
    glow2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const vignette = ctx.createLinearGradient(0, 0, 0, canvas.height);
    vignette.addColorStop(0, 'rgba(255,255,255,0.02)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cardX = 56;
    const cardY = 90;
    const cardW = 968;
    const cardH = 1740;
    this.roundRect(ctx, cardX, cardY, cardW, cardH, 34);
    const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    cardGrad.addColorStop(0, 'rgba(13,19,34,0.96)');
    cardGrad.addColorStop(1, 'rgba(10,14,24,0.95)');
    ctx.fillStyle = cardGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 2;
    ctx.stroke();

    let y = cardY + 66;
    ctx.fillStyle = muted;
    ctx.font = '700 28px Inter, system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('WEEKLY REPORT', cardX + 46, y);
    if (pageCount > 1) {
      const pageLabel = `Page ${pageIndex + 1}/${pageCount}`;
      const width = ctx.measureText(pageLabel).width;
      ctx.fillText(pageLabel, cardX + cardW - 46 - width, y);
    }
    y += 56;
    ctx.fillStyle = text;
    ctx.font = '700 40px Inter, system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(payload.weekRangeLabel, cardX + 46, y);
    y += 24;
    ctx.fillStyle = this.withAlpha(accent, 0.9);
    this.roundRect(ctx, cardX + 46, y, 220, 8, 999);
    ctx.fill();

    y += 38;
    const stats = [
      { label: 'Completed', value: `${payload.stats.completed}/${payload.stats.goal}` },
      { label: 'Perfect days', value: String(payload.stats.perfectDays) },
      { label: 'Weekly streak', value: payload.stats.goal > 0 ? `${payload.stats.weeklyPerfectStreak} days` : '--' },
      { label: 'Best streak', value: String(payload.stats.bestStreak) }
    ];
    const statGap = 14;
    const statW = Math.floor((cardW - 46 * 2 - statGap) / 2);
    const statH = 138;
    stats.forEach((stat, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      const x = cardX + 46 + col * (statW + statGap);
      const sy = y + row * (statH + statGap);
      this.roundRect(ctx, x, sy, statW, statH, 20);
      ctx.fillStyle = row === 0 && col === 0 ? 'rgba(76,141,255,0.11)' : 'rgba(255,255,255,0.03)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.fillStyle = faint;
      ctx.font = '600 22px Inter, system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(stat.label, x + 18, sy + 38);
      ctx.fillStyle = text;
      ctx.font = '800 36px Inter, system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(stat.value, x + 18, sy + 88);
    });
    y += statH * 2 + statGap + 52;

    ctx.fillStyle = muted;
    ctx.font = '700 24px Inter, system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('HABITS', cardX + 46, y);
    y += 22;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    this.roundRect(ctx, cardX + 46, y, cardW - 92, 2, 999);
    ctx.fill();
    y += 24;

    habitsPage.forEach((habit, localIndex) => {
      const globalIndex = pageIndex * 9 + localIndex + 1;
      const rowX = cardX + 46;
      const rowW = cardW - 92;
      const rowH = 102;
      this.roundRect(ctx, rowX, y, rowW, rowH, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = faint;
      ctx.font = '700 20px Inter, system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(`${globalIndex})`, rowX + 16, y + 36);

      const progressLabel = `${habit.doneCount}/${Math.max(0, habit.daysActive)}`;
      ctx.fillStyle = muted;
      ctx.font = '700 20px Inter, system-ui, -apple-system, Segoe UI, sans-serif';
      const progressLabelWidth = ctx.measureText(progressLabel).width;
      const progressLabelX = rowX + rowW - 18 - progressLabelWidth;
      ctx.fillText(progressLabel, progressLabelX, y + 36);

      ctx.fillStyle = text;
      ctx.font = '700 24px Inter, system-ui, -apple-system, Segoe UI, sans-serif';
      const nameX = rowX + 58;
      const maxNameWidth = Math.max(140, progressLabelX - nameX - 14);
      ctx.fillText(this.truncateText(ctx, habit.name, maxNameWidth), nameX, y + 36);

      const trackX = nameX;
      const trackY = y + 56;
      const trackW = rowW - (nameX - rowX) - 18;
      const ratio = habit.daysActive > 0 ? (habit.doneCount / habit.daysActive) : 0;
      this.roundRect(ctx, trackX, trackY, trackW, 10, 999);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fill();
      const fillW = habit.daysActive > 0 ? Math.round(trackW * Math.max(0, Math.min(1, ratio))) : 0;
      if (fillW > 0) {
        this.roundRect(ctx, trackX, trackY, Math.max(8, fillW), 10, 999);
        const fill = ctx.createLinearGradient(trackX, 0, trackX + trackW, 0);
        fill.addColorStop(0, this.withAlpha(accent, 0.95));
        fill.addColorStop(1, 'rgba(94,234,212,0.9)');
        ctx.fillStyle = fill;
        ctx.fill();
      }
      y += rowH + 12;
    });

    if (pageIndex === pageCount - 1 && payload.levelLine) {
      y += 10;
      const levelCardH = payload.levelSubline ? 136 : 110;
      this.roundRect(ctx, cardX + 46, y, cardW - 92, levelCardH, 16);
      ctx.fillStyle = 'rgba(76,141,255,0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = muted;
      ctx.font = '700 20px Inter, system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText('LEVEL', cardX + 64, y + 36);
      ctx.fillStyle = text;
      ctx.font = '700 24px Inter, system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(this.truncateText(ctx, payload.levelLine, cardW - 128), cardX + 64, y + 74);
      if (payload.levelSubline) {
        ctx.fillStyle = muted;
        ctx.font = '600 18px Inter, system-ui, -apple-system, Segoe UI, sans-serif';
        ctx.fillText(this.truncateText(ctx, payload.levelSubline, cardW - 128), cardX + 64, y + 104);
      }
    }

    const footerY = cardY + cardH - 84;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    this.roundRect(ctx, cardX + 46, footerY - 28, cardW - 92, 1.5, 999);
    ctx.fill();
    ctx.fillStyle = muted;
    ctx.font = '700 24px Inter, system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(payload.footerSummary || 'LEVEL UP • One week stronger', cardX + 46, footerY + 22);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('Failed to create PNG blob')), 'image/png');
    });
    const base64 = canvas.toDataURL('image/png').split(',')[1] || '';
    if (!base64) {
      throw new Error('Failed to encode PNG base64');
    }
    return { blob, base64 };
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  private truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    const value = (text || '').trim();
    if (!value) {
      return '';
    }
    if (ctx.measureText(value).width <= maxWidth) {
      return value;
    }
    const ellipsis = '…';
    let output = value;
    while (output.length > 1 && ctx.measureText(output + ellipsis).width > maxWidth) {
      output = output.slice(0, -1);
    }
    return `${output}${ellipsis}`;
  }

  private withAlpha(color: string, alpha: number): string {
    const safeAlpha = Math.max(0, Math.min(1, alpha));
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const normalized = hex.length === 3
        ? hex.split('').map(char => char + char).join('')
        : hex;
      if (normalized.length === 6) {
        const r = parseInt(normalized.slice(0, 2), 16);
        const g = parseInt(normalized.slice(2, 4), 16);
        const b = parseInt(normalized.slice(4, 6), 16);
        if ([r, g, b].every(Number.isFinite)) {
          return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
        }
      }
    }
    return color;
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
