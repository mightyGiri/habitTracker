import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AchievementPayload } from '../../services/achievement-queue.service';
import { ShareService } from '../../services/share.service';

@Component({
  selector: 'app-achievement-overlay',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="achievement-overlay" *ngIf="achievement">
      <div class="achievement-card" #card>
        <div class="achievement-header">
          <div class="achievement-title">{{ achievement.title }}</div>
          <div class="achievement-subtitle">{{ achievement.subtitle }}</div>
        </div>
        <div class="achievement-stat">{{ achievement.statLine }}</div>
        <div class="achievement-highlight">{{ achievement.highlightText }}</div>
        <div class="achievement-date text-muted">{{ achievement.dateLabel }}</div>
        <div class="achievement-persona text-muted" *ngIf="achievement.personaName">{{ achievement.personaName }}</div>
        <div class="achievement-actions" *ngIf="showActions">
          <button class="btn btn-outline btn-sm" type="button" (click)="save()">Save</button>
          <button class="btn btn-primary btn-sm" type="button" (click)="share()">Share</button>
          <button class="btn btn-ghost btn-sm" type="button" (click)="copy()">Copy text</button>
          <button class="btn btn-ghost btn-sm" type="button" (click)="close.emit()">Close</button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./achievement-overlay.component.sass']
})
export class AchievementOverlayComponent {
  @Input() achievement: AchievementPayload | null = null;
  @Input() showActions = false;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();
  @Output() shared = new EventEmitter<void>();
  @ViewChild('card') card?: ElementRef<HTMLElement>;

  constructor(private shareService: ShareService) {}

  async share(): Promise<void> {
    if (!this.card || !this.achievement) {
      return;
    }
    await this.shareService.shareImage(this.card.nativeElement, this.achievement.title, this.achievement.subtitle);
    this.shared.emit();
  }

  async save(): Promise<void> {
    if (!this.card) {
      return;
    }
    await this.shareService.saveImage(this.card.nativeElement, 'achievement.png');
    this.saved.emit();
  }

  async copy(): Promise<void> {
    if (!this.achievement) {
      return;
    }
    await this.shareService.copyText(`${this.achievement.title} - ${this.achievement.subtitle}`);
  }
}
