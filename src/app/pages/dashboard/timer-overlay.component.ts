import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgressBarComponent } from '../../shared/progress-bar.component';
import { TimerSession } from '../../services/timer.service';

@Component({
  selector: 'app-timer-overlay',
  standalone: true,
  imports: [CommonModule, ProgressBarComponent],
  template: `
    <div class="timer-overlay">
      <div class="timer-overlay-card">
        <div class="timer-overlay-title">{{ habitName }}</div>
        <div class="timer-overlay-time">{{ timeLabel }}</div>
        <app-progress-bar [value]="progress" [height]="6"></app-progress-bar>
        <div class="timer-overlay-actions">
          <button class="btn btn-outline btn-sm" type="button" (click)="primary.emit()">
            {{ primaryLabel }}
          </button>
          <button class="btn btn-outline btn-sm" type="button" (click)="reset.emit()">
            Reset
          </button>
          <button class="btn btn-primary btn-sm" type="button" (click)="close.emit()">
            Close
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./timer-overlay.component.sass']
})
export class TimerOverlayComponent {
  @Input() session: TimerSession | null = null;
  @Input() habitName = 'Timer';
  @Output() primary = new EventEmitter<void>();
  @Output() reset = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  get timeLabel(): string {
    if (!this.session) {
      return '00:00';
    }
    const remaining = Math.max(this.session.targetSeconds - this.session.elapsedSeconds, 0);
    return this.formatTime(remaining);
  }

  get progress(): number {
    if (!this.session || this.session.targetSeconds <= 0) {
      return 0;
    }
    return Math.min(this.session.elapsedSeconds / this.session.targetSeconds, 1);
  }

  get primaryLabel(): string {
    if (!this.session) {
      return 'Start';
    }
    return this.session.status === 'running' ? 'Pause' : 'Resume';
  }

  private formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}
