import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-habit-check',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      class="habit-check"
      [class.is-checked]="checked"
      [class.is-disabled]="disabled"
      [class.is-sm]="size === 'sm'"
      [attr.aria-checked]="checked"
      [attr.aria-disabled]="disabled"
      role="checkbox"
      (click)="onToggle($event)">
      <span class="check-mark" aria-hidden="true"></span>
    </button>
  `,
  styleUrls: ['./habit-check.component.sass']
})
export class HabitCheckComponent {
  @Input() checked = false;
  @Input() disabled = false;
  @Input() size: 'sm' | 'md' = 'md';
  @Output() toggle = new EventEmitter<void>();

  onToggle(event: Event): void {
    event.stopPropagation();
    if (this.disabled) {
      return;
    }
    this.toggle.emit();
  }
}
