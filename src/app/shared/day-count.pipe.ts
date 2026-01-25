import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'dayCount',
  standalone: true
})
export class DayCountPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    const count = Number(value ?? 0);
    if (!Number.isFinite(count)) {
      return '0 days';
    }
    return count === 1 ? '1 day' : `${count} days`;
  }
}
