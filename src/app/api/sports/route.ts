import { NextResponse } from "next/server";
import { SportsGame } from "@/lib/types";

function toCentralTime(date: Date): { hours: string; mins: string; dateStr: string } {
  const central = new Date(date.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  return {
    hours: central.getHours().toString().padStart(2, "0"),
    mins: central.getMinutes().toString().padStart(2, "0"),
    dateStr: central.toISOString(),
  };
}

interface ESPNFeedEntry {
  id: string;
  date: string;
  opponentName: string;
  opponentLocation: string;
  opponentNickname: string;
  homeAway: "h" | "a";
  statusName: string;
  leagueName?: string;
  neutralSite?: boolean;
  shortName?: string;
}

interface ESPNScheduleResponse {
  columns?: Array<{
    items?: Array<{
      feed?: ESPNFeedEntry[];
    }>;
  }>;
}

async function fetchManCitySchedule(): Promise<SportsGame[]> {
  try {
    const res = await fetch(
      "https://cdn.espn.com/core/soccer/team/_/id/382/schedule?xhr=1&render=false",
      { next: { revalidate: 21600 } }
    );

    if (!res.ok) {
      console.error("ESPN Man City API error:", res.status);
      return [];
    }

    const data: ESPNScheduleResponse = await res.json();
    const feed = data?.columns?.[0]?.items?.[0]?.feed;
    if (!feed) return [];

    return feed
      .filter((entry) => entry.statusName === "STATUS_SCHEDULED")
      .map((entry) => {
        const gameDate = new Date(entry.date);
        const start = toCentralTime(gameDate);
        const endDate = new Date(gameDate.getTime() + 2 * 60 * 60 * 1000);
        const end = toCentralTime(endDate);
        const isHome = entry.homeAway === "h";

        return {
          id: `mc-${entry.id}`,
          team: "man-city" as const,
          opponent: entry.opponentLocation || entry.opponentName,
          date: gameDate.toISOString(),
          time: `${start.hours}:${start.mins}`,
          endTime: `${end.hours}:${end.mins}`,
          venue: isHome ? "Etihad Stadium" : entry.opponentLocation || "Away",
          isHome,
          competition: entry.leagueName || "Premier League",
        };
      });
  } catch (error) {
    console.error("Error fetching Man City schedule:", error);
    return [];
  }
}

async function fetchIllinoisBasketballSchedule(): Promise<SportsGame[]> {
  try {
    const res = await fetch(
      "https://cdn.espn.com/core/mens-college-basketball/team/_/id/356/schedule?xhr=1&render=false",
      { next: { revalidate: 21600 } }
    );

    if (!res.ok) {
      console.error("ESPN Illinois API error:", res.status);
      return [];
    }

    const data: ESPNScheduleResponse = await res.json();
    const feed = data?.columns?.[0]?.items?.[0]?.feed;
    if (!feed) return [];

    return feed
      .filter((entry) => entry.statusName === "STATUS_SCHEDULED")
      .map((entry) => {
        const gameDate = new Date(entry.date);
        const start = toCentralTime(gameDate);
        const endDate = new Date(gameDate.getTime() + 2.5 * 60 * 60 * 1000);
        const end = toCentralTime(endDate);
        const isHome = entry.homeAway === "h";

        return {
          id: `ill-${entry.id}`,
          team: "illinois-basketball" as const,
          opponent: entry.opponentLocation || entry.opponentName,
          date: gameDate.toISOString(),
          time: `${start.hours}:${start.mins}`,
          endTime: `${end.hours}:${end.mins}`,
          venue: isHome ? "State Farm Center" : "Away",
          isHome,
          competition: "Big Ten",
        };
      });
  } catch (error) {
    console.error("Error fetching Illinois schedule:", error);
    return [];
  }
}

export async function GET() {
  const [manCity, illinois] = await Promise.all([
    fetchManCitySchedule(),
    fetchIllinoisBasketballSchedule(),
  ]);

  return NextResponse.json([...manCity, ...illinois]);
}
