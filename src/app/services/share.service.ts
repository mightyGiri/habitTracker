import { Injectable } from '@angular/core';
import { toPng } from 'html-to-image';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

@Injectable({ providedIn: 'root' })
export class ShareService {
  async captureElement(element: HTMLElement): Promise<Blob> {
    const dataUrl = await toPng(element, { cacheBust: true, pixelRatio: 2 });
    const response = await fetch(dataUrl);
    return response.blob();
  }

  async shareImage(element: HTMLElement, title: string, text: string): Promise<void> {
    const blob = await this.captureElement(element);
    if (Capacitor.isNativePlatform()) {
      const fileName = `achievement-${Date.now()}.png`;
      const base64 = await this.blobToBase64(blob);
      const write = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache
      });
      await Share.share({ title, text, files: [write.uri] });
      return;
    }

    if (navigator.share && navigator.canShare) {
      const file = new File([blob], 'achievement.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        return;
      }
    }

    this.downloadBlob(blob, 'achievement.png');
  }

  async saveImage(element: HTMLElement, fileName = 'achievement.png'): Promise<void> {
    const blob = await this.captureElement(element);
    if (Capacitor.isNativePlatform()) {
      const base64 = await this.blobToBase64(blob);
      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents
      });
      return;
    }
    this.downloadBlob(blob, fileName);
  }

  async copyText(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
