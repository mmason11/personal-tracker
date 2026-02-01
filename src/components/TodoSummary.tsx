"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { TodoItem } from "@/lib/types";
import { getTodos, toggleTodo } from "@/lib/supabase-storage";

export default function TodoSummary() {
  const [todos, setTodos] = useState<TodoItem[]>([]);

  useEffect(() => {
    getTodos().then(setTodos).catch(console.error);
  }, []);

  const handleToggle = async (id: string) => {
    setTodos(await toggleTodo(id));
  };

  const activeTodos = todos
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (a.dueDate && b.dueDate) {
        const dateDiff = a.dueDate.localeCompare(b.dueDate);
        if (dateDiff !== 0) return dateDiff;
      } else if (a.dueDate) return -1;
      else if (b.dueDate) return 1;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, 5);

  const priorityDot = {
    high: "bg-red-400 shadow-red-400/50",
    medium: "bg-amber-400 shadow-amber-400/50",
    low: "bg-blue-400 shadow-blue-400/50",
  };

  const formatDue = (date: string) => {
    const d = new Date(date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, cls: "text-red-400 font-semibold" };
    if (diff === 0) return { text: "Today", cls: "text-amber-400 font-semibold" };
    if (diff === 1) return { text: "Tomorrow", cls: "text-amber-300" };
    if (diff <= 7) return { text: `${diff}d`, cls: "text-blue-400" };
    return { text: format(d, "MMM d"), cls: "text-slate-400" };
  };

  const overdue = todos.filter(
    (t) => !t.completed && t.dueDate && new Date(t.dueDate + "T00:00:00") < new Date(new Date().toDateString())
  ).length;
  const dueToday = todos.filter((t) => {
    if (t.completed || !t.dueDate) return false;
    return t.dueDate === format(new Date(), "yyyy-MM-dd");
  }).length;

  if (activeTodos.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Upcoming Tasks</h2>
        <div className="flex gap-2">
          {overdue > 0 && (
            <span className="text-xs font-bold text-red-400 bg-red-500/15 px-2.5 py-1 rounded-full">
              {overdue} overdue
            </span>
          )}
          {dueToday > 0 && (
            <span className="text-xs font-bold text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-full">
              {dueToday} today
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {activeTodos.map((todo) => {
          const due = todo.dueDate ? formatDue(todo.dueDate) : null;
          return (
            <div
              key={todo.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/40 border border-slate-600/30 hover:bg-slate-700/60 transition-all"
            >
              <button
                onClick={() => handleToggle(todo.id)}
                className="w-5 h-5 rounded-full border-2 border-slate-500 hover:border-emerald-400 hover:bg-emerald-400/10 flex-shrink-0 transition-all"
              />
              <div className={`w-2 h-2 rounded-full ${priorityDot[todo.priority]} shadow-sm flex-shrink-0`} />
              <span className="flex-1 text-white text-sm truncate">{todo.text}</span>
              {due && (
                <span className={`text-xs ${due.cls} flex-shrink-0`}>{due.text}</span>
              )}
            </div>
          );
        })}
      </div>

      {todos.filter((t) => !t.completed).length > 5 && (
        <p className="text-xs text-slate-500 text-center mt-3">
          +{todos.filter((t) => !t.completed).length - 5} more tasks
        </p>
      )}
    </div>
  );
}
