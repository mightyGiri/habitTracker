export interface Quest {
  id: string;
  title: string;
  description: string;
  type: 'weekly' | 'monthly' | 'seasonal';
  requirement: {
    /** Number of habits to complete per day. Use 0 as sentinel meaning "all habits" (perfect day). */
    habitCount: number;
    daysRequired: number;
  };
  xpReward: number;
  badgeReward: string;
  startDate: string; // ISO date string YYYY-MM-DD
  endDate: string;   // ISO date string YYYY-MM-DD
  progress: {
    currentDays: number;
    completed: boolean;
    claimedReward: boolean;
    /**
     * ISO date key (YYYY-MM-DD) of the last day counted toward this quest.
     * Primary dedup gate — progress only increments once per calendar day.
     */
    lastProgressDate: string | null;
    /** Full history of all counted dates — kept for debug / future analytics. */
    countedDates: string[];
  };
}

export interface QuestTemplate {
  title: string;
  description: string;
  type: Quest['type'];
  requirement: Quest['requirement'];
  xpReward: number;
  badgeReward: string;
}
