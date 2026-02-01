"use client";

import { DateRange } from "@/hooks/useFitnessData";

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const options: { id: DateRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7days", label: "7 Days" },
  { id: "30days", label: "30 Days" },
];

export default function DateRangePicker({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 bg-slate-800/60 rounded-xl p-1 border border-slate-700/50">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            value === opt.id
              ? "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-700/60"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
