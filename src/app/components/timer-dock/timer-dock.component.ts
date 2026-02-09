import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimerService, TimerSession } from '../../services/timer.service';
import { HabitStoreService } from '../../services/habit-store.service';

@Component({
  selector: 'app-timer-dock',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timer-dock.component.html',
  styleUrls: ['./timer-dock.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimerDockComponent {
  readonly session$;

  constructor(
    private timerService: TimerService,
    private habitStore: HabitStoreService
  ) {
    this.session$ = this.timerService.getSession();
  }

  isActive(session: TimerSession | null): boolean {
    return Boolean(session && (session.status === 'running' || session.status === 'paused'));
  }

  getHabitName(habitId: string): string {
    return this.habitStore.getHabitsSync().find(habit => habit.id === habitId)?.name || 'Timer';
  }

  getStatusLine(session: TimerSession): string {
    return session.status === 'paused' ? 'Paused' : 'Meditation running';
  }

  getPrimaryLabel(session: TimerSession): string {
    return session.status === 'running' ? 'Pause' : 'Start';
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
