import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Capacitor } from '@capacitor/core';
import { BackupService, WeeklyReportSharePayload } from '../../services/backup.service';
import { WeeklyReportShareService } from '../../services/weekly-report-share.service';

@Component({
  selector: 'app-weekly-report-share-modal',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule],
  templateUrl: './weekly-report-share-modal.component.html',
  styleUrl: './weekly-report-share-modal.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyReportShareModalComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() open = false;
  @Input() reportData: WeeklyReportSharePayload | null = null;
  @Output() close = new EventEmitter<void>();

  @ViewChild('previewViewport') previewViewport?: ElementRef<HTMLElement>;
  @ViewChild('reportBase') reportBase?: ElementRef<HTMLElement>;

  readonly designWidth = 900;
  readonly designHeight = 1600;

  previewScale = 1;
  exportBusy = false;
  prepareBusy = false;
  preparedFileUri: string | null = null;
  preparedDataUrl: string | null = null;
  private preparedFileName: string | null = null;
  private lastOpenScrollY = 0;

  private resizeObserver?: ResizeObserver;

  constructor(
    private cdr: ChangeDetectorRef,
    private snackBar: MatSnackBar,
    private weeklyReportShareService: WeeklyReportShareService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.open) {
          void this.fitToViewport();
        }
      });
      const viewport = this.previewViewport?.nativeElement;
      if (viewport) {
        this.resizeObserver.observe(viewport);
      }
    }
    if (this.open) {
      void this.fitToViewport();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      if (this.open) {
        this.preparedFileUri = null;
        this.preparedDataUrl = null;
        this.preparedFileName = null;
        this.prepareBusy = false;
        this.setBodyScrollLocked(true);
        this.cdr.detectChanges();
        void this.initializePreviewAndPrepare();
      } else {
        this.exportBusy = false;
        this.prepareBusy = false;
        this.previewScale = 1;
        this.setBodyScrollLocked(false);
      }
    }
    if (changes['reportData'] && this.open) {
      this.cdr.detectChanges();
      void this.initializePreviewAndPrepare();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.setBodyScrollLocked(false);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.open) {
      void this.fitToViewport();
    }
  }

  requestClose(): void {
    if (this.exportBusy) {
      return;
    }
    this.close.emit();
  }

  async share(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !this.open || !this.reportData || this.exportBusy) {
      return;
    }
    if (this.prepareBusy) {
      return;
    }
    if (!this.preparedFileUri && !this.preparedDataUrl) {
      void this.prepareExportAsset();
      return;
    }
    this.exportBusy = true;
    this.cdr.markForCheck();

    try {
      if (this.preparedFileUri) {
        await this.weeklyReportShareService.shareFileUri(this.preparedFileUri);
      } else if (this.preparedDataUrl && this.preparedFileName) {
        await this.weeklyReportShareService.sharePngDataUrl(this.preparedDataUrl, this.preparedFileName);
      } else {
        throw new Error('Report PNG is not prepared yet');
      }
      this.snackBar.open('Weekly report shared', undefined, { duration: 1800 });
    } catch (error) {
      console.error('[WeeklyReportShare] export/share failed:', error);
      const message = error instanceof Error ? error.message : String(error);
      this.snackBar.open(`Weekly report export failed: ${message}`, undefined, { duration: 3200 });
    } finally {
      this.exportBusy = false;
      this.cdr.markForCheck();
      if (this.open) {
        void this.fitToViewport();
      }
    }
  }

  private async initializePreviewAndPrepare(): Promise<void> {
    await this.fitToViewport();
    if (this.open && this.reportData && !this.prepareBusy && !this.preparedFileUri && !this.preparedDataUrl) {
      void this.prepareExportAsset();
    }
  }

  private async prepareExportAsset(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !this.open || !this.reportData || this.prepareBusy) {
      return;
    }
    this.prepareBusy = true;
    this.cdr.markForCheck();

    const offscreenRoot = document.createElement('div');
    offscreenRoot.className = 'weekly-report-capture-root';
    offscreenRoot.style.position = 'fixed';
    offscreenRoot.style.left = '-10000px';
    offscreenRoot.style.top = '0';
    offscreenRoot.style.width = `${this.designWidth}px`;
    offscreenRoot.style.height = `${this.designHeight}px`;
    offscreenRoot.style.pointerEvents = 'none';
    offscreenRoot.style.zIndex = '-1';
    offscreenRoot.style.background = '#05070f';

    try {
      const source = this.reportBase?.nativeElement;
      if (!source) {
        throw new Error('Report preview element not available');
      }
      const clone = source.cloneNode(true) as HTMLElement;
      clone.style.transform = 'none';
      clone.style.width = `${this.designWidth}px`;
      clone.style.height = `${this.designHeight}px`;
      clone.style.margin = '0';
      clone.style.boxSizing = 'border-box';
      offscreenRoot.appendChild(clone);
      document.body.appendChild(offscreenRoot);

      await this.weeklyReportShareService.waitForStableLayout();
      const rect = clone.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        throw new Error('Report capture element not measurable');
      }

      const safeKey = (this.reportData.weekStartKey || 'weekly').replace(/[^0-9-]/g, '');
      this.preparedFileName = `weekly-report-${safeKey}-${Date.now()}.png`;

      const dataUrl = await this.weeklyReportShareService.withTimeout(
        this.weeklyReportShareService.captureElementToPngDataUrl(clone, {
          width: this.designWidth,
          height: this.designHeight,
          pixelRatio: 2,
          backgroundColor: '#05070f'
        }),
        8000
      );

      this.preparedDataUrl = dataUrl;
      if (Capacitor.isNativePlatform()) {
        this.preparedFileUri = await this.weeklyReportShareService.savePngDataUrlToCache(dataUrl, this.preparedFileName);
      }
    } catch (error) {
      console.error('[WeeklyReportShare] prepare failed:', error);
      this.preparedDataUrl = null;
      this.preparedFileUri = null;
      this.preparedFileName = null;
      const message = error instanceof Error ? error.message : String(error);
      this.snackBar.open(`Weekly report export failed: ${message}`, undefined, { duration: 3200 });
    } finally {
      offscreenRoot.remove();
      this.prepareBusy = false;
      this.cdr.markForCheck();
    }
  }

  private async fitToViewport(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !this.open) {
      return;
    }
    this.cdr.detectChanges();
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
    await this.weeklyReportShareService.waitForStableLayout();
    const viewport = this.previewViewport?.nativeElement;
    const report = this.reportBase?.nativeElement;
    if (!viewport || !report) {
      return;
    }

    const availableWidth = viewport.clientWidth;
    const availableHeight = viewport.clientHeight;
    const reportWidth = report.offsetWidth || this.designWidth;
    const reportHeight = report.offsetHeight || this.designHeight;
    if (availableWidth <= 0 || availableHeight <= 0 || reportWidth <= 0 || reportHeight <= 0) {
      return;
    }

    const horizontalPad = 16;
    const verticalPad = 16;
    const maxWidth = Math.max(0, availableWidth - horizontalPad * 2);
    const maxHeight = Math.max(0, availableHeight - verticalPad * 2);
    const scale = Math.min(maxWidth / reportWidth, maxHeight / reportHeight);
    this.previewScale = Math.max(0.25, Math.min(1, Number.isFinite(scale) ? scale : 1));
    this.cdr.detectChanges();
  }

  private setBodyScrollLocked(locked: boolean): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (locked) {
      this.lastOpenScrollY = window.scrollY || window.pageYOffset || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${this.lastOpenScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return;
    }
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    window.scrollTo(0, this.lastOpenScrollY || 0);
  }
}
