import { Component, OnInit, OnDestroy, HostListener, Inject, PLATFORM_ID, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { Subscription, combineLatest, Observable } from 'rxjs';
import { HabitStoreService } from '../../services/habit-store.service';
import { Habit, MonthKey, MonthSlot, HabitSkips, HabitCompletion, DomainConfig } from '../../models/habit.model';
import { DomainService } from '../../services/domain.service';
import { DOMAINS } from '../../config/domains.config';
import { DateUtils } from '../../shared/date-utils';
import { getDailyMotivation } from '../../shared/daily-motivations';
import { DayCountPipe } from '../../shared/day-count.pipe';
import { ThemeService } from '../../services/theme.service';
import { staggerFadeUp, noopAnimation } from '../../shared/list-animations';
import { Router } from '@angular/router';
import { getLevelProgress, LevelProgress } from '../../shared/level-utils';
import { BackupService } from '../../services/backup.service';
import { WeeklyReportShareService } from '../../services/weekly-report-share.service';
import { WeeklyReportService } from '../../services/weekly-report.service';

type CalendarCell = {
  dayNumber: number | null;
  dateKey: string | null;
  date: Date | null;
  done: number;
  goal: number;
  percent: number;
  isPerfect: boolean;
  isSelected: boolean;
  isToday: boolean;
  intensityClass: string;
};

type WeekSummary = {
  weekIndex: number;
  done: number;
  goal: number;
  percent: number;
  perfectDays: number;
  dateKeys: string[];
  startDate: Date | null;
  endDate: Date | null;
  rangeLabel: string;
};

type SelectedDateHabits = {
  dateKey: string;
  date: Date | null;
  completed: Habit[];
  incomplete: Habit[];
};

type MonthlySharePayload = {
  playerName: string;
  playerMeta: string;
  monthLabel: string;
  level: number;
  totalXp: number;
  monthDone: number;
  monthGoal: number;
  monthPercent: number;
  perfectDays: number;
  totalDaysInMonth: number;
  bestWeekLabel: string;
  bestWeekPercent: number;
  domains: Array<{ label: string; emoji: string; level: number; xp: number; percent: number }>;
  footerSummary: string;
};

type OverallSharePayload = {
  playerName: string;
  playerRank: string;
  level: number;
  totalXp: number;
  currentStreak: number;
  bestStreak: number;
  totalDone: number;
  totalGoal: number;
  overallPercent: number;
  totalPerfectDays: number;
  activeSince: string;
  domains: Array<{ label: string; emoji: string; level: number; xp: number; percent: number }>;
  footerSummary: string;
};

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatSnackBarModule, MatIconModule, DayCountPipe],
  animations: [staggerFadeUp || noopAnimation],
  template: `
<div class="page-container overview-page" [@.disabled]="reduceMotion" [class.reduce-motion]="reduceMotion">

  <!-- ── PLAYER HERO CARD ─────────────────────────────────────────── -->
  <div class="player-hero">
    <div class="player-hero__rank-badge" [attr.data-rank]="playerRank">{{ playerRank }}</div>
    <div class="player-hero__info">
      <div class="player-hero__name">{{ playerDisplayName }}</div>
      <div class="player-hero__title">{{ playerTitle }}</div>
    </div>
    <div class="player-hero__chips">
      <div class="hero-chip hero-chip--fire">
        <span class="hero-chip__icon">🔥</span>
        <span>{{ currentStreak }}d</span>
      </div>
      <div class="hero-chip hero-chip--bolt">
        <span class="hero-chip__icon">⚡</span>
        <span>Lv {{ levelStats.level }}</span>
      </div>
      <div class="hero-chip hero-chip--perfect" *ngIf="weekAttendanceCount > 0">
        <span class="hero-chip__icon">✦</span>
        <span>{{ weekAttendanceCount }}/{{ weekTotalDays }}</span>
      </div>
    </div>
  </div>

  <!-- ── MANA BAR (XP Progress) ──────────────────────────────────── -->
  <div class="mana-bar-section">
    <div class="mana-bar-labels">
      <span class="mana-bar-label">MANA · LV {{ levelStats.level }}</span>
      <span class="mana-bar-xp">{{ levelStats.progressInLevel }} / {{ levelStats.requiredThisLevel }} XP</span>
    </div>
    <div class="mana-bar-track">
      <div class="mana-bar-fill" [style.width.%]="levelStats.progressPercent"></div>
      <div class="mana-bar-shine"></div>
    </div>
    <div class="mana-bar-sub">{{ levelStats.remainingToNext }} XP to Level {{ levelStats.nextLevel }}</div>
  </div>

  <ng-container *ngIf="ready$ | async; else loading">
    <ng-container *ngIf="hasAnyData; else emptyState">

      <!-- ── STAT CRYSTALS ──────────────────────────────────────────── -->
      <div class="stat-crystals" [@staggerFadeUp]="animationKey">
        <div class="crystal crystal--streak">
          <div class="crystal__label">STREAK</div>
          <div class="crystal__value">{{ currentStreak | dayCount }}</div>
          <div class="crystal__glow"></div>
        </div>
        <div class="crystal crystal--level">
          <div class="crystal__label">LEVEL</div>
          <div class="crystal__value">{{ levelStats.level }}</div>
          <div class="crystal__sub">{{ levelStats.totalXp }} XP total</div>
          <div class="crystal__glow"></div>
        </div>
        <div class="crystal crystal--perfect">
          <div class="crystal__label">PERFECT DAYS</div>
          <div class="crystal__value">{{ weekAttendanceCount }}<span class="crystal__denom">/{{ weekTotalDays }}</span></div>
          <div class="crystal__sub">this week</div>
          <div class="crystal__glow"></div>
        </div>
        <div class="crystal crystal--action">
          <div class="crystal__label">NEXT MISSION</div>
          <div class="crystal__value-sm">{{ nextBestActionText }}</div>
          <button class="btn-arise" type="button" (click)="goToTodayAction()" [disabled]="todayRemainingCount === 0">
            <span>{{ todayRemainingCount === 0 ? 'ALL DONE' : 'ARISE' }}</span>
          </button>
          <div class="crystal__glow"></div>
        </div>
      </div>

      <!-- ── TOGGLE BUTTON ─────────────────────────────────────────── -->
      <button class="overview-toggle-btn" type="button" (click)="toggleInsights()">
        <span class="toggle-btn__line"></span>
        <span class="toggle-btn__text">{{ insightsOpen ? '▲ HIDE DETAILS' : '▼ SHOW DETAILS' }}</span>
        <span class="toggle-btn__line"></span>
      </button>

      <!-- ── DETAILS SECTION ───────────────────────────────────────── -->
      <div class="details-section" [class.is-collapsed]="!insightsOpen">

        <!-- DOMAIN MASTERY -->
        <div class="domain-mastery-section" *ngIf="domainStats.length > 0">
          <div class="section-kicker">
            <span class="section-kicker__line"></span>
            DOMAIN MASTERY
            <span class="section-kicker__line"></span>
          </div>
          <div class="domain-cards">
            <div class="domain-card"
                 *ngFor="let d of domainStats"
                 [style.--d-color]="d.config.color"
                 [style.--d-glow]="d.config.glowColor">
              <div class="domain-card__header">
                <span class="domain-card__emoji">{{ d.config.emoji }}</span>
                <div class="domain-card__info">
                  <div class="domain-card__name">{{ d.config.label }}</div>
                  <div class="domain-card__rank-row">
                    <span class="domain-card__lv">LV {{ d.level }}</span>
                    <span class="domain-card__rank-badge" [attr.data-rank]="getDomainRank(d.level)">{{ getDomainRank(d.level) }}</span>
                  </div>
                </div>
                <div class="domain-card__xp">{{ d.xp }} XP</div>
              </div>
              <div class="domain-card__bar-track">
                <div class="domain-card__bar-fill" [style.width.%]="d.percent"></div>
              </div>
              <div class="domain-card__progress">{{ d.current }} / {{ d.needed }} XP → LV {{ d.level + 1 }}</div>
            </div>
          </div>
        </div>

        <!-- ACTIVITY CALENDAR -->
        <div class="cal-section arcane-card">
          <div class="cal-nav">
            <button class="cal-nav__arrow" type="button" (click)="navigateCalendarMonth(-1)">‹</button>
            <div class="cal-nav__center">
              <div class="cal-nav__month">{{ calendarViewLabel }}</div>
              <div class="cal-nav__stats">{{ perfectDaysCount }} perfect · {{ completionPercent }}% done</div>
            </div>
            <button class="cal-nav__arrow" type="button" (click)="navigateCalendarMonth(1)" [disabled]="isCurrentMonth">›</button>
          </div>
          <div class="cal-year-nav">
            <button class="cal-year-btn" type="button" (click)="navigateCalendarYear(-1)">« {{ calendarViewYear - 1 }}</button>
            <span class="cal-year-current">{{ calendarViewYear }}</span>
            <button class="cal-year-btn" type="button" (click)="navigateCalendarYear(1)" [disabled]="calendarViewYear >= currentYear">{{ calendarViewYear + 1 }} »</button>
          </div>
          <div class="cal-dow-labels">
            <span *ngFor="let d of ['M','T','W','T','F','S','S']">{{ d }}</span>
          </div>
          <div class="cal-grid">
            <div class="cal-cell cal-cell--empty" *ngFor="let _ of firstWeekOffset"></div>
            <div class="cal-cell"
                 *ngFor="let cell of heatmapCells; trackBy: trackByCalendarCell"
                 [class.cal-cell--perfect]="cell.isPerfect"
                 [class.cal-cell--today]="cell.isToday"
                 [class.cal-cell--selected]="cell.isSelected"
                 [class.cal-cell--done]="cell.percent > 0 && !cell.isPerfect"
                 [style.--intensity]="cell.percent / 100"
                 [title]="(cell.dayNumber || '') + ' · ' + cell.done + '/' + cell.goal + ' habits'"
                 (click)="selectDay(cell)">
              <span class="cal-cell__day">{{ cell.dayNumber }}</span>
              <span class="cal-cell__dot" *ngIf="cell.isPerfect">★</span>
            </div>
          </div>
          <div class="cal-legend">
            <span class="cal-legend__label">Less</span>
            <div class="cal-legend__cell" style="--intensity: 0"></div>
            <div class="cal-legend__cell" style="--intensity: 0.25"></div>
            <div class="cal-legend__cell" style="--intensity: 0.5"></div>
            <div class="cal-legend__cell" style="--intensity: 0.75"></div>
            <div class="cal-legend__cell" style="--intensity: 1"></div>
            <div class="cal-legend__cell cal-legend__cell--perfect"></div>
            <span class="cal-legend__label">★ Perfect</span>
          </div>
        </div>

        <!-- DAILY HABITS - VICTORIES / DEFEATS -->
        <ng-container *ngIf="selectedDateHabits$ | async as sdh">
          <div class="mission-report arcane-card">
            <div class="mission-report__header">
              <span class="mission-report__date">{{ sdh.date ? (sdh.date | date:'EEE, MMM d') : sdh.dateKey }}</span>
              <span class="mission-report__summary">{{ sdh.completed.length }} done · {{ sdh.incomplete.length }} missed</span>
            </div>
            <div class="mission-columns">
              <!-- VICTORIES -->
              <div class="mission-group mission-group--won">
                <div class="mission-group__title">
                  <span class="mission-group__icon">⚔️</span>
                  VICTORIES
                  <span class="mission-group__count">{{ sdh.completed.length }}</span>
                </div>
                <div class="mission-empty" *ngIf="sdh.completed.length === 0">No victories yet today</div>
                <div class="mission-item mission-item--won"
                     *ngFor="let habit of sdh.completed; trackBy: trackByHabitId">
                  <span class="mission-item__check">✓</span>
                  <span class="mission-item__name">{{ habit.name }}</span>
                </div>
              </div>
              <!-- DEFEATS -->
              <div class="mission-group mission-group--lost">
                <div class="mission-group__title">
                  <span class="mission-group__icon">💀</span>
                  FALLEN
                  <span class="mission-group__count">{{ sdh.incomplete.length }}</span>
                </div>
                <div class="mission-empty" *ngIf="sdh.incomplete.length === 0">No fallen missions!</div>
                <div class="mission-item mission-item--lost"
                     *ngFor="let habit of sdh.incomplete; trackBy: trackByHabitId">
                  <span class="mission-item__x">✗</span>
                  <span class="mission-item__name">{{ habit.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- WEEKLY POWER - MANAA STYLE -->
        <div class="manaa-section arcane-card">
          <div class="manaa-section__header">
            <div class="manaa-section__title-col">
              <div class="section-kicker-inline">WEEKLY POWER</div>
              <div class="manaa-section__range" *ngIf="selectedWeekRangeLabel">{{ selectedWeekRangeLabel }}</div>
            </div>
            <div class="manaa-week-tabs" *ngIf="weeklySummaries.length > 0">
              <button class="manaa-week-tab"
                      type="button"
                      *ngFor="let week of weeklySummaries; trackBy: trackByWeek"
                      [class.is-active]="week.weekIndex === selectedWeekIndex"
                      (click)="selectWeekByIndex(week.weekIndex)">
                W{{ week.weekIndex + 1 }}
              </button>
            </div>
          </div>

          <div class="manaa-rows">
            <div class="manaa-row"
                 *ngFor="let week of weeklySummaries; trackBy: trackByWeek"
                 [class.is-selected]="week.weekIndex === selectedWeekIndex"
                 (click)="selectWeekByIndex(week.weekIndex)">
              <div class="manaa-row__meta">
                <span class="manaa-row__label">W{{ week.weekIndex + 1 }}</span>
                <span class="manaa-row__fraction">{{ week.done }}/{{ week.goal }}</span>
                <span class="manaa-row__perfect">🔥 {{ week.perfectDays }}</span>
                <span class="manaa-row__pct" [class.manaa-row__pct--high]="week.percent >= 80">{{ week.percent }}%</span>
              </div>
              <div class="manaa-row__bar-track">
                <div class="manaa-row__bar-fill" [style.width.%]="week.percent"
                     [class.manaa-row__bar-fill--full]="week.percent === 100"
                     [class.manaa-row__bar-fill--high]="week.percent >= 80 && week.percent < 100"
                     [class.manaa-row__bar-fill--low]="week.percent < 40"></div>
              </div>
            </div>
          </div>

          <!-- SHARE BUTTONS -->
          <div class="share-strip">
            <button class="share-btn share-btn--week"
                    type="button"
                    (click)="shareWeeklyReport()"
                    [disabled]="!canShareWeeklyReport || weeklyReportBusy">
              <span class="share-btn__icon">📊</span>
              <span class="share-btn__text">{{ weeklyReportBusy ? 'Capturing...' : 'WEEK REPORT' }}</span>
            </button>
            <button class="share-btn share-btn--month"
                    type="button"
                    (click)="shareMonthlyReport()"
                    [disabled]="!canShareWeeklyReport || monthlyReportBusy">
              <span class="share-btn__icon">📅</span>
              <span class="share-btn__text">{{ monthlyReportBusy ? 'Capturing...' : 'MONTH REPORT' }}</span>
            </button>
            <button class="share-btn share-btn--overall"
                    type="button"
                    (click)="shareOverallReport()"
                    [disabled]="!canShareWeeklyReport || overallReportBusy">
              <span class="share-btn__icon">🏆</span>
              <span class="share-btn__text">{{ overallReportBusy ? 'Capturing...' : 'ALL-TIME' }}</span>
            </button>
          </div>
        </div>

      </div><!-- end details-section -->
    </ng-container>
    <ng-template #emptyState>
      <div class="empty-state-card arcane-card">
        <div class="empty-state__icon">⚔️</div>
        <div class="empty-state__title">Your journey begins</div>
        <div class="empty-state__sub">Add your first habit to start leveling up.</div>
        <button class="btn-arise" type="button" (click)="goToTodayAction()">BEGIN</button>
      </div>
    </ng-template>
  </ng-container>
  <ng-template #loading>
    <div class="loading-card arcane-card">
      <div class="loading-spinner"></div>
      <div>Loading your stats...</div>
    </div>
  </ng-template>

  <!-- ── WEEKLY REPORT EXPORT (off-screen) ────────────────────────── -->
  <div class="report-export-host" *ngIf="weeklySharePayload" aria-hidden="true">
    <section id="weeklyReportExportRoot" #weeklyReportExportRoot class="report-export-root report-export-mode">
      <div class="share-card share-card--weekly">
        <div class="share-card__bg-glow share-card__bg-glow--blue"></div>
        <div class="share-card__bg-glow share-card__bg-glow--purple"></div>

        <div class="share-card__header">
          <div class="share-card__rank-badge" [attr.data-rank]="playerRank">{{ playerRank }}</div>
          <div class="share-card__player">
            <div class="share-card__name">{{ weeklySharePayload.headerName || 'Player' }}</div>
            <div class="share-card__meta">{{ weeklySharePayload.headerMeta }}</div>
          </div>
          <div class="share-card__app-tag">HABIT<br>SYSTEM</div>
        </div>

        <div class="share-card__report-type">WEEKLY REPORT</div>
        <div class="share-card__period">{{ weeklySharePayload.weekRangeLabel }}</div>

        <div class="share-card__stats-grid">
          <div class="share-stat">
            <div class="share-stat__label">COMPLETED</div>
            <div class="share-stat__value">{{ weeklySharePayload.stats.completed }}<span class="share-stat__of">/{{ weeklySharePayload.stats.goal }}</span></div>
            <div class="share-stat__pct">{{ weeklySharePayload.stats.goal > 0 ? ((weeklySharePayload.stats.completed / weeklySharePayload.stats.goal) * 100 | number:'1.0-0') : 0 }}%</div>
          </div>
          <div class="share-stat">
            <div class="share-stat__label">PERFECT DAYS</div>
            <div class="share-stat__value">{{ weeklySharePayload.stats.perfectDays }}</div>
            <div class="share-stat__pct">out of 7</div>
          </div>
          <div class="share-stat">
            <div class="share-stat__label">WEEK XP</div>
            <div class="share-stat__value share-stat__value--gold">+{{ weeklySharePayload.stats.weekXp }}</div>
            <div class="share-stat__pct">gained</div>
          </div>
          <div class="share-stat">
            <div class="share-stat__label">BEST STREAK</div>
            <div class="share-stat__value">{{ weeklySharePayload.stats.bestStreak }}</div>
            <div class="share-stat__pct">days</div>
          </div>
        </div>

        <div class="share-card__section-label">MISSION LOG</div>
        <div class="share-card__habits" *ngIf="weeklySharePayload.habits.length > 0">
          <div class="share-habit" *ngFor="let habit of weeklySharePayload.habits.slice(0, 8); let i = index">
            <div class="share-habit__head">
              <span class="share-habit__num">{{ i + 1 }}</span>
              <span class="share-habit__name">{{ habit.name }}</span>
              <span class="share-habit__metric">{{ habit.doneCount }}/{{ habit.daysActive }}</span>
            </div>
            <div class="share-habit__bar-track">
              <div class="share-habit__bar-fill"
                   [style.width.%]="habit.daysActive > 0 ? ((habit.doneCount / habit.daysActive) * 100) : 0"
                   [class.share-habit__bar-fill--full]="habit.doneCount === habit.daysActive"></div>
            </div>
          </div>
        </div>

        <div class="share-card__level-row" *ngIf="weeklySharePayload.levelLine">
          <div class="share-level-label">LEVEL PROGRESS</div>
          <div class="share-level-value">{{ weeklySharePayload.levelLine }}</div>
          <div class="share-level-bar-track">
            <div class="share-level-bar-fill" [style.width.%]="levelStats.progressPercent"></div>
          </div>
          <div class="share-level-sub" *ngIf="weeklySharePayload.levelSubline">{{ weeklySharePayload.levelSubline }}</div>
        </div>

        <div class="share-card__footer">
          <div class="share-card__footer-text">{{ weeklySharePayload.footerSummary }}</div>
          <div class="share-card__footer-badge">🔥 KEEP GOING</div>
        </div>
        <div class="share-card__watermark">HabitSystem · Gen-Z Edition</div>
      </div>
    </section>
  </div>

  <!-- ── MONTHLY REPORT EXPORT (off-screen) ───────────────────────── -->
  <div class="report-export-host" *ngIf="monthlySharePayload" aria-hidden="true">
    <section id="monthlyReportExportRoot" #monthlyReportExportRoot class="report-export-root report-export-mode">
      <div class="share-card share-card--monthly">
        <div class="share-card__bg-glow share-card__bg-glow--cyan"></div>
        <div class="share-card__bg-glow share-card__bg-glow--gold"></div>

        <div class="share-card__header">
          <div class="share-card__rank-badge" [attr.data-rank]="playerRank">{{ playerRank }}</div>
          <div class="share-card__player">
            <div class="share-card__name">{{ monthlySharePayload.playerName }}</div>
            <div class="share-card__meta">{{ monthlySharePayload.playerMeta }}</div>
          </div>
          <div class="share-card__app-tag">HABIT<br>SYSTEM</div>
        </div>

        <div class="share-card__report-type">MONTHLY REPORT</div>
        <div class="share-card__period">{{ monthlySharePayload.monthLabel }}</div>

        <div class="share-card__month-ring-row">
          <div class="share-month-ring">
            <svg viewBox="0 0 120 120" width="120" height="120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(61,127,255,0.12)" stroke-width="10"/>
              <circle cx="60" cy="60" r="50" fill="none"
                      [attr.stroke]="monthlySharePayload.monthPercent >= 80 ? '#ffd700' : monthlySharePayload.monthPercent >= 50 ? '#00e5ff' : '#3d7fff'"
                      stroke-width="10"
                      stroke-linecap="round"
                      stroke-dasharray="314"
                      [attr.stroke-dashoffset]="314 - (314 * monthlySharePayload.monthPercent / 100)"
                      transform="rotate(-90 60 60)"/>
            </svg>
            <div class="share-month-ring__inner">
              <div class="share-month-ring__pct">{{ monthlySharePayload.monthPercent }}%</div>
              <div class="share-month-ring__label">done</div>
            </div>
          </div>
          <div class="share-month-ring-stats">
            <div class="share-ring-stat">
              <div class="share-ring-stat__val">{{ monthlySharePayload.monthDone }}</div>
              <div class="share-ring-stat__label">HABITS DONE</div>
            </div>
            <div class="share-ring-stat">
              <div class="share-ring-stat__val share-ring-stat__val--gold">{{ monthlySharePayload.perfectDays }}</div>
              <div class="share-ring-stat__label">PERFECT DAYS</div>
            </div>
            <div class="share-ring-stat">
              <div class="share-ring-stat__val">{{ monthlySharePayload.totalDaysInMonth }}</div>
              <div class="share-ring-stat__label">DAYS IN MONTH</div>
            </div>
          </div>
        </div>

        <div class="share-card__section-label">BEST WEEK</div>
        <div class="share-best-week">
          <span class="share-best-week__label">{{ monthlySharePayload.bestWeekLabel }}</span>
          <div class="share-best-week__bar-track">
            <div class="share-best-week__bar-fill" [style.width.%]="monthlySharePayload.bestWeekPercent"></div>
          </div>
          <span class="share-best-week__pct">{{ monthlySharePayload.bestWeekPercent }}%</span>
        </div>

        <div class="share-card__section-label" *ngIf="monthlySharePayload.domains.length > 0">DOMAIN PROGRESS</div>
        <div class="share-domains" *ngIf="monthlySharePayload.domains.length > 0">
          <div class="share-domain" *ngFor="let d of monthlySharePayload.domains.slice(0, 4)">
            <span class="share-domain__emoji">{{ d.emoji }}</span>
            <div class="share-domain__info">
              <div class="share-domain__name">{{ d.label }}</div>
              <div class="share-domain__bar-track">
                <div class="share-domain__bar-fill" [style.width.%]="d.percent"></div>
              </div>
            </div>
            <span class="share-domain__lv">LV {{ d.level }}</span>
          </div>
        </div>

        <div class="share-card__footer">
          <div class="share-card__footer-text">{{ monthlySharePayload.footerSummary }}</div>
          <div class="share-card__footer-badge">🌙 MONTH CLEARED</div>
        </div>
        <div class="share-card__watermark">HabitSystem · Gen-Z Edition</div>
      </div>
    </section>
  </div>

  <!-- ── OVERALL REPORT EXPORT (off-screen) ───────────────────────── -->
  <div class="report-export-host" *ngIf="overallSharePayload" aria-hidden="true">
    <section id="overallReportExportRoot" #overallReportExportRoot class="report-export-root report-export-mode">
      <div class="share-card share-card--overall">
        <div class="share-card__bg-glow share-card__bg-glow--purple"></div>
        <div class="share-card__bg-glow share-card__bg-glow--gold-center"></div>

        <div class="share-card__header">
          <div class="share-card__rank-badge share-card__rank-badge--large" [attr.data-rank]="overallSharePayload.playerRank">{{ overallSharePayload.playerRank }}</div>
          <div class="share-card__player">
            <div class="share-card__name">{{ overallSharePayload.playerName }}</div>
            <div class="share-card__meta">Level {{ overallSharePayload.level }} · {{ overallSharePayload.totalXp }} XP</div>
          </div>
          <div class="share-card__app-tag">HABIT<br>SYSTEM</div>
        </div>

        <div class="share-card__report-type">ALL-TIME STATS</div>
        <div class="share-card__period">Since {{ overallSharePayload.activeSince }}</div>

        <div class="share-card__stats-grid share-card__stats-grid--4">
          <div class="share-stat share-stat--large">
            <div class="share-stat__label">TOTAL DONE</div>
            <div class="share-stat__value share-stat__value--cyan">{{ overallSharePayload.totalDone }}</div>
            <div class="share-stat__pct">{{ overallSharePayload.overallPercent }}% rate</div>
          </div>
          <div class="share-stat share-stat--large">
            <div class="share-stat__label">BEST STREAK</div>
            <div class="share-stat__value share-stat__value--gold">{{ overallSharePayload.bestStreak }}</div>
            <div class="share-stat__pct">days</div>
          </div>
          <div class="share-stat share-stat--large">
            <div class="share-stat__label">PERFECT DAYS</div>
            <div class="share-stat__value">{{ overallSharePayload.totalPerfectDays }}</div>
            <div class="share-stat__pct">all time</div>
          </div>
          <div class="share-stat share-stat--large">
            <div class="share-stat__label">CURR STREAK</div>
            <div class="share-stat__value">{{ overallSharePayload.currentStreak }}</div>
            <div class="share-stat__pct">days 🔥</div>
          </div>
        </div>

        <div class="share-overall__level-section">
          <div class="share-card__section-label">LEVEL MASTERY</div>
          <div class="share-overall__level-display">
            <div class="share-overall__rank-big" [attr.data-rank]="overallSharePayload.playerRank">{{ overallSharePayload.playerRank }}</div>
            <div class="share-overall__level-info">
              <div class="share-overall__level-num">Level {{ overallSharePayload.level }}</div>
              <div class="share-overall__xp">{{ overallSharePayload.totalXp }} Total XP</div>
              <div class="share-overall__bar-track">
                <div class="share-overall__bar-fill" [style.width.%]="levelStats.progressPercent"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="share-card__section-label" *ngIf="overallSharePayload.domains.length > 0">DOMAIN MASTERY</div>
        <div class="share-domains share-domains--overall" *ngIf="overallSharePayload.domains.length > 0">
          <div class="share-domain" *ngFor="let d of overallSharePayload.domains.slice(0, 5)">
            <span class="share-domain__emoji">{{ d.emoji }}</span>
            <div class="share-domain__info">
              <div class="share-domain__name">{{ d.label }}</div>
              <div class="share-domain__bar-track">
                <div class="share-domain__bar-fill" [style.width.%]="d.percent"></div>
              </div>
            </div>
            <span class="share-domain__lv">LV {{ d.level }}</span>
          </div>
        </div>

        <div class="share-card__footer">
          <div class="share-card__footer-text">{{ overallSharePayload.footerSummary }}</div>
          <div class="share-card__footer-badge">👑 SHADOW SYSTEM</div>
        </div>
        <div class="share-card__watermark">HabitSystem · Gen-Z Edition</div>
      </div>
    </section>
  </div>

</div>
  `,
  styleUrls: ['./overview.component.sass']
})
export class OverviewComponent implements OnInit, OnDestroy {
  @ViewChild('weeklyReportExportRoot') weeklyReportExportRoot?: ElementRef<HTMLElement>;
  @ViewChild('monthlyReportExportRoot') monthlyReportExportRoot?: ElementRef<HTMLElement>;
  @ViewChild('overallReportExportRoot') overallReportExportRoot?: ElementRef<HTMLElement>;

