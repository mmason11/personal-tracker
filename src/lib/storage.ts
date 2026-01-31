import { BigThreeGoal, TodoItem } from "./types";
import { v4 as uuidv4 } from "uuid";
import { startOfWeek, format } from "date-fns";

// Big Three Goals
const BIG3_KEY = "big_three_goals";

export function getCurrentWeekStart(): string {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function getBigThree(): BigThreeGoal[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(BIG3_KEY);
  if (!stored) return [];
  const goals: BigThreeGoal[] = JSON.parse(stored);
  const currentWeek = getCurrentWeekStart();
  // Filter to current week only - reset on Monday
  return goals.filter((g) => g.weekStart === currentWeek);
}

export function saveBigThree(goals: BigThreeGoal[]): void {
  localStorage.setItem(BIG3_KEY, JSON.stringify(goals));
}

export function addBigThreeGoal(text: string): BigThreeGoal[] {
  const goals = getBigThree();
  if (goals.length >= 3) return goals;
  goals.push({
    id: uuidv4(),
    text,
    completed: false,
    weekStart: getCurrentWeekStart(),
  });
  saveBigThree(goals);
  return goals;
}

export function toggleBigThree(id: string): BigThreeGoal[] {
  const goals = getBigThree();
  const goal = goals.find((g) => g.id === id);
  if (goal) goal.completed = !goal.completed;
  saveBigThree(goals);
  return goals;
}

export function removeBigThree(id: string): BigThreeGoal[] {
  const goals = getBigThree().filter((g) => g.id !== id);
  saveBigThree(goals);
  return goals;
}

// To-Do List
const TODO_KEY = "todo_items";

export function getTodos(): TodoItem[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(TODO_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveTodos(todos: TodoItem[]): void {
  localStorage.setItem(TODO_KEY, JSON.stringify(todos));
}

export function addTodo(text: string, priority: TodoItem["priority"] = "medium", dueDate?: string): TodoItem[] {
  const todos = getTodos();
  todos.push({
    id: uuidv4(),
    text,
    completed: false,
    createdAt: new Date().toISOString(),
    priority,
    dueDate,
  });
  saveTodos(todos);
  return todos;
}

export function toggleTodo(id: string): TodoItem[] {
  const todos = getTodos();
  const todo = todos.find((t) => t.id === id);
  if (todo) todo.completed = !todo.completed;
  saveTodos(todos);
  return todos;
}

export function removeTodo(id: string): TodoItem[] {
  const todos = getTodos().filter((t) => t.id !== id);
  saveTodos(todos);
  return todos;
}
