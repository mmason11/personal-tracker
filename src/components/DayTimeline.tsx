"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format, addDays, subDays, isToday } from "date-fns";
import { getRoutineForDate, getCurrentWeek } from "@/lib/routine";
import { fetchSportsSchedules, getGamesForDate } from "@/lib/sports";
import { isCompleted } from "@/lib/supabase-streaks";
import { formatTime12h } from "@/lib/timeFormat";
import {
  getCustomEventsForDate,
  addCustomEvent,
  updateCustomEvent,
  removeCustomEvent,
  getOverrideForRoutine,
  setRoutineOverride,
  removeRoutineOverride,
  skipRoutineForDay,
  isRoutineSkipped,
  getGoogleTokens,
} from "@/lib/supabase-storage";
import EventEditor from "./EventEditor";

import { CalendarEvent } from "@/lib/types";

interface TimeBlock {
  id: string;
  name: string;
  start: string;
  end: string;
  type: "routine" | "game-mancity" | "game-illinois" | "google" | "custom";
  completed?: boolean;
  editable: boolean;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(min: number): string {
  const clamped = Math.max(0, Math.min(min, 24 * 60 - 1));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function getCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

const PX_PER_MIN = 1.8;
const DRAG_THRESHOLD = 5;
const SNAP_MINUTES = 5;
const LEFT_GUTTER = 80; // px reserved for hour labels
const RIGHT_PAD = 8; // px padding on right

interface ColumnInfo {
  column: number;
  totalColumns: number;
}

function computeColumns(blocks: TimeBlock[]): Map<string, ColumnInfo> {
  const result = new Map<string, ColumnInfo>();
  if (blocks.length === 0) return result;

  // Sort by start time, then longest duration first
  const sorted = [...blocks].sort((a, b) => {
    const aStart = timeToMinutes(a.start);
    const bStart = timeToMinutes(b.start);
    if (aStart !== bStart) return aStart - bStart;
    const aDur = timeToMinutes(a.end) - aStart;
    const bDur = timeToMinutes(b.end) - bStart;
    return bDur - aDur;
  });

  // Group overlapping blocks into clusters
  type Placed = { block: TimeBlock; column: number };
  const clusters: Placed[][] = [];

  for (const block of sorted) {
    const bStart = timeToMinutes(block.start);
    const bEnd = timeToMinutes(block.end);

    // Find which cluster this block belongs to (overlaps with any member)
    let targetCluster: Placed[] | null = null;
    for (const cluster of clusters) {
      for (const placed of cluster) {
        const pStart = timeToMinutes(placed.block.start);
        const pEnd = timeToMinutes(placed.block.end);
        if (bStart < pEnd && bEnd > pStart) {
          targetCluster = cluster;
          break;
        }
      }
      if (targetCluster) break;
    }

    if (!targetCluster) {
      targetCluster = [];
      clusters.push(targetCluster);
    }

    // Find the first column where this block doesn't overlap with existing blocks
    const columnEnds: number[] = []; // track end time per column
    for (const placed of targetCluster) {
      const pStart = timeToMinutes(placed.block.start);
      const pEnd = timeToMinutes(placed.block.end);
      while (columnEnds.length <= placed.column) columnEnds.push(0);
      columnEnds[placed.column] = Math.max(columnEnds[placed.column], pEnd);
    }

    let col = 0;
    while (col < columnEnds.length && columnEnds[col] > bStart) {
      col++;
    }

    targetCluster.push({ block, column: col });
  }

  // Write results — totalColumns is per-cluster
  for (const cluster of clusters) {
    const maxCol = Math.max(...cluster.map((p) => p.column)) + 1;
    for (const placed of cluster) {
      result.set(placed.block.id, { column: placed.column, totalColumns: maxCol });
    }
  }

  return result;
}

export default function DayTimeline() {
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMinutes, setCurrentMinutes] = useState(getCurrentTimeMinutes());
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const isViewingToday = isToday(selectedDate);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [dragState, setDragState] = useState<{
    blockId: string;
    mode: "move" | "resize";
    initialY: number;
    initialStartMin: number;
    initialEndMin: number;
    currentStartMin: number;
    currentEndMin: number;
    hasMoved: boolean;
  } | null>(null);

  // Editor state
  const [editorState, setEditorState] = useState<{
    mode: "create" | "edit";
    blockId?: string;
    blockType?: string;
    initialData: { name: string; start: string; end: string; date: string };
  } | null>(null);

  const loadData = useCallback(async () => {
    const week = await getCurrentWeek();
    const routine = getRoutineForDate(selectedDate, week);
    const allGames = await fetchSportsSchedules();
    const dayGames = getGamesForDate(allGames, dateStr);

    const timeBlocks: TimeBlock[] = [];

    for (const item of routine) {
      if (item.endTime) {
        const override = await getOverrideForRoutine(item.id, dateStr);
        if (isRoutineSkipped(override)) continue;
        const completed = await isCompleted(item.id, dateStr);
        timeBlocks.push({
          id: item.id,
          name: item.name,
          start: override ? override.start : item.time,
          end: override ? override.end : item.endTime,
          type: "routine",
          completed,
          editable: true,
        });
      }
    }

    dayGames.forEach((game) => {
      timeBlocks.push({
        id: game.id,
        name: `${game.team === "man-city" ? "Man City" : "Illinois"} vs ${game.opponent}`,
        start: game.time,
        end: game.endTime,
        type: game.team === "man-city" ? "game-mancity" : "game-illinois",
        editable: false,
      });
    });

    // Custom events
    const customEvents = await getCustomEventsForDate(dateStr);
    customEvents.forEach((evt) => {
      timeBlocks.push({
        id: evt.id,
        name: evt.name,
        start: evt.start,
        end: evt.end,
        type: "custom",
        editable: true,
      });
    });

    // Google Calendar events
    try {
      const { accessToken } = await getGoogleTokens();
      if (accessToken) {
        setGoogleToken(accessToken);
        const res = await fetch(`/api/calendar?action=events&token=${accessToken}`);
        if (res.ok) {
          const gcalEvents: CalendarEvent[] = await res.json();
          gcalEvents.forEach((evt) => {
            if (!evt.start || !evt.end) return;
            const evtDate = evt.start.substring(0, 10);
            if (evtDate !== dateStr) return;
            if (evt.summary.startsWith("[Routine]") || evt.summary.startsWith("[Game]")) return;
            const startTime = evt.start.substring(11, 16);
            const endTime = evt.end.substring(11, 16);
            if (!startTime || !endTime) return;
            timeBlocks.push({
              id: evt.id,
              name: evt.summary,
              start: startTime,
              end: endTime,
              type: "google",
              editable: true,
            });
          });
        }
      }
    } catch {
      // Ignore calendar fetch errors
    }

    timeBlocks.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    setBlocks(timeBlocks);
  }, [selectedDate, dateStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMinutes(getCurrentTimeMinutes());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Pointer event handlers for drag
  const handlePointerDown = (
    e: React.PointerEvent,
    blockId: string,
    mode: "move" | "resize"
  ) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block || !block.editable) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    setDragState({
      blockId,
      mode,
      initialY: e.clientY,
      initialStartMin: timeToMinutes(block.start),
      initialEndMin: timeToMinutes(block.end),
      currentStartMin: timeToMinutes(block.start),
      currentEndMin: timeToMinutes(block.end),
      hasMoved: false,
    });
  };

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragState) return;
      const deltaY = e.clientY - dragState.initialY;

