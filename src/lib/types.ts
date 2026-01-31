export interface RoutineItem {
  id: string;
  name: string;
  time: string; // HH:mm format
  endTime?: string; // HH:mm format for duration-based items
  weekdaysOnly?: boolean;
  progressive?: {
    startTime: string; // HH:mm
    endTime: string; // HH:mm
    weeks: number;
  };
}

export interface RoutineCompletion {
  routineId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
}

export interface Streak {
  routineId: string;
  current: number;
  best: number;
  lastCompleted: string; // YYYY-MM-DD
}

export interface SportsGame {
  id: string;
  team: "man-city" | "illinois-basketball";
  opponent: string;
  date: string; // ISO string
  time: string; // HH:mm
  endTime: string; // HH:mm (estimated)
  venue: string;
  isHome: boolean;
  competition?: string;
}

export interface Conflict {
  game: SportsGame;
  routineItem: RoutineItem;
  suggestion: string;
}

export interface BigThreeGoal {
  id: string;
  text: string;
  completed: boolean;
  weekStart: string; // YYYY-MM-DD (Monday)
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  dueDate?: string;
  priority: "low" | "medium" | "high";
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  source: "routine" | "sports" | "manual" | "google";
}
