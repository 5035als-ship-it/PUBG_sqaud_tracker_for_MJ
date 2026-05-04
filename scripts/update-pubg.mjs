import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const API_KEY = process.env.PUBG_API_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const SHARD = "steam";
const CONFIG_FILE = path.resolve("config/tracked-players.json");
const DATA_FILE = path.resolve("docs/data/pubg-stats.json");
const BASE_URL = `https://api.pubg.com/shards/${SHARD}`;
const MAX_MATCHES_PER_PLAYER = 12;

if (!API_KEY) {
  throw new Error("PUBG_API_KEY is required.");
}

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  Accept: "application/vnd.api+json",
};

async function pubgFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`PUBG API ${response.status} for ${url}: ${detail.slice(0, 300)}`);
  }

  return response.json();
}

async function getPreviousData() {
  try {
    return JSON.parse(await readFile(DATA_FILE, "utf8"));
  } catch {
    return null;
  }
}

async function getTrackedPlayers() {
  const config = JSON.parse(await readFile(CONFIG_FILE, "utf8"));
  const names = Array.isArray(config.players) ? config.players : [];
  const cleaned = names.map((name) => String(name).trim()).filter(Boolean);

  if (!cleaned.length) {
    throw new Error("config/tracked-players.json must contain at least one player name.");
  }

  return [...new Set(cleaned)];
}

function minutes(seconds) {
  return Math.round((Number(seconds || 0) / 60) * 10) / 10;
}

function pickMapName(rawName) {
  const maps = {
    Baltic_Main: "Erangel",
    Desert_Main: "Miramar",
    DihorOtok_Main: "Vikendi",
    Erangel_Main: "Erangel",
    Heaven_Main: "Haven",
    Kiki_Main: "Deston",
    Range_Main: "Camp Jackal",
    Savage_Main: "Sanhok",
    Summerland_Main: "Karakin",
    Tiger_Main: "Taego",
    Neon_Main: "Rondo",
  };

  return maps[rawName] ?? rawName ?? "Unknown";
}

function modeLabel(mode) {
  return {
    solo: "Solo TPP",
    "solo-fpp": "Solo FPP",
    duo: "Duo TPP",
    "duo-fpp": "Duo FPP",
    squad: "Squad TPP",
    "squad-fpp": "Squad FPP",
  }[mode] ?? mode ?? "Unknown";
}

function getParticipantForAccount(match, accountId) {
  return (match.included ?? []).find((item) => {
    return item.type === "participant" && item.attributes?.stats?.playerId === accountId;
  });
}

function getRosterForParticipant(match, participantId) {
  return (match.included ?? []).find((item) => {
    if (item.type !== "roster") return false;
    return item.relationships?.participants?.data?.some((participant) => participant.id === participantId);
  });
}

function summarizeMatch(match, player) {
  const participant = getParticipantForAccount(match, player.id);
  const stats = participant?.attributes?.stats ?? {};
  const roster = participant ? getRosterForParticipant(match, participant.id) : null;
  const rosterStats = roster?.attributes?.stats ?? {};

  return {
    id: match.data.id,
    playerName: player.name,
    accountId: player.id,
    createdAt: match.data.attributes?.createdAt,
    gameMode: match.data.attributes?.gameMode,
    gameModeLabel: modeLabel(match.data.attributes?.gameMode),
    mapName: pickMapName(match.data.attributes?.mapName),
    duration: minutes(match.data.attributes?.duration),
    rank: rosterStats.rank ?? stats.winPlace ?? null,
    kills: Number(stats.kills ?? 0),
    assists: Number(stats.assists ?? 0),
    damage: Math.round(Number(stats.damageDealt ?? 0)),
    dbnos: Number(stats.DBNOs ?? 0),
    headshotKills: Number(stats.headshotKills ?? 0),
    longestKill: Math.round(Number(stats.longestKill ?? 0)),
    survivedMinutes: minutes(stats.timeSurvived),
  };
}

