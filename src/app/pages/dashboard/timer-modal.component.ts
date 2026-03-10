import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { TimerService, TimerSession } from '../../services/timer.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/confirm-dialog.component';

type TimerModalData = {
  habitId: string;
  habitName: string;
  dateKey: string;
  durationSeconds: number;
  autoComplete: boolean;
};

@Component({
  selector: 'app-timer-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  template: `
    <div class="timer-modal">
      <div class="timer-title">{{ data.habitName }}</div>
      <div class="timer-sub text-muted">{{ durationLabel }}</div>
      <div class="timer-remaining">{{ remainingLabel }}</div>
      <div class="timer-actions">
        <button class="btn btn-primary btn-sm" type="button" (click)="onStart()" *ngIf="isIdle">Start</button>
        <button class="btn btn-outline btn-sm" type="button" (click)="pause()" *ngIf="isRunning">Pause</button>
        <button class="btn btn-primary btn-sm" type="button" (click)="resume()" *ngIf="isPaused">Resume</button>
        <button class="btn btn-outline btn-sm" type="button" (click)="stop()" *ngIf="!isIdle">Stop</button>
      </div>
    </div>
  `,
  styleUrls: ['./timer-modal.component.sass']
})
export class TimerModalComponent implements OnInit, OnDestroy {
  session: TimerSession | null = null;
  remainingLabel = '00:00';
  durationLabel = '';

  private subscription = new Subscription();

  constructor(
    private timerService: TimerService,
    private dialog: MatDialog,
    private dialogRef: MatDialogRef<TimerModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TimerModalData
  ) {}

  ngOnInit(): void {
    this.durationLabel = `Duration ${this.formatTime(this.data.durationSeconds)}`;
    this.subscription.add(
      this.timerService.getSession().subscribe(session => {
        this.session = session;
        const remaining = this.getRemainingSeconds();
        this.remainingLabel = this.formatTime(remaining);
        if (session?.status === 'finished' && session.habitId === this.data.habitId) {
          this.dialogRef.close(true);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  get isRunning(): boolean {
    return this.session?.habitId === this.data.habitId && this.session.status === 'running';
  }

  get isPaused(): boolean {
    return this.session?.habitId === this.data.habitId && this.session.status === 'paused';
  }

  get isIdle(): boolean {
    return !this.session || this.session.habitId !== this.data.habitId || this.session.status === 'cancelled' || this.session.status === 'finished' || this.session.status === 'idle';
  }

  onStart(): void {
    const started = this.timerService.startTimer(
      this.data.habitId,
      this.data.dateKey,
      this.data.durationSeconds,
      this.data.autoComplete,
      false
    );
    if (!started) {
      this.confirmStopOtherTimer();
    }
  }

  pause(): void {
    this.timerService.pauseTimer();
  }

  resume(): void {
    this.timerService.resumeTimer();
  }

  stop(): void {
    this.timerService.cancelTimer();
  }

  private confirmStopOtherTimer(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Switch timer?',
        message: 'Stop the current timer and start this one?',
        confirmLabel: 'Start new',
        cancelLabel: 'Keep current'
      } satisfies ConfirmDialogData
    });
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.timerService.stopAndClear();
        this.onStart();
      }
    });
  }

  private getRemainingSeconds(): number {
    if (!this.session || this.session.habitId !== this.data.habitId) {
      return this.data.durationSeconds;
    }
    return Math.max(this.session.remainingSeconds, 0);
  }

  private formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}
