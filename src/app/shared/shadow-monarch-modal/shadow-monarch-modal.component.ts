import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  PLATFORM_ID,
  Renderer2,
  SimpleChanges
} from '@angular/core';

@Component({
  selector: 'app-shadow-monarch-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shadow-monarch-modal.component.html',
  styleUrls: ['./shadow-monarch-modal.component.sass']
})
export class ShadowMonarchModalComponent implements OnChanges, OnDestroy {
  @Input() open = false;
  @Input() title = '';
  @Input() message = '';
  @Input() primaryText = 'OK';
  @Input() secondaryText?: string;
  @Output() close = new EventEmitter<void>();
  @Output() primary = new EventEmitter<void>();
  @Output() secondary = new EventEmitter<void>();

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private renderer: Renderer2
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ('open' in changes) {
      this.toggleBodyScroll(this.open);
    }
  }

  ngOnDestroy(): void {
    this.toggleBodyScroll(false);
  }

  onScrimClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  onPrimary(): void {
    this.primary.emit();
  }

  onSecondary(): void {
    this.secondary.emit();
  }

  onClose(): void {
    this.close.emit();
  }

  @HostListener('window:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (!this.open) {
      return;
    }
    event.preventDefault();
    this.close.emit();
  }

  private toggleBodyScroll(lock: boolean): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (lock) {
      this.renderer.addClass(document.body, 'modal-open');
      return;
    }
    this.renderer.removeClass(document.body, 'modal-open');
  }
}
