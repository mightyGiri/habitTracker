import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HabitStoreService } from './habit-store.service';

type SoundEventName = 'habitComplete' | 'perfectDay' | 'levelUp';

type SoundDef = {
  src: string;
  volume: number;
};

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  private readonly defs: Record<SoundEventName, SoundDef> = {
    habitComplete: { src: 'assets/sfx/habit-complete.mp3', volume: 0.28 },
    perfectDay: { src: 'assets/sfx/perfect-day.mp3', volume: 0.38 },
    levelUp: { src: 'assets/sfx/level-up.mp3', volume: 0.42 }
  };

  private audioMap = new Map<SoundEventName, HTMLAudioElement>();
  private lastPlayAt = new Map<SoundEventName, number>();
  private initialized = false;
  private unlocked = false;
  private unlockListener?: () => void;

  constructor(
    private habitStore: HabitStoreService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  init(): void {
    if (!isPlatformBrowser(this.platformId) || this.initialized) {
      return;
    }
    this.initialized = true;
    this.preload();

    const unlock = () => {
      this.unlocked = true;
      if (this.unlockListener) {
        window.removeEventListener('pointerdown', this.unlockListener);
        window.removeEventListener('keydown', this.unlockListener);
        this.unlockListener = undefined;
      }
    };

    this.unlockListener = unlock;
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  preload(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    (Object.keys(this.defs) as SoundEventName[]).forEach(name => {
      if (this.audioMap.has(name)) {
        return;
      }
      const def = this.defs[name];
      const audio = this.createAudio(def);
      this.audioMap.set(name, audio);
    });
  }

  play(name: SoundEventName): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (!this.habitStore.getProfileSync().soundsEnabled) {
      return;
    }
    const now = Date.now();
    const previous = this.lastPlayAt.get(name) ?? 0;
    const minGap = name === 'habitComplete' ? 120 : 300;
    if (now - previous < minGap) {
      return;
    }
    this.lastPlayAt.set(name, now);

    void this.playWithRetry(name);
  }

  private async playWithRetry(name: SoundEventName): Promise<void> {
    let audio = this.audioMap.get(name);
    if (!audio) {
      audio = this.createAudio(this.defs[name]);
      this.audioMap.set(name, audio);
    }

    const firstTry = await this.tryPlayAudio(audio);
    if (firstTry) {
      return;
    }

    // Some WebViews fail to replay ended audio; recreate once and retry.
    const replacement = this.createAudio(this.defs[name]);
    this.audioMap.set(name, replacement);
    await this.tryPlayAudio(replacement);
  }

  private async tryPlayAudio(audio: HTMLAudioElement): Promise<boolean> {
    try {
      audio.pause();
    } catch {
      // ignore
    }
    try {
      audio.currentTime = 0;
    } catch {
      // Some WebViews may throw if media is not seekable yet.
    }

    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        await playPromise;
      }
      return true;
    } catch {
      return false;
    }
  }

  private createAudio(def: SoundDef): HTMLAudioElement {
    const audio = new Audio(def.src);
    audio.preload = 'auto';
    audio.volume = def.volume;
    return audio;
  }
}
