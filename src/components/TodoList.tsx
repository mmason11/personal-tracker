"use client";

import { useState, useEffect } from "react";
import { TodoItem } from "@/lib/types";
import { getTodos, addTodo, toggleTodo, removeTodo } from "@/lib/storage";

export default function TodoList() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [priority, setPriority] = useState<TodoItem["priority"]>("medium");
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    setTodos(getTodos());
  }, []);

  const handleAdd = () => {
    if (!newTodo.trim()) return;
    setTodos(addTodo(newTodo.trim(), priority));
    setNewTodo("");
    setPriority("medium");
  };

  const handleToggle = (id: string) => {
    setTodos(toggleTodo(id));
  };

  const handleRemove = (id: string) => {
    setTodos(removeTodo(id));
  };

  const activeTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);

  const priorityColors = {
    high: "text-red-400 bg-red-500/10 border-red-500/30",
    medium: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    low: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  };

  return (
    <div className="bg-slate-800 rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">To-Do List</h2>
        <span className="text-sm text-slate-400">{activeTodos.length} active</span>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add a task..."
          className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TodoItem["priority"])}
          className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
        >
          <option value="low">Low</option>
          <option value="medium">Med</option>
          <option value="high">High</option>
        </select>
        <button
          onClick={handleAdd}
          disabled={!newTodo.trim()}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      <div className="space-y-2">
        {activeTodos.length === 0 && (
          <p className="text-slate-500 text-center py-4">
            No tasks yet. Add one above!
          </p>
        )}
        {activeTodos.map((todo) => (
          <div
            key={todo.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/50 border border-slate-600/30 group"
          >
            <button
              onClick={() => handleToggle(todo.id)}
              className="w-5 h-5 rounded-full border-2 border-slate-500 hover:border-green-400 flex-shrink-0 transition-colors"
            />
            <span className="flex-1 text-white">{todo.text}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded border ${priorityColors[todo.priority]}`}
            >
              {todo.priority}
            </span>
            <button
              onClick={() => handleRemove(todo.id)}
              className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>

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
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/30 border border-slate-700/30 group"
                >
                  <button
                    onClick={() => handleToggle(todo.id)}
                    className="w-5 h-5 rounded-full bg-green-500 border-2 border-green-500 flex-shrink-0 flex items-center justify-center"
                  >
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </button>
                  <span className="flex-1 text-slate-500 line-through">
                    {todo.text}
                  </span>
                  <button
                    onClick={() => handleRemove(todo.id)}
                    className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
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
