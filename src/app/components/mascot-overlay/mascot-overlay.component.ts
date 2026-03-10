import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-mascot-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mascot-overlay" *ngIf="active">
      <div class="mascot-orb"></div>
      <div class="mascot-core"></div>
    </div>
  `,
  styleUrls: ['./mascot-overlay.component.sass']
})
export class MascotOverlayComponent {
  @Input() active = false;
}
