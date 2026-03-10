import { Component, OnInit, signal, computed, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { QuestService } from '../../services/quest.service';
import { HabitStoreService } from '../../services/habit-store.service';
import { QuestCardComponent } from './quest-card/quest-card.component';
import { staggerFadeUp, noopAnimation } from '../../shared/list-animations';

type QuestTab = 'active' | 'completed';

@Component({
  selector: 'app-quests',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatSnackBarModule, QuestCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [staggerFadeUp || noopAnimation],
  template: `
    <div class="page-container quests-page">

      <!-- Page header -->
      <header class="quests-header">
        <div class="quests-header__title-row">
          <div class="quests-header__icon-wrap">
            <mat-icon>military_tech</mat-icon>
          </div>
          <div>
            <h1 class="quests-header__title">Quests</h1>
            <p class="quests-header__subtitle">Weekly challenges to push your limits</p>
          </div>
        </div>

        <!-- Summary chips -->
        <div class="quests-header__chips">
          <div class="quests-chip">
            <mat-icon>bolt</mat-icon>
            <span>{{ activeCount }} active</span>
          </div>
          <div class="quests-chip quests-chip--gold" *ngIf="readyToClaimCount > 0">
            <mat-icon>redeem</mat-icon>
            <span>{{ readyToClaimCount }} ready to claim</span>
          </div>
          <div class="quests-chip quests-chip--green">
            <mat-icon>check_circle</mat-icon>
            <span>{{ completedCount }} claimed</span>
          </div>
        </div>
      </header>

      <!-- Tab bar -->
      <div class="quests-tabs" role="tablist">
        <button
          class="quests-tab"
          role="tab"
          [class.quests-tab--active]="activeTab() === 'active'"
          [attr.aria-selected]="activeTab() === 'active'"
          type="button"
          (click)="setTab('active')">
          Active
          <span class="quests-tab__badge" *ngIf="activeCount > 0">{{ activeCount }}</span>
        </button>
        <button
          class="quests-tab"
          role="tab"
          [class.quests-tab--active]="activeTab() === 'completed'"
          [attr.aria-selected]="activeTab() === 'completed'"
          type="button"
          (click)="setTab('completed')">
          Claimed
          <span class="quests-tab__badge quests-tab__badge--green" *ngIf="completedCount > 0">{{ completedCount }}</span>
        </button>
      </div>

      <!-- Active quests list -->
      <section *ngIf="activeTab() === 'active'" [@staggerFadeUp]="activeQuests().length">
        <ng-container *ngIf="activeQuests().length > 0; else emptyActive">
          <app-quest-card
            *ngFor="let quest of activeQuests(); trackBy: trackById"
            [quest]="quest"
            (claimed)="onQuestClaimed($event)">
          </app-quest-card>
        </ng-container>

        <ng-template #emptyActive>
          <div class="quests-empty">
            <mat-icon>explore</mat-icon>
            <p class="quests-empty__title">No active quests</p>
            <p class="quests-empty__sub">New weekly quests are generated every Monday. Check back soon!</p>
          </div>
        </ng-template>
      </section>

      <!-- Claimed quests list -->
      <section *ngIf="activeTab() === 'completed'" [@staggerFadeUp]="completedQuests().length">
        <ng-container *ngIf="completedQuests().length > 0; else emptyClaimed">
          <app-quest-card
            *ngFor="let quest of completedQuests(); trackBy: trackById"
            [quest]="quest"
            (claimed)="onQuestClaimed($event)">
          </app-quest-card>
        </ng-container>

        <ng-template #emptyClaimed>
          <div class="quests-empty">
            <mat-icon>emoji_events</mat-icon>
            <p class="quests-empty__title">No claimed quests yet</p>
            <p class="quests-empty__sub">Complete a quest and claim your reward to see it here!</p>
          </div>
        </ng-template>
      </section>

    </div>
  `,
  styleUrl: './quests.component.sass'
})
export class QuestsComponent implements OnInit {

  readonly activeTab = signal<QuestTab>('active');

  readonly activeQuests = computed(() => this.questService.activeQuests());
  readonly completedQuests = computed(() => this.questService.completedQuests());

  get activeCount(): number {
    return this.activeQuests().length;
  }

  get completedCount(): number {
    return this.completedQuests().length;
  }

  get readyToClaimCount(): number {
    // activeQuests includes completed-but-unclaimed quests, so this count is correct
    return this.activeQuests().filter(q => q.progress.completed && !q.progress.claimedReward).length;
  }

  constructor(
    private questService: QuestService,
    private habitStore: HabitStoreService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.questService.generateWeeklyQuests();
    this.questService.debugQuestState();
  }

  setTab(tab: QuestTab): void {
    this.activeTab.set(tab);
  }

  onQuestClaimed(questId: string): void {
    const quest = this.questService.quests().find(q => q.id === questId);
    if (!quest) return;

    // Award quest XP to the global level system (visible in Overview/Profile)
    this.habitStore.addQuestBonusXP(quest.xpReward);

    this.snackBar.open(
      `+${quest.xpReward} XP earned! Quest "${quest.title}" complete.`,
      undefined,
      { duration: 3500, panelClass: ['snack-success'] }
    );
    this.cdr.markForCheck();
  }

  trackById(_: number, quest: { id: string }): string {
    return quest.id;
  }
}
