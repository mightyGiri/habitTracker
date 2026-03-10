import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toggle.component.html',
  styleUrl: './toggle.component.sass'
})
export class ToggleComponent {
  @Input() checked = false;
  @Input() disabled = false;
  @Input() size: 'sm' | 'md' = 'md';
  @Output() checkedChange = new EventEmitter<boolean>();

  toggle(): void {
    if (this.disabled) {
      return;
    }
    this.checkedChange.emit(!this.checked);
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.disabled) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggle();
    }
  }
}
