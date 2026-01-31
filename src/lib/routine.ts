import { RoutineItem } from "./types";

// Week 1 start date - set to the Monday of the week the app is first used
function getWeek1Start(): string {
  if (typeof window === "undefined") return new Date().toISOString();
  const stored = localStorage.getItem("week1Start");
  if (stored) return stored;
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const iso = monday.toISOString();
  localStorage.setItem("week1Start", iso);
  return iso;
}

export function getCurrentWeek(): number {
  const start = new Date(getWeek1Start());
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.min(Math.max(diffWeeks + 1, 1), 5);
}

export function getWakeUpTime(week: number): string {
  // Week 1: 7:00 AM → Week 5: 5:00 AM (30 min earlier each week)
  const hours = 7 - (Math.min(week, 5) - 1) * 0.5;
  const h = Math.floor(hours);
  const m = (hours - h) * 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function getDefaultRoutine(week: number): RoutineItem[] {
  return [
    {
      id: "wake-up",
      name: "Wake Up",
      time: getWakeUpTime(week),
      progressive: {
        startTime: "07:00",
        endTime: "05:00",
        weeks: 5,
      },
    },
    {
      id: "lunch",
      name: "Lunch Break",
      time: "13:00",
      endTime: "14:00",
      weekdaysOnly: true,
    },
    {
      id: "peloton",
      name: "Peloton Workout",
      time: "17:30",
      endTime: "18:15",
    },
    {
      id: "dinner",
      name: "Dinner",
      time: "18:15",
      endTime: "19:00",
    },
    {
      id: "wash-face",
      name: "Wash Face & Brush Teeth",
      time: "21:00",
      endTime: "21:15",
    },
    {
      id: "reading",
      name: "Reading Before Bed",
      time: "21:15",
      endTime: "21:30",
    },
    {
      id: "lights-out",
      name: "Lights Out",
      time: "21:30",
    },
  ];
}

export function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function getRoutineForDate(date: Date, week: number): RoutineItem[] {
  const routine = getDefaultRoutine(week);
  if (!isWeekday(date)) {
    return routine.filter((item) => !item.weekdaysOnly);
  }
  return routine;
}
