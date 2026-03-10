import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, ChangeDetectorRef, OnChanges
} from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Quest } from '../../../models/quest.model';
import { QuestService } from '../../../services/quest.service';
import { HabitStoreService } from '../../../services/habit-store.service';

type WeekDay = {
  dayName: string;   // "Mon", "Tue" …
  dateStr: string;   // "Mar 8", "Mar 9" …
  dateKey: string;   // "2026-03-08"
  isCounted: boolean;
  isFuture: boolean;
  isToday: boolean;
  doneCount: number;
  totalCount: number;
};

@Component({
  selector: 'app-quest-card',
  standalone: true,
  imports: [MatIconModule, TitleCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="quest-card"
      [class.quest-card--completed]="quest.progress.claimedReward"
      [class.quest-card--ready]="quest.progress.completed && !quest.progress.claimedReward"
      [class.quest-card--expanded]="isExpanded"
      (click)="toggleExpand()"
      role="button"
      [attr.aria-expanded]="isExpanded"
      tabindex="0"
      (keydown.enter)="toggleExpand()"
      (keydown.space)="toggleExpand()">

      <!-- Header row -->
      <div class="quest-card__header">
        <div class="quest-card__meta">
          <span class="quest-card__type-badge">{{ quest.type | titlecase }}</span>
          @if (!quest.progress.completed && !quest.progress.claimedReward) {
            <span class="quest-card__days-left">
              <mat-icon>schedule</mat-icon>{{ daysRemaining }} day{{ daysRemaining !== 1 ? 's' : '' }} left
            </span>
          }
          @if (quest.progress.claimedReward) {
            <span class="quest-card__claimed-tag">
              <mat-icon>check_circle</mat-icon>Claimed
            </span>
          }
        </div>
        <div class="quest-card__xp-badge">
          <mat-icon>bolt</mat-icon>{{ quest.xpReward }} XP
        </div>
      </div>

      <!-- Title & description -->
      <h3 class="quest-card__title">{{ quest.title }}</h3>
      <p class="quest-card__desc">{{ quest.description }}</p>

      <!-- Progress section + expand chevron -->
      @if (!quest.progress.claimedReward) {
        <div class="quest-card__progress">
          <div class="quest-card__progress-labels">
            <span class="quest-card__progress-text">
              {{ quest.progress.currentDays }} / {{ quest.requirement.daysRequired }} days
            </span>
            <div class="quest-card__progress-right">
              <span class="quest-card__progress-pct">{{ progressPercent }}%</span>
              <mat-icon class="quest-card__chevron" [class.quest-card__chevron--open]="isExpanded">
                expand_more
              </mat-icon>
            </div>
          </div>
          <div class="quest-card__progress-track" role="progressbar"
               [attr.aria-valuenow]="progressPercent" aria-valuemin="0" aria-valuemax="100">
            <div class="quest-card__progress-fill"
                 [style.width.%]="progressPercent"
                 [class.quest-card__progress-fill--done]="quest.progress.completed">
            </div>
          </div>
        </div>
      }

      <!-- ── Expandable week breakdown ──────────────────────────────────── -->
      <div class="quest-card__week" [class.quest-card__week--open]="isExpanded" aria-hidden="true">
        <div class="quest-card__week-inner">
          @for (day of weekDays; track day.dateKey) {
            <div
              class="quest-day"
              [class.quest-day--counted]="day.isCounted"
              [class.quest-day--future]="day.isFuture"
              [class.quest-day--today]="day.isToday">

              <span class="quest-day__name">{{ day.dayName }}</span>

              <div class="quest-day__circle">
                @if (day.isCounted) {
                  <mat-icon>check</mat-icon>
                } @else if (day.isFuture) {
                  <mat-icon>lock</mat-icon>
                }
              </div>

              <span class="quest-day__date">{{ day.dateStr }}</span>

              <span class="quest-day__count">
                @if (!day.isFuture && day.totalCount > 0) {
                  {{ day.doneCount }}/{{ day.totalCount }}
                } @else if (!day.isFuture) {
                  -
                }
              </span>
            </div>
          }
        </div>
      </div>

      <!-- Completed claimed state -->
      @if (quest.progress.claimedReward) {
        <div class="quest-card__done-row">
          <mat-icon>emoji_events</mat-icon>
          <span>Reward collected &mdash; {{ quest.xpReward }} XP earned</span>
        </div>
      }

      <!-- Claim button — stopPropagation so it doesn't also toggle expand -->
      @if (quest.progress.completed && !quest.progress.claimedReward) {
        <button
          class="btn btn-primary quest-card__claim-btn"
          type="button"
          (click)="onClaim(); $event.stopPropagation()">
          <mat-icon>redeem</mat-icon>
          Claim {{ quest.xpReward }} XP
        </button>
      }

    </div>
  `,
  styleUrl: './quest-card.component.sass'
})
export class QuestCardComponent implements OnChanges {
  @Input({ required: true }) quest!: Quest;
  @Output() claimed = new EventEmitter<string>();

  isExpanded = false;

  constructor(
    private questService: QuestService,
    private habitStore: HabitStoreService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(): void {
    this.cdr.markForCheck();
  }

  // ─── Expansion ─────────────────────────────────────────────────────────────

  toggleExpand(): void {
    this.isExpanded = !this.isExpanded;
    this.cdr.markForCheck();
  }

  // ─── Week data ─────────────────────────────────────────────────────────────

  /**
   * Builds a 7-element Mon→Sun array for the quest's week.
   * Recomputed on every render (driven by ngOnChanges when the quest
   * input reference changes, e.g. after countedDates is updated).
   */
  get weekDays(): WeekDay[] {
    const todayKey = this.toDateKey(new Date());
    const completions = this.habitStore.getCompletionsSync();
    const start = this.parseDateKey(this.quest.startDate);
    const days: WeekDay[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dateKey = this.toDateKey(date);
      const activeHabits = this.habitStore.getHabitsActiveOn(dateKey);
      const dayMap = completions[dateKey] ?? {};
      const doneCount = activeHabits.filter(h => dayMap[h.id] === true).length;

      days.push({
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dateStr: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dateKey,
        isCounted: this.quest.progress.countedDates.includes(dateKey),
        isFuture: dateKey > todayKey,
        isToday: dateKey === todayKey,
        doneCount,
        totalCount: activeHabits.length
      });
    }
    return days;
  }

  // ─── Existing helpers ──────────────────────────────────────────────────────

  get progressPercent(): number {
    return this.questService.getProgressPercent(this.quest);
  }

  get daysRemaining(): number {
    return this.questService.getDaysRemaining(this.quest);
  }

  onClaim(): void {
    const xp = this.questService.claimReward(this.quest.id);
    if (xp > 0) {
      this.claimed.emit(this.quest.id);
      this.cdr.markForCheck();
    }
  }

  // ─── Private utils ─────────────────────────────────────────────────────────

  private parseDateKey(dateKey: string): Date {
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private toDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
