import { Pipe, PipeTransform } from '@angular/core';
import { plural } from './plural';

@Pipe({
  name: 'dayCount',
  standalone: true
})
export class DayCountPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    const count = Number(value ?? 0);
    if (!Number.isFinite(count)) {
      return `0 ${plural(0, 'day')}`;
    }
    return `${count} ${plural(count, 'day')}`;
  }
}
