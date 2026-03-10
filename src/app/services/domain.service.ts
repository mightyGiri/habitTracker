import { Injectable } from '@angular/core';
import { HabitCompletion, Habit, DomainXP } from '../models/habit.model';
import { GamificationService } from './gamification.service';
import { getDomainConfig } from '../config/domains.config';

@Injectable({ providedIn: 'root' })
export class DomainService {
  constructor(private gamification: GamificationService) {}

  computeDomainXP(habits: Habit[], completions: HabitCompletion): DomainXP {
    const domainXP: DomainXP = {};

    for (const [, dayMap] of Object.entries(completions)) {
      for (const [habitId, completed] of Object.entries(dayMap)) {
        if (!completed) continue;
        const habit = habits.find(h => h.id === habitId);
        if (!habit) continue;
        const domain = habit.domain ?? 'productivity';
        const baseXP = this.gamification.getHabitXpValue(habit);
        const config = getDomainConfig(habit.domain);
        const earned = Math.round(baseXP * config.xpMultiplier);
        domainXP[domain] = (domainXP[domain] ?? 0) + earned;
      }
    }

    return domainXP;
  }

  getDomainLevel(xp: number): number {
    let level = 1;
    let needed = 50;
    let cumulative = 0;
    while (xp >= cumulative + needed) {
      cumulative += needed;
      needed += 10;
      level++;
    }
    return Math.min(level, 99);
  }

  getDomainProgress(xp: number): { level: number; current: number; needed: number; percent: number } {
    let level = 1;
    let needed = 50;
    let cumulative = 0;
    while (xp >= cumulative + needed) {
      cumulative += needed;
      needed += 10;
      level++;
    }
    const current = xp - cumulative;
    return { level: Math.min(level, 99), current, needed, percent: Math.round((current / needed) * 100) };
  }
}
