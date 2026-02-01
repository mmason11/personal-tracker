"use client";

import { useState, useEffect, useRef } from "react";

interface EventEditorProps {
  mode: "create" | "edit";
  eventType?: "custom" | "routine";
  readOnly?: boolean;
  initialData: { name: string; start: string; end: string; date: string };
  onSave: (data: { name: string; start: string; end: string; date: string }) => void;
  onDelete?: () => void;
  onResetRoutine?: () => void;
  onClose: () => void;
}

export default function EventEditor({
  mode,
  eventType,
  readOnly,
  initialData,
  onSave,
  onDelete,
  onResetRoutine,
  onClose,
}: EventEditorProps) {
  const [name, setName] = useState(initialData.name);
  const [start, setStart] = useState(initialData.start);
  const [end, setEnd] = useState(initialData.end);
  const [date, setDate] = useState(initialData.date);
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSubmit = () => {
    if (eventType !== "routine" && !name.trim()) {
      setError("Name is required");
      return;
    }
    if (!start || !end) {
      setError("Start and end times are required");
      return;
    }
    if (start >= end) {
      setError("End time must be after start time");
      return;
    }
    onSave({ name: name.trim() || initialData.name, start, end, date });
  };

  const isRoutine = eventType === "routine";
  const isDisabled = isRoutine || readOnly;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="bg-slate-800 rounded-2xl border border-slate-700/50 p-6 shadow-2xl w-full max-w-sm mx-4">
        <h3 className="text-lg font-bold text-white mb-4">
          {mode === "create" ? "New Event" : readOnly ? "Event Details" : isRoutine ? "Edit Routine Time" : "Edit Event"}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isDisabled}
              placeholder="Event name"
              className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
              autoFocus={!isDisabled}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isDisabled}
              className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">Start</label>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                disabled={readOnly}
                className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">End</label>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                disabled={readOnly}
                className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

        <div className="flex items-center justify-between mt-5">
          <div className="flex gap-2">
            {onDelete && (
              <button
                onClick={onDelete}
                className="text-sm text-red-400 hover:text-red-300 transition-colors px-3 py-1.5"
              >
                Delete
              </button>
            )}
            {onResetRoutine && (
              <button
                onClick={onResetRoutine}
                className="text-sm text-amber-400 hover:text-amber-300 transition-colors px-3 py-1.5"
              >
                Reset to Default
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5"
            >
              {readOnly ? "Close" : "Cancel"}
            </button>
            {!readOnly && (
              <button
                onClick={handleSubmit}
                className="text-sm font-semibold px-4 py-1.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg hover:from-violet-500 hover:to-blue-500 transition-all shadow-lg shadow-violet-500/20"
              >
                {mode === "create" ? "Create" : "Save"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
