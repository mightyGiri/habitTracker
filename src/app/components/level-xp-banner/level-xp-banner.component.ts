import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-level-xp-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './level-xp-banner.component.html',
  styleUrl: './level-xp-banner.component.sass'
})
export class LevelXpBannerComponent {
  @Input() level = 1;
  @Input() totalXP = 0;
  @Input() progressPercent = 0;
  @Input() xpNeededForNext = 0;
  @Input() xpIntoLevel = 0;
  @Input() compact = false;

  get progressWidth(): number {
    const raw = Number(this.progressPercent);
    if (!Number.isFinite(raw)) {
      return 0;
    }
    return Math.max(0, Math.min(100, raw * 100));
  }

  get nextLevelText(): string {
    if (this.xpNeededForNext <= 0) {
      return 'Max level reached';
    }
    const remaining = Math.max(this.xpNeededForNext - this.xpIntoLevel, 0);
    return `Next level in ${remaining} XP`;
  }
}

