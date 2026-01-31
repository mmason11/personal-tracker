"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarEvent } from "@/lib/types";

export default function GoogleCalendar() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?action=events&token=${token}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
        setConnected(true);
      } else {
        const refreshToken = localStorage.getItem("google_refresh_token");
        if (refreshToken) {
          const refreshRes = await fetch("/api/calendar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "refresh",
              refresh_token: refreshToken,
            }),
          });
          const refreshData = await refreshRes.json();
          if (refreshData.access_token) {
            localStorage.setItem(
              "google_access_token",
              refreshData.access_token
            );
            const retryRes = await fetch(
              `/api/calendar?action=events&token=${refreshData.access_token}`
            );
            if (retryRes.ok) {
              const data = await retryRes.json();
              setEvents(data);
              setConnected(true);
            }
          }
        } else {
          setConnected(false);
        }
      }
    } catch {
      console.error("Failed to fetch calendar events");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("google_access_token");
    if (token) {
      fetchEvents(token);
    }

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "google-auth" && event.data.code) {
        const res = await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "token", code: event.data.code }),
        });
        const data = await res.json();
        if (data.access_token) {
          localStorage.setItem("google_access_token", data.access_token);
          if (data.refresh_token) {
            localStorage.setItem("google_refresh_token", data.refresh_token);
          }
          fetchEvents(data.access_token);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [fetchEvents]);

  const handleConnect = async () => {
    const res = await fetch("/api/calendar?action=auth");
    const data = await res.json();
    if (data.authUrl) {
      window.open(data.authUrl, "google-auth", "width=500,height=600");
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem("google_access_token");
    localStorage.removeItem("google_refresh_token");
    setConnected(false);
    setEvents([]);
  };

  const formatEventTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const formatEventDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-slate-800 rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Google Calendar</h2>
        {connected && (
          <button
            onClick={handleDisconnect}
            className="text-sm text-slate-400 hover:text-red-400 transition-colors"
          >
            Disconnect
          </button>
        )}
      </div>

      {!connected ? (
        <div className="text-center py-6">
          <div className="mb-4">
            <svg
              className="w-12 h-12 mx-auto text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-slate-400 mb-4">
            Connect your Google Calendar to see your events here
          </p>
          <button
            onClick={handleConnect}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium inline-flex items-center gap-2"
          >
            Connect Google Calendar
          </button>
        </div>
      ) : loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-slate-700 rounded-xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-slate-400 text-center py-6">No upcoming events</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {events.slice(0, 10).map((event) => (
            <div
              key={event.id}
              className="p-3 rounded-xl bg-slate-700/50 border border-slate-600/30"
            >
              <p className="text-white font-medium text-sm">{event.summary}</p>
              <p className="text-slate-400 text-xs mt-1">
                {formatEventDate(event.start)} &middot;{" "}
                {formatEventTime(event.start)} - {formatEventTime(event.end)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
