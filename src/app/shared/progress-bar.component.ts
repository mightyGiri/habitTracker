import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app-progress" [style.height.px]="height" role="progressbar"
         [attr.aria-valuenow]="percent" aria-valuemin="0" aria-valuemax="100">
      <span class="app-progress__track"></span>
      <span
        class="app-progress__fill"
        [style.width.%]="percent">
      </span>
      <span class="app-progress__label" *ngIf="showLabel">{{ percent }}%</span>
    </div>
  `,
  styleUrls: ['./progress-bar.component.sass']
})
export class ProgressBarComponent {
  @Input() value = 0;
  @Input() height = 6;
  @Input() showLabel = false;

  get percent(): number {
    const clamped = Math.min(1, Math.max(0, this.value));
    return Math.round(clamped * 100);
  }
}
