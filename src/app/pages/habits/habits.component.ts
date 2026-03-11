import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { Subscription, Observable } from 'rxjs';
import { HabitStoreService } from '../../services/habit-store.service';
import { Habit } from '../../models/habit.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/confirm-dialog.component';
import { ToggleComponent } from '../../shared/ui/toggle/toggle.component';
import { HabitEditDialogComponent, HabitEditDialogData } from './mobile-habits.edit-dialog.component';
import { getDomainConfig } from '../../config/domains.config';
import { staggerFadeUp, noopAnimation } from '../../shared/list-animations';

@Component({
  selector: 'app-habits',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatDialogModule,
    ToggleComponent,
    TitleCasePipe,
  ],
  animations: [staggerFadeUp || noopAnimation],
  template: `
    <div class="page-container habits-page">

      <!-- Page header -->
      <header class="habits-header">
        <div class="habits-header__title-row">
          <div class="habits-header__icon-wrap">
            <mat-icon>checklist</mat-icon>
          </div>
          <div>
            <h1 class="habits-header__title">Habits</h1>
            <p class="habits-header__subtitle">Your daily building blocks</p>
          </div>
        </div>

        <!-- Summary chips -->
        <div class="habits-header__chips">
          <div class="habits-chip">
            <mat-icon>bolt</mat-icon>
            <span>{{ activeCount }} active</span>
          </div>
          <div class="habits-chip habits-chip--muted" *ngIf="inactiveCount > 0">
            <mat-icon>pause_circle</mat-icon>
            <span>{{ inactiveCount }} paused</span>
          </div>
        </div>
      </header>

      <!-- Toolbar row: guidance + add button -->
      <div class="habits-toolbar">
        <div class="habits-guidance" [class.habits-guidance--warning]="isOverRecommended">
          <mat-icon>{{ isOverRecommended ? 'warning_amber' : 'lightbulb' }}</mat-icon>
          <span>{{ guidanceMessage }}</span>
        </div>
        <button class="btn btn-primary habits-add-btn" type="button" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon>
          Add Habit
        </button>
      </div>

      <!-- Loading state -->
      <ng-container *ngIf="ready$ | async; else loading">

        <!-- Empty state -->
        <div class="habits-empty" *ngIf="habits.length === 0">
          <mat-icon>checklist</mat-icon>
          <p class="habits-empty__title">No habits yet</p>
          <p class="habits-empty__sub">Add your first habit to start building consistency</p>
        </div>

        <!-- Habits list -->
        <div class="habits-list" *ngIf="habits.length > 0" [@staggerFadeUp]="habits.length">
          <div
            class="habit-card"
            *ngFor="let habit of habits; let i = index; trackBy: trackByHabitId"
            [class.habit-card--inactive]="!habit.isActive">

            <!-- Card header row: icon · meta badges · active toggle -->
            <div class="habit-card__header">
              <div class="habit-card__icon-wrap">
                <span class="habit-card__icon">{{ habit.icon || '✅' }}</span>
              </div>
              <div class="habit-card__badges">
                <span
                  class="habit-badge habit-badge--domain"
                  [style.--badge-color]="getDomainColor(habit.domain)"
                  [style.--badge-glow]="getDomainGlow(habit.domain)">
                  {{ getDomainEmoji(habit.domain) }} {{ getDomainLabel(habit.domain) }}
                </span>
                <span class="habit-badge" [class]="'habit-badge--diff-' + (habit.difficulty || 'easy')">
                  {{ (habit.difficulty || 'easy') | titlecase }}
                </span>
              </div>
              <app-toggle
                class="habit-card__toggle"
                [checked]="habit.isActive"
                (checkedChange)="toggleActive(habit.id)">
              </app-toggle>
            </div>

            <!-- Habit name -->
            <h3 class="habit-card__title">{{ habit.name }}</h3>

            <!-- Info row -->
            <div class="habit-card__info">
              <span class="habit-info-item">
                <mat-icon>repeat</mat-icon>
                {{ habit.frequencyType === 'weekly'
                    ? (habit.weeklyTarget || 3) + 'x / week'
                    : 'Daily' }}
              </span>
              <span class="habit-info-item" *ngIf="habit.minimumVersion">
                <mat-icon>flag</mat-icon>
                {{ habit.minimumVersion }}
              </span>
              <span class="habit-info-item" *ngIf="!habit.isActive">
                <mat-icon>pause_circle</mat-icon>
                Paused
              </span>
            </div>

            <!-- Action buttons -->
            <div class="habit-card__actions">
              <div class="habit-card__reorder">
                <button
                  class="btn btn-icon habit-icon-btn"
                  type="button"
                  (click)="moveHabit(i, i - 1)"
                  [disabled]="i === 0"
                  aria-label="Move up">
                  <mat-icon>arrow_upward</mat-icon>
                </button>
                <button
                  class="btn btn-icon habit-icon-btn"
                  type="button"
                  (click)="moveHabit(i, i + 1)"
                  [disabled]="i === habits.length - 1"
                  aria-label="Move down">
                  <mat-icon>arrow_downward</mat-icon>
                </button>
              </div>
              <div class="habit-card__edit-actions">
                <button
                  class="btn btn-icon habit-icon-btn"
                  type="button"
                  (click)="openEditDialog(habit)"
                  aria-label="Edit habit">
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  class="btn btn-icon habit-icon-btn habit-icon-btn--danger"
                  type="button"
                  (click)="confirmDelete(habit)"
                  aria-label="Delete habit">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>

          </div>
        </div>

      </ng-container>

      <ng-template #loading>
        <div class="habits-empty">
          <mat-icon>hourglass_empty</mat-icon>
          <p class="habits-empty__title">Loading habits…</p>
        </div>
      </ng-template>

    </div>
  `,
  styleUrls: ['./habits.component.sass']
})
export class HabitsComponent implements OnInit, OnDestroy {
  habits: Habit[] = [];
  activeCount = 0;
  inactiveCount = 0;
  ready$!: Observable<boolean>;

