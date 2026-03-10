import { Injectable, isDevMode } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';

type VersionInfo = {
  version: string;
  build?: string | number;
  releaseDate?: string;
};

@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly versionInfo$: Observable<VersionInfo>;

  constructor(private http: HttpClient) {
    this.versionInfo$ = this.http.get<VersionInfo>('assets/version.json').pipe(
      map(info => ({
        version: info?.version || '0.0.0',
        build: info?.build,
        releaseDate: info?.releaseDate
      })),
      tap(info => {
        if (isDevMode()) {
          console.debug('[version]', info);
        }
      }),
      catchError(() => of({ version: '0.0.0' })),
      shareReplay({ bufferSize: 1, refCount: false })
    );
  }

  getVersionInfo$(): Observable<VersionInfo> {
    return this.versionInfo$;
  }

  getVersion$(): Observable<string> {
    return this.versionInfo$.pipe(map(info => info.version));
  }

  getBuild$(): Observable<string | number | null> {
    return this.versionInfo$.pipe(map(info => info.build ?? null));
  }
}
