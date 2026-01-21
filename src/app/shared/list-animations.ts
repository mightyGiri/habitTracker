import { animate, query, stagger, style, transition, trigger } from '@angular/animations';

export const noopAnimation = trigger('noopAnimation', []);

export const staggerFadeUp = trigger('staggerFadeUp', [
  transition(':enter, * => *', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        stagger(60, [
          animate('220ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
        ])
      ],
      { optional: true }
    )
  ])
]);

export const fadeSlideInOut = trigger('fadeSlideInOut', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(8px)' }),
    animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
  ]),
  transition(':leave', [
    animate('160ms ease-out', style({ opacity: 0, transform: 'translateY(-6px)' }))
  ])
]);
