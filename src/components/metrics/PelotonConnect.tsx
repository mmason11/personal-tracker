"use client";

import { useState } from "react";
import { savePelotonSession, clearPelotonSession } from "@/lib/peloton";

interface Props {
  connected: boolean;
  onConnectionChange: (connected: boolean) => void;
  onSync: () => void;
  syncing: boolean;
}

export default function PelotonConnect({ connected, onConnectionChange, onSync, syncing }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/peloton/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        await savePelotonSession(data.session_id, data.user_id);
        onConnectionChange(true);
        setShowForm(false);
        setUsername("");
        setPassword("");
        onSync();
      }
    } catch {
      setError("Failed to connect");
    }
    setLoading(false);
  };

  const handleDisconnect = async () => {
    await clearPelotonSession();
    onConnectionChange(false);
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Peloton</h3>
            <p className={`text-xs ${connected ? "text-blue-400" : "text-slate-500"}`}>
              {connected ? "Connected" : "Not connected"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <button
              onClick={onSync}
              disabled={syncing}
              className="text-xs px-3 py-1.5 bg-blue-500/15 text-blue-400 rounded-lg hover:bg-blue-500/25 transition-all disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync"}
            </button>
          )}
          <button
            onClick={connected ? handleDisconnect : () => setShowForm(true)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
              connected
                ? "text-slate-400 hover:text-red-400"
                : "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"
            }`}
          >
            {connected ? "Disconnect" : "Connect"}
          </button>
        </div>
      </div>

      {showForm && !connected && (
        <form onSubmit={handleLogin} className="mt-4 space-y-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Peloton email or username"
            required
            className="w-full bg-slate-700/60 border border-slate-600/50 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full bg-slate-700/60 border border-slate-600/50 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
          />
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 transition-all disabled:opacity-50"
            >
              {loading ? "Connecting..." : "Login"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-slate-400 text-sm hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            Credentials are sent securely to Peloton and never stored.
          </p>
        </form>
      )}
    </div>
  );
}