  // Calendar view state (local, independent of store)
  calendarViewYear: number = new Date().getFullYear();
  calendarViewMonth: number = new Date().getMonth();

  monthMatrix: MonthSlot[][] = [];
  selectedMonthYear: MonthKey | null = null;
  animationKey = 0;
  reduceMotion = false;
  private lastMonthKey: string | null = null;
  weekDayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  calendarCells: CalendarCell[] = [];
  weeklySummaries: WeekSummary[] = [];
  selectedDateKey = '';
  completionPercent = 0;
  perfectDaysCount = 0;
  currentStreak = 0;
  bestWeekLabel = '--';
  weekAttendanceCount = 0;
  weekTotalDays = 7;
  todayRemainingCount = 0;
  nextBestActionText = '';
  hasAnyData = false;
  activeHabitsCount = 0;
  levelStats: LevelProgress = getLevelProgress(0);
  insightsOpen = true;
  isMobile = false;
  private hasSetInsightsDefault = false;
  private todayKey = '';
  private gridRows = 6;
  canShareWeeklyReport = false;
  weeklyReportBusy = false;
  monthlyReportBusy = false;
  overallReportBusy = false;
  weeklySharePayload: Parameters<BackupService['exportWeeklyReportPng']>[0] | null = null;
  monthlySharePayload: MonthlySharePayload | null = null;
  overallSharePayload: OverallSharePayload | null = null;
  selectedWeekIndex = 0;
  selectedWeekRangeLabel = '';
  private latestCompletions: Record<string, Record<string, boolean>> = {};
  ready$!: Observable<boolean>;
  selectedDateHabits$!: Observable<SelectedDateHabits>;
  domainStats: Array<{
    config: DomainConfig;
    xp: number;
    level: number;
    percent: number;
    current: number;
    needed: number;
  }> = [];

