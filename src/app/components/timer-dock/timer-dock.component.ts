import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimerService, TimerSession } from '../../services/timer.service';

@Component({
  selector: 'app-timer-dock',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timer-dock.component.html',
  styleUrls: ['./timer-dock.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimerDockComponent {
  readonly state$;

  constructor(private timerService: TimerService) {
    this.state$ = this.timerService.state$;
  }

  isActive(session: TimerSession | null): boolean {
    return Boolean(session && (session.status === 'running' || session.status === 'paused'));
  }

  getStatusLine(session: TimerSession): string {
    return session.status === 'paused' ? 'Paused' : 'Meditation running';
  }

  getPrimaryLabel(session: TimerSession): string {
    return session.status === 'running' ? 'Pause' : 'Resume';
  }

  togglePause(session: TimerSession): void {
    if (session.status === 'running') {
      this.timerService.pauseTimer();
    } else {
      this.timerService.resumeTimer();
    }
  }

  reset(session: TimerSession): void {
    this.timerService.resetTimer(session.habitId, session.dateKey);
  }

  stop(): void {
    this.timerService.cancelTimer();
  }

  formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.max(totalSeconds % 60, 0);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}