  private subscription = new Subscription();

  constructor(
    private habitStore: HabitStoreService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.ready$ = this.habitStore.getReady();
    this.subscription.add(
      this.habitStore.getHabits().subscribe(habits => {
        this.habits = [...habits].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        this.activeCount = habits.filter(h => h.isActive).length;
        this.inactiveCount = habits.filter(h => !h.isActive).length;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  // ── Domain helpers ────────────────────────────────────────────────────────

  getDomainColor(domain: string | undefined): string {
    return getDomainConfig(domain as any).color;
  }

  getDomainGlow(domain: string | undefined): string {
    return getDomainConfig(domain as any).glowColor;
  }

  getDomainLabel(domain: string | undefined): string {
    return getDomainConfig(domain as any).label;
  }

  getDomainEmoji(domain: string | undefined): string {
    return getDomainConfig(domain as any).emoji;
  }

  // ── Computed state ────────────────────────────────────────────────────────

  get isOverRecommended(): boolean {
    return this.activeCount > 6;
  }

  get guidanceMessage(): string {
    if (this.activeCount === 0) return 'Add your first habit to get started.';
    if (this.activeCount <= 3) return 'Great — keep it small. Consistency beats intensity.';
    if (this.activeCount <= 6) return 'Nice. Try to keep it under 6 for the best streak success.';
    return 'More habits = less consistency. Consider pausing some.';
  }

  // ── Dialog actions ────────────────────────────────────────────────────────

  openCreateDialog(): void {
    this.dialog.open<HabitEditDialogComponent, HabitEditDialogData>(HabitEditDialogComponent, {
      data: { mode: 'create', title: 'New Habit' },
      width: '420px',
      maxWidth: '95vw',
      panelClass: 'habit-dialog'
    });
  }

  openEditDialog(habit: Habit): void {
    this.dialog.open<HabitEditDialogComponent, HabitEditDialogData>(HabitEditDialogComponent, {
      data: { mode: 'edit', title: 'Edit Habit', habit },
      width: '420px',
      maxWidth: '95vw',
      panelClass: 'habit-dialog'
    });
  }

  // ── Habit operations ──────────────────────────────────────────────────────

  toggleActive(habitId: string): void {
    this.habitStore.toggleHabitActive(habitId);
  }

  moveHabit(fromIndex: number, toIndex: number): void {
    this.habitStore.reorderHabits(fromIndex, toIndex);
  }

  confirmDelete(habit: Habit): void {
    const dialogRef = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          title: 'Delete habit?',
          message: `Delete "${habit.name}"? This won't remove history unless you confirm.`,
          confirmLabel: 'Delete'
        }
      }
    );
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.habitStore.deleteHabit(habit.id);
      }
    });
  }

  trackByHabitId(_index: number, habit: Habit): string {
    return habit.id;
  }
}
