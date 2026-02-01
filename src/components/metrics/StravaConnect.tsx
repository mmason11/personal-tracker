"use client";

import { useEffect } from "react";
import { saveStravaTokens, clearStravaTokens } from "@/lib/strava";

interface Props {
  connected: boolean;
  onConnectionChange: (connected: boolean) => void;
  onSync: () => void;
  syncing: boolean;
}

export default function StravaConnect({ connected, onConnectionChange, onSync, syncing }: Props) {
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "strava-auth" && event.data.access_token) {
        await saveStravaTokens(
          event.data.access_token,
          event.data.refresh_token,
          event.data.athlete_id,
          event.data.expires_at
        );
        onConnectionChange(true);
        onSync();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onConnectionChange, onSync]);

  const handleConnect = async () => {
    const res = await fetch("/api/strava/auth");
    const data = await res.json();
    if (data.authUrl) {
      window.open(data.authUrl, "strava-auth", "width=500,height=700");
    }
  };

  const handleDisconnect = async () => {
    await clearStravaTokens();
    onConnectionChange(false);
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l-5 10 3-1 2 5 5-10-3 1-2-5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Strava</h3>
            <p className={`text-xs ${connected ? "text-orange-400" : "text-slate-500"}`}>
              {connected ? "Connected" : "Not connected"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <button
              onClick={onSync}
              disabled={syncing}
              className="text-xs px-3 py-1.5 bg-orange-500/15 text-orange-400 rounded-lg hover:bg-orange-500/25 transition-all disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync"}
            </button>
          )}
          <button
            onClick={connected ? handleDisconnect : handleConnect}
            className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
              connected
                ? "text-slate-400 hover:text-red-400"
                : "bg-orange-500/15 text-orange-400 hover:bg-orange-500/25"
            }`}
          >
            {connected ? "Disconnect" : "Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}
