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
  return Math.max(diffWeeks + 1, 1);
}

export function getWakeUpTime(week: number): string {
  // Week 1: 6:30 AM → 30 min earlier each week → caps at 5:00 AM
  const totalMinutes = 6 * 60 + 30 - (Math.min(week, 4) - 1) * 30;
  const clamped = Math.max(totalMinutes, 5 * 60); // never earlier than 5:00 AM
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${nh.toString().padStart(2, "0")}:${nm.toString().padStart(2, "0")}`;
}

export function getDefaultRoutine(week: number): RoutineItem[] {
  const wakeTime = getWakeUpTime(week);
  return [
    {
      id: "wake-up",
      name: "Wake Up",
      time: wakeTime,
      endTime: addMinutesToTime(wakeTime, 15),
      progressive: {
        startTime: "06:30",
        endTime: "05:00",
        weeks: 4,
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
      endTime: "21:45",
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