function aggregate(matches) {
  const count = matches.length || 1;
  const wins = matches.filter((match) => match.rank === 1).length;
  const top10 = matches.filter((match) => Number(match.rank) <= 10).length;
  const totals = matches.reduce(
    (acc, match) => {
      acc.kills += match.kills;
      acc.assists += match.assists;
      acc.damage += match.damage;
      acc.dbnos += match.dbnos;
      return acc;
    },
    { kills: 0, assists: 0, damage: 0, dbnos: 0 },
  );

  return {
    matches: matches.length,
    wins,
    top10,
    winRate: Math.round((wins / count) * 1000) / 10,
    top10Rate: Math.round((top10 / count) * 1000) / 10,
    avgKills: Math.round((totals.kills / count) * 10) / 10,
    avgDamage: Math.round(totals.damage / count),
    kd: Math.round((totals.kills / count) * 100) / 100,
    totals,
  };
}

function buildHighlights(players) {
  const allMatches = players.flatMap((player) => player.matches);
  const bestDamage = [...allMatches].sort((a, b) => b.damage - a.damage)[0] ?? null;
  const bestKills = [...allMatches].sort((a, b) => b.kills - a.kills)[0] ?? null;
  const latestWin = [...allMatches]
    .filter((match) => match.rank === 1)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] ?? null;

  return { bestDamage, bestKills, latestWin };
}

function buildDiscordMessage(data, previous) {
  const latestIds = new Set(previous?.players?.flatMap((player) => player.matches.map((match) => match.id)) ?? []);
  const freshMatches = data.players.flatMap((player) => {
    return player.matches.filter((match) => !latestIds.has(match.id)).map((match) => ({ ...match, playerName: player.name }));
  });

  if (!freshMatches.length) return null;

  const headline = freshMatches
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
    .map((match) => {
      const rank = match.rank ? `#${match.rank}` : "rank ?";
      return `- ${match.playerName}: ${rank}, ${match.kills}K, ${match.damage} dmg, ${match.mapName} ${match.gameModeLabel}`;
    })
    .join("\n");

  return {
    content: `PUBG squad tracker updated: ${freshMatches.length} new player-match records\n${headline}`,
  };
}

async function notifyDiscord(message) {
  if (!DISCORD_WEBHOOK_URL || !message) return;

  const response = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed with ${response.status}: ${await response.text()}`);
  }
}

async function main() {
  const playerNames = await getTrackedPlayers();
  const previous = await getPreviousData();
  const playerUrl = `${BASE_URL}/players?filter[playerNames]=${encodeURIComponent(playerNames.join(","))}`;
  const playerResponse = await pubgFetch(playerUrl);
  const players = playerResponse.data.map((player) => ({
    id: player.id,
    name: player.attributes.name,
    shardId: player.attributes.shardId,
    matchIds: (player.relationships?.matches?.data ?? []).slice(0, MAX_MATCHES_PER_PLAYER).map((match) => match.id),
  }));

  const matchIds = [...new Set(players.flatMap((player) => player.matchIds))];
  const matchResponses = new Map();

  for (const matchId of matchIds) {
    const match = await pubgFetch(`${BASE_URL}/matches/${matchId}`, {
      headers: { Accept: "application/vnd.api+json" },
    });
    matchResponses.set(matchId, match);
  }

  const enrichedPlayers = players.map((player) => {
    const matches = player.matchIds
      .map((matchId) => matchResponses.get(matchId))
      .filter(Boolean)
      .map((match) => summarizeMatch(match, player))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      id: player.id,
      name: player.name,
      shardId: player.shardId,
      stats: aggregate(matches),
      matches,
    };
  });

  const data = {
    generatedAt: new Date().toISOString(),
    shard: SHARD,
    trackedPlayers: playerNames,
    players: enrichedPlayers,
    highlights: buildHighlights(enrichedPlayers),
  };

  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await notifyDiscord(buildDiscordMessage(data, previous));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
