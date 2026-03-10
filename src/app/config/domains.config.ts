import { DomainConfig, HabitDomain } from '../models/habit.model';

export const DOMAINS: DomainConfig[] = [
  { id: 'health',       label: 'Health & Fitness',  emoji: '💪', color: '#00e5c0', glowColor: 'rgba(0,229,192,0.25)',   xpMultiplier: 1.0, description: 'Physical strength and wellness' },
  { id: 'mind',         label: 'Mind & Learning',   emoji: '🧠', color: '#a259ff', glowColor: 'rgba(162,89,255,0.25)',  xpMultiplier: 1.2, description: 'Knowledge and mental growth' },
  { id: 'creative',     label: 'Creative & Arts',   emoji: '🎨', color: '#ff6b6b', glowColor: 'rgba(255,107,107,0.25)', xpMultiplier: 1.1, description: 'Artistic expression and creation' },
  { id: 'career',       label: 'Career & Craft',    emoji: '💼', color: '#4f8cff', glowColor: 'rgba(79,140,255,0.25)',  xpMultiplier: 1.0, description: 'Professional skills and growth' },
  { id: 'finance',      label: 'Finance & Wealth',  emoji: '💰', color: '#f5c842', glowColor: 'rgba(245,200,66,0.25)',  xpMultiplier: 1.0, description: 'Financial discipline and wealth' },
  { id: 'social',       label: 'Social & Relations', emoji: '🤝', color: '#ff9f43', glowColor: 'rgba(255,159,67,0.25)', xpMultiplier: 1.1, description: 'Relationships and communication' },
  { id: 'spirit',       label: 'Spirit & Mindset',  emoji: '🧘', color: '#a29bfe', glowColor: 'rgba(162,155,254,0.25)', xpMultiplier: 1.2, description: 'Inner peace and resilience' },
  { id: 'productivity', label: 'Productivity',       emoji: '⚙️', color: '#00cec9', glowColor: 'rgba(0,206,201,0.25)',  xpMultiplier: 1.0, description: 'Systems and efficiency' },
];

export const DOMAIN_MAP = new Map<HabitDomain, DomainConfig>(
  DOMAINS.map(d => [d.id, d])
);

export function getDomainConfig(id: HabitDomain | undefined): DomainConfig {
  return DOMAIN_MAP.get(id as HabitDomain) ?? DOMAINS[3]; // default: career
}