  private subscription: Subscription = new Subscription();

  constructor(
    private habitStore: HabitStoreService,
    private themeService: ThemeService,
    private router: Router,
    private weeklyReportShareService: WeeklyReportShareService,
    private weeklyReportService: WeeklyReportService,
    private domainService: DomainService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    this.todayKey = this.habitStore.toDateKey(new Date());
    this.canShareWeeklyReport = isPlatformBrowser(this.platformId);
    this.ready$ = this.habitStore.getReady();
    this.selectedDateHabits$ = this.habitStore.getSelectedDateHabitBreakdown();
    this.setViewportFlags();

    // Initialize calendar view from store's current month
    const initialMonth = this.habitStore.getSelectedMonthYearSync();
    this.calendarViewYear = initialMonth.year;
    this.calendarViewMonth = initialMonth.month;

    this.subscription.add(
      combineLatest([
        this.habitStore.getSelectedMonthYear(),
        this.habitStore.getHabits(),
        this.habitStore.getCompletions(),
        this.habitStore.getSkips(),
        this.habitStore.getSelectedDateKey(),
        this.habitStore.getLevelStats()
      ]).subscribe(([monthYear, habits, completions, skips, selectedDateKey, levelStats]) => {
        this.selectedMonthYear = monthYear;
        this.selectedDateKey = selectedDateKey;
        this.levelStats = levelStats;
        this.latestCompletions = completions;
        const domainXP = this.domainService.computeDomainXP(habits, completions as HabitCompletion);
        this.domainStats = DOMAINS.map(config => {
          const xp = domainXP[config.id] ?? 0;
          const progress = this.domainService.getDomainProgress(xp);
          return { config, xp, ...progress };
        }).filter(d => d.xp > 0 || habits.some(h => h.domain === d.config.id));
        this.updateData(habits, completions, skips);
      })
    );
    this.subscription.add(
      this.themeService.getReducedMotion().subscribe(reduce => {
        this.reduceMotion = reduce;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.setViewportFlags();
  }

  // ── Calendar navigation ────────────────────────────────────────────────────

  navigateCalendarMonth(dir: -1 | 1): void {
    let month = this.calendarViewMonth + dir;
    let year = this.calendarViewYear;
    if (month < 0) { month = 11; year--; }
    if (month > 11) { month = 0; year++; }
    const today = new Date();
    if (year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth())) {
      return;
    }
    this.calendarViewYear = year;
    this.calendarViewMonth = month;
    this.rebuildCalendarForView();
  }

  navigateCalendarYear(dir: -1 | 1): void {
    const newYear = this.calendarViewYear + dir;
    const today = new Date();
    if (newYear > today.getFullYear()) return;
    this.calendarViewYear = newYear;
    // Clamp month if we're now in the future
    if (newYear === today.getFullYear() && this.calendarViewMonth > today.getMonth()) {
      this.calendarViewMonth = today.getMonth();
    }
    this.rebuildCalendarForView();
  }

  private rebuildCalendarForView(): void {
    this.monthMatrix = DateUtils.getMonthMatrix(this.calendarViewYear, this.calendarViewMonth);
    this.gridRows = this.getGridRows(this.calendarViewYear, this.calendarViewMonth);
    this.buildCalendar(this.latestCompletions);
    const monthKey = `${this.calendarViewYear}-${this.calendarViewMonth}`;
    if (this.lastMonthKey !== monthKey) {
      this.animationKey++;
      this.lastMonthKey = monthKey;
    }
  }

  get calendarViewLabel(): string {
    return new Date(this.calendarViewYear, this.calendarViewMonth, 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  get isCurrentMonth(): boolean {
    const today = new Date();
    return this.calendarViewYear === today.getFullYear() && this.calendarViewMonth === today.getMonth();
  }

  get currentYear(): number {
    return new Date().getFullYear();
  }

  // ── Player rank / title ────────────────────────────────────────────────────

  get playerRank(): string {
    const lv = this.levelStats.level;
    if (lv >= 81) return 'S';
    if (lv >= 41) return 'A';
    if (lv >= 21) return 'B';
    if (lv >= 11) return 'C';
    if (lv >= 6) return 'D';
    return 'E';
  }

  get playerTitle(): string {
    const streak = this.currentStreak;
    if (streak >= 61) return 'Shadow Monarch';
    if (streak >= 31) return 'S-Rank Hunter';
    if (streak >= 15) return 'A-Rank Hunter';
    if (streak >= 8) return 'Elite Hunter';
    if (streak >= 1) return 'Hunter';
    return 'Awakened';
  }

  get playerDisplayName(): string {
    return this.habitStore.getCurrentUsername() || 'Player';
  }

  getDomainRank(level: number): string {
    if (level >= 15) return 'S';
    if (level >= 10) return 'A';
    if (level >= 7) return 'B';
    if (level >= 4) return 'C';
    if (level >= 2) return 'D';
    return 'E';
  }

  // ── Data update ────────────────────────────────────────────────────────────

  private updateData(
    habits: Array<{ id: string; isActive: boolean }>,
    completions: Record<string, Record<string, boolean>>,
    skips: HabitSkips
  ): void {
    const today = this.normalizeDate(new Date());
    const todayKey = this.habitStore.toDateKey(today);
    this.activeHabitsCount = habits.filter(habit => habit.isActive).length;

    // Always use local calendarView for rendering
    this.monthMatrix = DateUtils.getMonthMatrix(this.calendarViewYear, this.calendarViewMonth);
    this.gridRows = this.getGridRows(this.calendarViewYear, this.calendarViewMonth);
    this.buildCalendar(completions);

    const streakDateKey = this.selectedDateKey || this.todayKey;
    this.currentStreak = this.habitStore.getStreakCount(streakDateKey);

    const monthKey = `${this.calendarViewYear}-${this.calendarViewMonth}`;
    if (this.lastMonthKey !== monthKey) {
      this.animationKey++;
      this.lastMonthKey = monthKey;
    }

    const weeklyWins = this.habitStore.getWeeklyWins(this.selectedDateKey || todayKey);
    this.weekAttendanceCount = weeklyWins.wins;
    this.weekTotalDays = weeklyWins.total;
    this.todayRemainingCount = this.habitStore.getRemainingCount(today);
    this.nextBestActionText = this.todayRemainingCount > 0
      ? getDailyMotivation(today.getDate())
      : 'Level up complete 🧘🏼';
    this.hasAnyData = this.activeHabitsCount > 0 && (this.completionPercent > 0 || this.perfectDaysCount > 0 || this.weekAttendanceCount > 0);
  }

  private buildCalendar(completions: Record<string, Record<string, boolean>>): void {
    const year = this.calendarViewYear;
    const month = this.calendarViewMonth;
    const dayStats = new Map<number, { done: number; percent: number; isPerfect: boolean }>();
    let monthDone = 0;
    let monthGoal = 0;
    let perfectDays = 0;

    for (let day = 1; day <= DateUtils.daysInMonth(year, month); day++) {
      const date = new Date(year, month, day);
      const dateKey = this.habitStore.toDateKey(date);
      const activeHabits = this.habitStore.getHabitsActiveOn(dateKey);
      const goalPerDay = activeHabits.length;
      const dayMap = completions[dateKey] || {};
      const done = activeHabits.reduce((sum, habit) => sum + (dayMap[habit.id] ? 1 : 0), 0);
      const percent = goalPerDay > 0 ? Math.round((done / goalPerDay) * 100) : 0;
      const isPerfect = goalPerDay > 0 && done === goalPerDay;
      dayStats.set(day, { done, percent, isPerfect });
      monthDone += done;
      monthGoal += goalPerDay;
      if (isPerfect) perfectDays++;
    }
    this.completionPercent = monthGoal > 0 ? Math.round((monthDone / monthGoal) * 100) : 0;
    this.perfectDaysCount = perfectDays;

    this.calendarCells = this.monthMatrix.flat().map(slot => {
      if (!slot.dayNumber) {
        return {
          dayNumber: null, dateKey: null, date: null,
          done: 0, goal: 0, percent: 0,
          isPerfect: false, isSelected: false, isToday: false,
          intensityClass: 'is-empty'
        };
      }
      const stats = dayStats.get(slot.dayNumber) || { done: 0, percent: 0, isPerfect: false };
      const date = new Date(year, month, slot.dayNumber);
      const dateKey = this.habitStore.toDateKey(date);
      const goalPerDay = this.habitStore.getHabitsActiveOn(dateKey).length;
      return {
        dayNumber: slot.dayNumber,
        dateKey,
        date,
        done: stats.done,
        goal: goalPerDay,
        percent: stats.percent,
        isPerfect: stats.isPerfect,
        isSelected: dateKey === this.selectedDateKey,
        isToday: dateKey === this.todayKey,
        intensityClass: this.getIntensityClass(stats.percent, stats.isPerfect)
      };
    });

    const allSummaries = this.monthMatrix.map((week, weekIndex) => {
      let done = 0;
      let goal = 0;
      let perfectDaysW = 0;
      const dateKeys: string[] = [];
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      week.forEach(slot => {
        if (!slot.dayNumber) return;
        const stats = dayStats.get(slot.dayNumber);
        if (!stats) return;
        const date = this.normalizeDate(new Date(year, month, slot.dayNumber));
        const dateKey = this.habitStore.toDateKey(date);
        dateKeys.push(dateKey);
        if (!startDate || date < startDate) startDate = date;
        if (!endDate || date > endDate) endDate = date;
        const goalPerDay = this.habitStore.getHabitsActiveOn(dateKey).length;
        done += stats.done;
        goal += goalPerDay;
        if (stats.isPerfect) perfectDaysW++;
      });
      const percent = goal > 0 ? Math.round((done / goal) * 100) : 0;
      return {
        weekIndex, done, goal, percent, perfectDays: perfectDaysW, dateKeys, startDate, endDate,
        rangeLabel: startDate && endDate ? this.formatWeekRange(startDate, endDate) : '--'
      };
    });
    this.weeklySummaries = allSummaries.slice(0, this.gridRows);
    this.syncSelectedWeek();

    const bestWeek = this.weeklySummaries.filter(w => w.goal > 0).sort((a, b) => b.percent - a.percent)[0];
    this.bestWeekLabel = bestWeek ? `W${bestWeek.weekIndex + 1}` : '--';
  }

  selectDay(cell: CalendarCell): void {
    if (!cell.date) return;
    this.habitStore.setSelectedDate(cell.date);
  }

  trackByWeek(index: number, week: WeekSummary): number {
    return week.weekIndex;
  }

  selectWeekByIndex(index: number): void {
    this.selectedWeekIndex = index;
    this.syncSelectedWeekLabel();
  }

  toggleInsights(): void {
    this.insightsOpen = !this.insightsOpen;
  }

  goToTodayAction(): void {
    this.router.navigate(['/today'], { queryParams: { focus: 'todayList' } });
  }

  // ── Weekly share ────────────────────────────────────────────────────────────

  async shareWeeklyReport(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || this.weeklyReportBusy) return;
    this.weeklyReportBusy = true;
    try {
      this.weeklySharePayload = this.buildWeeklyReportPayload();
      this.cdr.detectChanges();
      await this.weeklyReportShareService.waitForStableLayout();
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      await new Promise<void>(resolve => setTimeout(() => resolve(), 50));
      const element = this.weeklyReportExportRoot?.nativeElement;
      if (!element) throw new Error('Weekly report export element not found');
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) throw new Error('Weekly report export element not measurable');
      element.scrollTop = 0;
      const safeKey = (this.weeklySharePayload.weekStartKey || 'weekly').replace(/[^0-9-]/g, '');
      const fileName = `weekly_report_${safeKey}_${Date.now()}.png`;
      const dataUrl = await this.weeklyReportShareService.withTimeout(
        this.weeklyReportShareService.captureElementToPngDataUrl(element, {
          width: 900, height: 1600, pixelRatio: 2, backgroundColor: '#05070f'
        }),
        8000
      );
      await this.weeklyReportShareService.sharePngDataUrl(dataUrl, fileName);
      this.snackBar.open('Weekly report shared!', undefined, { duration: 1800 });
    } catch (error) {
      console.error('[WeeklyReportShare] export failed:', error);
      this.snackBar.open('Export failed', undefined, { duration: 2400 });
    } finally {
      this.weeklyReportBusy = false;
      this.weeklySharePayload = null;
      this.cdr.detectChanges();
    }
  }

  // ── Monthly share ────────────────────────────────────────────────────────────

  async shareMonthlyReport(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || this.monthlyReportBusy) return;
    this.monthlyReportBusy = true;
    try {
      this.monthlySharePayload = this.buildMonthlyReportPayload();
      this.cdr.detectChanges();
      await this.weeklyReportShareService.waitForStableLayout();
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      await new Promise<void>(resolve => setTimeout(() => resolve(), 50));
      const element = this.monthlyReportExportRoot?.nativeElement;
      if (!element) throw new Error('Monthly report export element not found');
      element.scrollTop = 0;
      const fileName = `monthly_report_${this.calendarViewYear}_${this.calendarViewMonth + 1}_${Date.now()}.png`;
      const dataUrl = await this.weeklyReportShareService.withTimeout(
        this.weeklyReportShareService.captureElementToPngDataUrl(element, {
          width: 900, height: 1600, pixelRatio: 2, backgroundColor: '#05070f'
        }),
        8000
      );
      await this.weeklyReportShareService.sharePngDataUrl(dataUrl, fileName);
      this.snackBar.open('Monthly report shared!', undefined, { duration: 1800 });
    } catch (error) {
      console.error('[MonthlyReportShare] export failed:', error);
      this.snackBar.open('Export failed', undefined, { duration: 2400 });
    } finally {
      this.monthlyReportBusy = false;
      this.monthlySharePayload = null;
      this.cdr.detectChanges();
    }
  }

  // ── Overall share ────────────────────────────────────────────────────────────

  async shareOverallReport(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || this.overallReportBusy) return;
    this.overallReportBusy = true;
    try {
      this.overallSharePayload = this.buildOverallReportPayload();
      this.cdr.detectChanges();
      await this.weeklyReportShareService.waitForStableLayout();
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      await new Promise<void>(resolve => setTimeout(() => resolve(), 50));
      const element = this.overallReportExportRoot?.nativeElement;
      if (!element) throw new Error('Overall report export element not found');
      element.scrollTop = 0;
      const fileName = `overall_report_${Date.now()}.png`;
      const dataUrl = await this.weeklyReportShareService.withTimeout(
        this.weeklyReportShareService.captureElementToPngDataUrl(element, {
          width: 900, height: 1600, pixelRatio: 2, backgroundColor: '#05070f'
        }),
        8000
      );
      await this.weeklyReportShareService.sharePngDataUrl(dataUrl, fileName);
      this.snackBar.open('Overall report shared!', undefined, { duration: 1800 });
    } catch (error) {
      console.error('[OverallReportShare] export failed:', error);
      this.snackBar.open('Export failed', undefined, { duration: 2400 });
    } finally {
      this.overallReportBusy = false;
      this.overallSharePayload = null;
      this.cdr.detectChanges();
    }
  }

