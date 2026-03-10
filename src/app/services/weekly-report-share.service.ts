import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toPng } from 'html-to-image';

export type WeeklyReportCaptureOptions = {
  width: number;
  height: number;
  pixelRatio?: number;
  backgroundColor?: string;
};

@Injectable({ providedIn: 'root' })
export class WeeklyReportShareService {
  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  async savePngDataUrlToCache(dataUrl: string, fileName: string): Promise<string> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Weekly report save is only available in browser/native runtime');
    }
    const base64 = this.dataUrlToBase64(dataUrl);
    const write = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
      recursive: true
    });
    let uri = write.uri || '';
    try {
      const result = await Filesystem.getUri({ directory: Directory.Cache, path: fileName });
      uri = result.uri;
    } catch (error) {
      console.error('[WeeklyReportShare] getUri failed:', error);
    }
    if (!uri) {
      throw new Error('Weekly report file URI unavailable');
    }
    return uri;
  }

  async captureElementToPngDataUrl(element: HTMLElement, options: WeeklyReportCaptureOptions): Promise<string> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Weekly report capture is only available in browser/native runtime');
    }
    return toPng(element, {
      width: options.width,
      height: options.height,
      pixelRatio: options.pixelRatio ?? 2,
      backgroundColor: options.backgroundColor ?? '#05070f',
      cacheBust: true
    });
  }

  async sharePngDataUrl(dataUrl: string, fileName: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Weekly report sharing is only available in browser/native runtime');
    }
    if (Capacitor.isNativePlatform()) {
      const uri = await this.savePngDataUrlToCache(dataUrl, fileName);
      try {
        await Share.share({
          title: 'Weekly progress report',
          text: 'Weekly progress report',
          files: [uri] as unknown as string[]
        } as unknown as Parameters<typeof Share.share>[0]);
      } catch (error) {
        await Share.share({
          title: 'Weekly progress report',
          text: 'Weekly progress report',
          url: uri
        });
      }
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.click();
  }

  async shareFileUri(uri: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Weekly report sharing is only available in browser/native runtime');
    }
    try {
      await Share.share({
        title: 'Weekly progress report',
        text: 'Weekly progress report',
        files: [uri] as unknown as string[]
      } as unknown as Parameters<typeof Share.share>[0]);
    } catch {
      await Share.share({
        title: 'Weekly progress report',
        text: 'Weekly progress report',
        url: uri
      });
    }
  }

  async waitForStableLayout(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const doc = document as Document & { fonts?: { ready?: Promise<unknown> } };
    if (doc.fonts?.ready) {
      await doc.fonts.ready;
    }
    await this.nextFrame();
    await this.nextFrame();
  }

  async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
      promise.then(
        value => {
          clearTimeout(timer);
          resolve(value);
        },
        error => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  private async nextFrame(): Promise<void> {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }

  private dataUrlToBase64(dataUrl: string): string {
    const base64 = dataUrl.split(',')[1];
    if (!base64) {
      throw new Error('Invalid PNG data URL');
    }
    return base64;
  }
}
