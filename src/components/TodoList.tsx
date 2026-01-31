"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { TodoItem } from "@/lib/types";
import { getTodos, addTodo, toggleTodo, removeTodo } from "@/lib/storage";

export default function TodoList() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [priority, setPriority] = useState<TodoItem["priority"]>("medium");
  const [dueDate, setDueDate] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    setTodos(getTodos());
  }, []);

  const handleAdd = () => {
    if (!newTodo.trim()) return;
    setTodos(addTodo(newTodo.trim(), priority, dueDate || undefined));
    setNewTodo("");
    setPriority("medium");
    setDueDate("");
  };

  const handleToggle = (id: string) => {
    setTodos(toggleTodo(id));
  };

  const handleRemove = (id: string) => {
    setTodos(removeTodo(id));
  };

  const activeTodos = todos
    .filter((t) => !t.completed)
    .sort((a, b) => {
      // Sort by due date first (no date = last), then priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (a.dueDate && b.dueDate) {
        const dateDiff = a.dueDate.localeCompare(b.dueDate);
        if (dateDiff !== 0) return dateDiff;
      } else if (a.dueDate) return -1;
      else if (b.dueDate) return 1;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  const completedTodos = todos.filter((t) => t.completed);

  const priorityConfig = {
    high: { label: "High", color: "text-red-400 bg-red-500/15 border-red-500/30" },
    medium: { label: "Med", color: "text-amber-400 bg-amber-500/15 border-amber-500/30" },
    low: { label: "Low", color: "text-blue-400 bg-blue-500/15 border-blue-500/30" },
  };

  const formatDueDate = (date: string) => {
    const d = new Date(date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d.getTime() - today.getTime()) / (86400000));
    if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, className: "text-red-400" };
    if (diffDays === 0) return { text: "Today", className: "text-amber-400" };
    if (diffDays === 1) return { text: "Tomorrow", className: "text-amber-300" };
    if (diffDays <= 7) return { text: `${diffDays}d left`, className: "text-blue-400" };
    return { text: format(d, "MMM d"), className: "text-slate-400" };
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">To-Do List</h2>
        <span className="text-sm font-semibold text-violet-400 bg-violet-500/15 px-3 py-1 rounded-full">
          {activeTodos.length} active
        </span>
      </div>

      {/* Add form */}
      <div className="space-y-2 mb-5">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Add a task..."
            className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
          />
          <button
            onClick={handleAdd}
            disabled={!newTodo.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl hover:from-violet-500 hover:to-blue-500 transition-all font-semibold disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
          >
            Add
          </button>
        </div>
        <div className="flex gap-2">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TodoItem["priority"])}
            className="bg-slate-700/60 border border-slate-600/50 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-violet-500/60 text-sm"
          >
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
          <div className="relative flex-1">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-slate-700/60 border border-slate-600/50 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-violet-500/60 text-sm [color-scheme:dark]"
              placeholder="Due date"
            />
          </div>
          {dueDate && (
            <button
              onClick={() => setDueDate("")}
              className="px-2 text-slate-400 hover:text-white text-sm"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Active todos */}
      <div className="space-y-2">
        {activeTodos.length === 0 && (
          <p className="text-slate-500 text-center py-6">No tasks yet. Add one above!</p>
        )}
        {activeTodos.map((todo) => {
          const due = todo.dueDate ? formatDueDate(todo.dueDate) : null;
          return (
            <div
              key={todo.id}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-700/40 border border-slate-600/30 group hover:bg-slate-700/60 transition-all"
            >
              <button
                onClick={() => handleToggle(todo.id)}
                className="w-5 h-5 rounded-full border-2 border-slate-500 hover:border-emerald-400 hover:bg-emerald-400/10 flex-shrink-0 transition-all"
              />
              <div className="flex-1 min-w-0">
                <span className="text-white block">{todo.text}</span>
                {due && (
                  <span className={`text-xs ${due.className} mt-0.5 block`}>
                    Due: {due.text}
                  </span>
                )}
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full border font-medium ${priorityConfig[todo.priority].color}`}
              >
                {priorityConfig[todo.priority].label}
              </span>
              <button
                onClick={() => handleRemove(todo.id)}
                className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* Completed */}
      {completedTodos.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            {showCompleted ? "Hide" : "Show"} completed ({completedTodos.length})
          </button>
          {showCompleted && (
            <div className="space-y-2 mt-2">
              {completedTodos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/20 border border-slate-700/30 group"
                >
                  <button
                    onClick={() => handleToggle(todo.id)}
                    className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-emerald-500 flex-shrink-0 flex items-center justify-center"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <span className="flex-1 text-slate-500 line-through">{todo.text}</span>
                  <button
                    onClick={() => handleRemove(todo.id)}
                    className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