  // ── Payload builders ─────────────────────────────────────────────────────────

  private buildMonthlyReportPayload(): MonthlySharePayload {
    const monthLabel = new Date(this.calendarViewYear, this.calendarViewMonth, 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();
    const monthDone = this.weeklySummaries.reduce((s, w) => s + w.done, 0);
    const monthGoal = this.weeklySummaries.reduce((s, w) => s + w.goal, 0);
    const bestWeek = this.weeklySummaries.filter(w => w.goal > 0).sort((a, b) => b.percent - a.percent)[0];
    const totalDaysInMonth = DateUtils.daysInMonth(this.calendarViewYear, this.calendarViewMonth);
    const footerSummary = this.perfectDaysCount >= 20
      ? 'Legendary month. You are unstoppable.'
      : this.perfectDaysCount >= 10
        ? 'Strong month. Keep the momentum.'
        : this.completionPercent >= 60
          ? 'Solid effort. Rise again next month.'
          : 'A quiet month. The shadow grows stronger.';
    return {
      playerName: this.habitStore.getCurrentUsername() || 'Player',
      playerMeta: `Level ${this.levelStats.level} · ${this.levelStats.totalXp} XP`,
      monthLabel,
      level: this.levelStats.level,
      totalXp: this.levelStats.totalXp,
      monthDone,
      monthGoal,
      monthPercent: this.completionPercent,
      perfectDays: this.perfectDaysCount,
      totalDaysInMonth,
      bestWeekLabel: bestWeek ? `Week ${bestWeek.weekIndex + 1}` : '--',
      bestWeekPercent: bestWeek?.percent ?? 0,
      domains: this.domainStats.map(d => ({
        label: d.config.label,
        emoji: d.config.emoji,
        level: d.level,
        xp: d.xp,
        percent: d.percent
      })),
      footerSummary
    };
  }

  private buildOverallReportPayload(): OverallSharePayload {
    const { totalDone, totalGoal, totalPerfectDays } = this.computeOverallStats();
    const overallPercent = totalGoal > 0 ? Math.round((totalDone / totalGoal) * 100) : 0;
    const bestStreak = this.computeBestPerfectStreak();
    const activeSince = this.computeActiveSince();
    const footerSummary = this.levelStats.level >= 10
      ? 'You have awakened. The system recognizes your power.'
      : 'Every habit is a step toward becoming the strongest.';
    return {
      playerName: this.habitStore.getCurrentUsername() || 'Player',
      playerRank: this.playerRank,
      level: this.levelStats.level,
      totalXp: this.levelStats.totalXp,
      currentStreak: this.currentStreak,
      bestStreak,
      totalDone,
      totalGoal,
      overallPercent,
      totalPerfectDays,
      activeSince,
      domains: this.domainStats.map(d => ({
        label: d.config.label,
        emoji: d.config.emoji,
        level: d.level,
        xp: d.xp,
        percent: d.percent
      })),
      footerSummary
    };
  }

  private computeOverallStats(): { totalDone: number; totalGoal: number; totalPerfectDays: number } {
    let totalDone = 0;
    let totalGoal = 0;
    let totalPerfectDays = 0;
    const allDateKeys = Object.keys(this.latestCompletions);
    for (const dateKey of allDateKeys) {
      const activeHabits = this.habitStore.getHabitsActiveOn(dateKey);
      const goal = activeHabits.length;
      const dayMap = this.latestCompletions[dateKey] || {};
      const done = activeHabits.reduce((sum, h) => sum + (dayMap[h.id] ? 1 : 0), 0);
      totalDone += done;
      totalGoal += goal;
      if (goal > 0 && done === goal) totalPerfectDays++;
    }
    return { totalDone, totalGoal, totalPerfectDays };
  }

  private computeActiveSince(): string {
    const keys = Object.keys(this.latestCompletions).sort();
    if (keys.length === 0) return 'Day 1';
    const firstKey = keys[0];
    const parts = firstKey.split('-');
    if (parts.length !== 3) return firstKey;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  // ── Tracking ──────────────────────────────────────────────────────────────

  trackByCalendarCell(index: number, cell: CalendarCell): string {
    return cell.dateKey ?? `empty-${index}`;
  }

  trackByHabitId(index: number, habit: Habit): string {
    return habit.id;
  }

  get firstWeekOffset(): number[] {
    const firstDay = new Date(this.calendarViewYear, this.calendarViewMonth, 1).getDay();
    const offset = (firstDay + 6) % 7;
    return Array(offset).fill(0);
  }

  get selectedMonthLabel(): string {
    return this.calendarViewLabel;
  }

  get heatmapCells(): CalendarCell[] {
    return this.calendarCells.filter(c => c.dayNumber !== null);
  }

  private getIntensityClass(percent: number, isPerfect: boolean): string {
    if (isPerfect) return 'is-perfect';
    if (percent === 0) return 'is-zero';
    if (percent < 50) return 'is-low';
    if (percent < 100) return 'is-mid';
    return 'is-high';
  }

  private getGridRows(year: number, monthIndex: number): number {
    const firstDay = new Date(year, monthIndex, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const totalCells = startOffset + daysInMonth;
    return Math.ceil(totalCells / 7);
  }

  private setViewportFlags(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.isMobile = window.innerWidth < 768;
    if (!this.hasSetInsightsDefault) {
      this.insightsOpen = !this.isMobile;
      this.hasSetInsightsDefault = true;
      return;
    }
    if (!this.isMobile) this.insightsOpen = true;
  }

  private normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private buildWeeklyReportPayload(): Parameters<BackupService['exportWeeklyReportPng']>[0] {
    const selectedWeek = this.getSelectedWeekSummary();
    if (selectedWeek && selectedWeek.dateKeys.length > 0) {
      return this.buildWeeklyPayloadFromDateKeys(selectedWeek.dateKeys, selectedWeek.rangeLabel);
    }
    const baseDate = this.parseDateKey(this.selectedDateKey || this.todayKey) ?? this.normalizeDate(new Date());
    const weekDates = this.getWeekDatesMondayToSunday(baseDate);
    const fallbackKeys = weekDates.map(date => this.habitStore.toDateKey(date));
    return this.buildWeeklyPayloadFromDateKeys(fallbackKeys, this.formatWeekRange(weekDates[0], weekDates[6]));
  }

  private syncSelectedWeek(): void {
    if (this.weeklySummaries.length === 0) {
      this.selectedWeekIndex = 0;
      this.selectedWeekRangeLabel = '';
      return;
    }
    const activeDateKey = this.selectedDateKey || this.todayKey;
    const match = this.weeklySummaries.find(week => week.dateKeys.includes(activeDateKey));
    if (match) {
      this.selectedWeekIndex = match.weekIndex;
    } else if (!this.weeklySummaries.some(week => week.weekIndex === this.selectedWeekIndex)) {
      this.selectedWeekIndex = this.weeklySummaries[0].weekIndex;
    }
    this.syncSelectedWeekLabel();
  }

  private syncSelectedWeekLabel(): void {
    const selectedWeek = this.getSelectedWeekSummary();
    this.selectedWeekRangeLabel = selectedWeek?.rangeLabel ?? '';
  }

  private getSelectedWeekSummary(): WeekSummary | null {
    return this.weeklySummaries.find(week => week.weekIndex === this.selectedWeekIndex) ?? this.weeklySummaries[0] ?? null;
  }

  private buildWeeklyPayloadFromDateKeys(dateKeys: string[], rangeLabel: string): Parameters<BackupService['exportWeeklyReportPng']>[0] {
    const sortedKeys = [...dateKeys].sort();
    const weekStartKey = sortedKeys[0] || this.todayKey;
    const weekEndKey = sortedKeys[sortedKeys.length - 1] || this.todayKey;
    const computed = this.weeklyReportService.computeWeekStats(
      sortedKeys,
      this.latestCompletions,
      dateKey => this.habitStore.getHabitsActiveOn(dateKey)
    );
    const { completed, goal, perfectDays, weeklyPerfectStreak } = computed;
    const weekXp = computed.weekXP ?? 0;
    const habits = computed.perHabit
      .map(h => ({ name: h.name, doneCount: h.doneCount, daysActive: h.daysActive }))
      .sort((a, b) => (b.doneCount - a.doneCount) || a.name.localeCompare(b.name));
    const bestStreak = this.computeBestPerfectStreak();
    const levelLine = `Level ${this.levelStats.level} - XP ${this.levelStats.totalXp}`;
    const levelSubline = this.levelStats.remainingToNext > 0
      ? `Next level in ${this.levelStats.remainingToNext} XP`
      : 'Next level unlocked!';
    const footerSummary = goal === 0
      ? 'No habits active this week'
      : perfectDays >= 5 ? 'Legendary week. You are unstoppable.'
      : perfectDays >= 3 ? 'Strong momentum. Keep pushing.'
      : 'A slow week. Rise stronger.';
    return {
      weekStartKey, weekEndKey, weekRangeLabel: rangeLabel, dateKeys: sortedKeys,
      headerName: this.habitStore.getCurrentUsername(),
      headerMeta: `Level ${this.levelStats.level} - XP ${this.levelStats.totalXp}`,
      stats: { completed, goal, weekXp, perfectDays, weeklyPerfectStreak, bestStreak },
      habits, levelLine, levelSubline, footerSummary
    };
  }

  private computeBestPerfectStreak(): number {
    const keys = new Set<string>(Object.keys(this.latestCompletions || {}));
    keys.add(this.todayKey);
    const sorted = Array.from(keys).sort();
    let current = 0;
    let best = 0;
    for (const dateKey of sorted) {
      const activeHabits = this.habitStore.getHabitsActiveOn(dateKey);
      const goal = activeHabits.length;
      const dayMap = this.latestCompletions[dateKey] || {};
      const done = activeHabits.reduce((sum, h) => sum + (dayMap[h.id] ? 1 : 0), 0);
      const isPerfect = goal > 0 && done === goal;
      if (isPerfect) { current++; best = Math.max(best, current); }
      else current = 0;
    }
    return best;
  }

  private getWeekDatesMondayToSunday(date: Date): Date[] {
    const normalized = this.normalizeDate(date);
    const day = normalized.getDay();
    const offsetToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(normalized);
    monday.setDate(normalized.getDate() + offsetToMonday);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return this.normalizeDate(d);
    });
  }

  private formatWeekRange(start: Date, end: Date): string {
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    if (startMonth === endMonth) {
      return `${startMonth} ${start.getDate()} - ${end.getDate()}`;
    }
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
  }

  private parseDateKey(dateKey: string): Date | null {
    if (!dateKey) return null;
    const parts = dateKey.split('-');
    if (parts.length !== 3) return null;
    const year = Number(parts[0]);
    const monthIndex = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null;
    return this.normalizeDate(new Date(year, monthIndex, day));
  }
}