      if (!dragState.hasMoved && Math.abs(deltaY) < DRAG_THRESHOLD) return;

      const deltaMin = deltaY / PX_PER_MIN;
      const snappedDelta = Math.round(deltaMin / SNAP_MINUTES) * SNAP_MINUTES;

      if (dragState.mode === "move") {
        const duration = dragState.initialEndMin - dragState.initialStartMin;
        let newStart = dragState.initialStartMin + snappedDelta;
        newStart = Math.max(0, Math.min(newStart, 24 * 60 - duration));
        setDragState((prev) =>
          prev
            ? {
                ...prev,
                currentStartMin: newStart,
                currentEndMin: newStart + duration,
                hasMoved: true,
              }
            : null
        );
      } else {
        let newEnd = dragState.initialEndMin + snappedDelta;
        newEnd = Math.max(dragState.currentStartMin + SNAP_MINUTES, Math.min(newEnd, 24 * 60));
        setDragState((prev) =>
          prev ? { ...prev, currentEndMin: newEnd, hasMoved: true } : null
        );
      }
    },
    [dragState]
  );

  const handlePointerUp = useCallback(async () => {
    if (!dragState) return;

    if (dragState.hasMoved) {
      const newStart = minutesToTime(dragState.currentStartMin);
      const newEnd = minutesToTime(dragState.currentEndMin);
      const block = blocks.find((b) => b.id === dragState.blockId);
      if (block) {
        if (block.type === "custom") {
          await updateCustomEvent(dragState.blockId, { start: newStart, end: newEnd });
        } else if (block.type === "routine") {
          await setRoutineOverride(dragState.blockId, dateStr, newStart, newEnd);
        }
        loadData();
      }
    }

    setDragState(null);
  }, [dragState, blocks, dateStr, loadData]);

  useEffect(() => {
    if (!dragState) return;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, handlePointerMove, handlePointerUp]);

  const goToPrev = () => setSelectedDate((d) => subDays(d, 1));
  const goToNext = () => setSelectedDate((d) => addDays(d, 1));
  const goToToday = () => setSelectedDate(new Date());

  // Click on empty space to create event
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (dragState?.hasMoved) return;
    const target = e.target as HTMLElement;
    if (target !== containerRef.current && !target.dataset.timelineBackground) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const clickMin = timelineStartMin + clickY / PX_PER_MIN;
    const snappedMin = Math.round(clickMin / 15) * 15;
    const startTime = minutesToTime(snappedMin);
    const endTime = minutesToTime(snappedMin + 30);
    setEditorState({
      mode: "create",
      initialData: { name: "", start: startTime, end: endTime, date: dateStr },
    });
  };

  // Click on block to edit
  const handleBlockClick = (block: TimeBlock) => {
    if (dragState?.hasMoved) return;
    const blockType = block.type === "custom" ? "custom" : block.type === "routine" ? "routine" : block.type;
    setEditorState({
      mode: "edit",
      blockId: block.id,
      blockType: blockType as "custom" | "routine",
      initialData: { name: block.name, start: block.start, end: block.end, date: dateStr },
    });
  };

  // Compute timeline bounds
  const allMinutes = blocks.flatMap((b) => [timeToMinutes(b.start), timeToMinutes(b.end)]);
  const rawStart = allMinutes.length > 0 ? Math.min(...allMinutes) : 5 * 60;
  const rawEnd = allMinutes.length > 0 ? Math.max(...allMinutes) : 23 * 60;
  const timelineStartMin = Math.floor(rawStart / 60) * 60;
  const timelineEndMin = Math.ceil(rawEnd / 60) * 60;
  const totalMinutes = timelineEndMin - timelineStartMin;
  const totalHeight = totalMinutes * PX_PER_MIN;

  const minToY = (min: number) => (min - timelineStartMin) * PX_PER_MIN;

  const currentTimeY = minToY(currentMinutes);
  const showCurrentLine =
    isViewingToday && currentMinutes >= timelineStartMin && currentMinutes <= timelineEndMin;

  const hourMarkers: number[] = [];
  for (let h = Math.ceil(timelineStartMin / 60); h <= Math.floor(timelineEndMin / 60); h++) {
    hourMarkers.push(h);
  }

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-white">Timeline</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-600 text-slate-300 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToToday}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              isViewingToday
                ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                : "bg-slate-700/60 text-slate-300 hover:bg-slate-600 hover:text-white"
            }`}
          >
            {isViewingToday ? "Today" : format(selectedDate, "MMM d")}
          </button>
          <button
            onClick={goToNext}
            className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-600 text-slate-300 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-400 mb-4">
        {format(selectedDate, "EEEE, MMMM d, yyyy")}
      </p>

      {/* Add event button */}
      <button
        onClick={() =>
          setEditorState({
            mode: "create",
            initialData: { name: "", start: "09:00", end: "09:30", date: dateStr },
          })
        }
        className="mb-4 text-sm text-violet-400 hover:text-violet-300 transition-colors inline-flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add event
      </button>

      {blocks.length === 0 ? (
        <p className="text-slate-500 text-center py-8">Nothing scheduled</p>
      ) : (
        <div
          ref={containerRef}
          className="relative select-none"
          style={{ height: `${totalHeight}px`, touchAction: dragState ? "none" : "auto" }}
          onClick={handleTimelineClick}
        >
          {/* Clickable background layer */}
          <div
            data-timeline-background="true"
            className="absolute inset-0"
          />

          {/* Hour markers */}
          {hourMarkers.map((h) => {
            const y = minToY(h * 60);
            return (
              <div
                key={h}
                className="absolute left-0 right-0 flex items-center pointer-events-none"
                style={{ top: `${y}px`, transform: "translateY(-50%)" }}
              >
                <span className="text-xs text-slate-500 w-16 flex-shrink-0 text-right pr-3 font-mono">
                  {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                </span>
                <div className="flex-1 border-t border-slate-700/50" />
              </div>
            );
          })}

          {/* Current time line */}
          {showCurrentLine && (
            <div
              className="absolute left-0 right-0 flex items-center z-20 pointer-events-none"
              style={{ top: `${currentTimeY}px`, transform: "translateY(-50%)" }}
            >
              <span className="text-xs text-red-400 w-16 flex-shrink-0 text-right pr-3 font-bold font-mono">
                {formatTime12h(
                  `${Math.floor(currentMinutes / 60).toString().padStart(2, "0")}:${(currentMinutes % 60).toString().padStart(2, "0")}`
                )}
              </span>
              <div className="relative flex-1">
                <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-red-500 rounded-full shadow-lg shadow-red-500/50" />
                <div className="border-t-2 border-red-500 shadow-sm shadow-red-500/30" />
              </div>
            </div>
          )}

          {/* Event blocks */}
          {(() => {
            const columnMap = computeColumns(blocks);
            return blocks.map((block) => {
            const isDragging = dragState?.blockId === block.id;
            const startMin = isDragging ? dragState.currentStartMin : timeToMinutes(block.start);
            const endMin = isDragging ? dragState.currentEndMin : timeToMinutes(block.end);
            const y = minToY(startMin);
            const h = Math.max((endMin - startMin) * PX_PER_MIN, 0);

            let bgClass = "from-blue-500/20 to-blue-600/10 border-blue-500/40";
            let dotClass = "bg-blue-400";
            let textClass = "text-blue-300";

            if (block.completed) {
              bgClass = "from-emerald-500/20 to-emerald-600/10 border-emerald-500/40";
              dotClass = "bg-emerald-400";
              textClass = "text-emerald-300";
            } else if (block.type === "game-mancity") {
              bgClass = "from-sky-500/25 to-cyan-600/10 border-sky-400/50";
              dotClass = "bg-sky-400";
              textClass = "text-sky-300";
            } else if (block.type === "game-illinois") {
              bgClass = "from-orange-500/25 to-amber-600/10 border-orange-400/50";
              dotClass = "bg-orange-400";
              textClass = "text-orange-300";
            } else if (block.type === "google") {
              bgClass = "from-violet-500/20 to-purple-600/10 border-violet-400/50";
              dotClass = "bg-violet-400";
              textClass = "text-violet-300";
            } else if (block.type === "custom") {
              bgClass = "from-rose-500/20 to-pink-600/10 border-rose-400/50";
              dotClass = "bg-rose-400";
              textClass = "text-rose-300";
            }

            const displayStart = isDragging ? minutesToTime(dragState.currentStartMin) : block.start;
            const displayEnd = isDragging ? minutesToTime(dragState.currentEndMin) : block.end;

            const colInfo = columnMap.get(block.id) || { column: 0, totalColumns: 1 };
            const containerWidth = containerRef.current?.clientWidth || 600;
            const availableWidth = containerWidth - LEFT_GUTTER - RIGHT_PAD;
            const colWidth = availableWidth / colInfo.totalColumns;
            const colLeft = LEFT_GUTTER + colInfo.column * colWidth;

            return (
              <div
                key={block.id}
                className={`absolute rounded-xl border bg-gradient-to-r ${bgClass} px-3 py-1.5 z-10 overflow-hidden ${
                  block.editable
                    ? isDragging
                      ? "cursor-grabbing opacity-90 shadow-lg shadow-black/30 ring-2 ring-violet-500/30"
                      : "cursor-grab hover:brightness-110"
                    : "cursor-pointer hover:brightness-110"
                }`}
                style={{ top: `${y}px`, height: `${h}px`, left: `${colLeft}px`, width: `${colWidth}px` }}
                onPointerDown={(e) => {
                  if (block.editable) handlePointerDown(e, block.id, "move");
                }}
                onClick={() => handleBlockClick(block)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-2 h-2 rounded-full ${dotClass} flex-shrink-0`} />
                  <p className={`font-semibold text-sm ${textClass} truncate`}>{block.name}</p>
                  <span className="text-xs text-slate-400 flex-shrink-0 ml-auto">
                    {formatTime12h(displayStart)} - {formatTime12h(displayEnd)}
                  </span>
                  {block.completed && (
                    <span className="text-emerald-400 text-xs font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                      Done
                    </span>
                  )}
                </div>
                {/* Resize handle */}
                {block.editable && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize group"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handlePointerDown(e, block.id, "resize");
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mx-auto w-8 h-1 rounded-full bg-white/15 group-hover:bg-white/40 mt-1" />
                  </div>
                )}
              </div>
            );
          });
          })()}
        </div>
      )}

      {/* Event Editor Modal */}
      {editorState && (() => {
        const bt = editorState.blockType;
        const isGoogle = bt === "google";
        const isReadOnly = bt !== "custom" && bt !== "routine" && !isGoogle && editorState.mode === "edit";
        return (
          <EventEditor
            mode={editorState.mode}
            eventType={bt === "custom" ? "custom" : bt === "routine" ? "routine" : undefined}
            readOnly={isReadOnly}
            initialData={editorState.initialData}
            onSave={async (data) => {
              if (editorState.mode === "create") {
                await addCustomEvent({ name: data.name, date: data.date, start: data.start, end: data.end });
              } else if (bt === "custom") {
                await updateCustomEvent(editorState.blockId!, { name: data.name, start: data.start, end: data.end, date: data.date });
              } else if (bt === "routine") {
                await setRoutineOverride(editorState.blockId!, data.date, data.start, data.end);
              } else if (isGoogle && googleToken) {
                const datePrefix = data.date;
                await fetch("/api/calendar", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "update",
                    token: googleToken,
                    eventId: editorState.blockId,
                    event: {
                      summary: data.name,
                      start: { dateTime: `${datePrefix}T${data.start}:00`, timeZone: "America/Chicago" },
                      end: { dateTime: `${datePrefix}T${data.end}:00`, timeZone: "America/Chicago" },
                    },
                  }),
                });
              }
              setEditorState(null);
              loadData();
            }}
            onDelete={
              bt === "custom"
                ? async () => {
                    await removeCustomEvent(editorState.blockId!);
                    setEditorState(null);
                    loadData();
                  }
                : bt === "routine"
                ? async () => {
                    await skipRoutineForDay(editorState.blockId!, dateStr);
                    setEditorState(null);
                    loadData();
                  }
                : isGoogle && googleToken
                ? async () => {
                    await fetch("/api/calendar", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "delete",
                        token: googleToken,
                        eventId: editorState.blockId,
                      }),
                    });
                    setEditorState(null);
                    loadData();
                  }
                : undefined
            }
            onResetRoutine={
              bt === "routine" && editorState.mode === "edit"
                ? async () => {
                    await removeRoutineOverride(editorState.blockId!, dateStr);
                    setEditorState(null);
                    loadData();
                  }
                : undefined
            }
            onClose={() => setEditorState(null)}
          />
        );
      })()}
    </div>
  );
}
