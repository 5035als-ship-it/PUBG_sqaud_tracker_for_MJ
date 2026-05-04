import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const API_KEY = process.env.PUBG_API_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const SHARD = "steam";
const CONFIG_FILE = path.resolve("config/tracked-players.json");
const DATA_FILE = path.resolve("docs/data/pubg-stats.json");
const BASE_URL = `https://api.pubg.com/shards/${SHARD}`;
const MAX_MATCHES_PER_PLAYER = 32;
const MAX_SEASONS_PER_PLAYER = 8;
const RATE_LIMITED_REQUEST_SPACING_MS = 6500;
let lastRateLimitedRequestAt = 0;

const PLAYER_DISPLAY_NAMES = new Map(
  [
    ["ClassMusic", "이성용"],
    ["Classmuisc", "이성용"],
    ["Machine_Jun", "김민준"],
    ["Machine_jun", "김민준"],
    ["MJPantyThief", "최낙범"],
    ["MJpantythief", "최낙범"],
    ["coca_cola_bear_", "이명준"],
  ].map(([id, name]) => [id.toLowerCase(), name]),
);

const PLAYER_DISPLAY_EMOJIS = new Map(
  [
    ["ClassMusic", "☕"],
    ["Classmuisc", "☕"],
    ["Machine_Jun", "✈️"],
    ["Machine_jun", "✈️"],
    ["MJPantyThief", "🥜"],
    ["MJpantythief", "🥜"],
    ["coca_cola_bear_", "🥤"],
  ].map(([id, emoji]) => [id.toLowerCase(), emoji]),
);

if (!API_KEY) {
  throw new Error("PUBG_API_KEY is required.");
}

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  Accept: "application/vnd.api+json",
};

async function waitForRateLimitWindow() {
  const now = Date.now();
  const elapsed = now - lastRateLimitedRequestAt;

  if (elapsed < RATE_LIMITED_REQUEST_SPACING_MS) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMITED_REQUEST_SPACING_MS - elapsed));
  }

  lastRateLimitedRequestAt = Date.now();
}

async function pubgFetch(url, options = {}) {
  if (options.rateLimited) {
    await waitForRateLimitWindow();
  }

  const { rateLimited, ...fetchOptions } = options;
  const response = await fetch(url, {
    ...fetchOptions,
    headers: { ...headers, ...(fetchOptions.headers ?? {}) },
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

function displayName(playerName) {
  return PLAYER_DISPLAY_NAMES.get(String(playerName).toLowerCase()) ?? playerName;
}

function displayEmoji(playerName) {
  return PLAYER_DISPLAY_EMOJIS.get(String(playerName).toLowerCase()) ?? "🎮";
}

function pickMapName(rawName) {
  const maps = {
    Baltic_Main: "에란겔",
    Desert_Main: "미라마",
    DihorOtok_Main: "비켄디",
    Erangel_Main: "에란겔",
    Heaven_Main: "헤이븐",
    Kiki_Main: "데스턴",
    Range_Main: "훈련장",
    Savage_Main: "사녹",
    Summerland_Main: "카라킨",
    Tiger_Main: "태이고",
    Neon_Main: "론도",
    Chimera_Main: "파라모",
  };

  return maps[rawName] ?? rawName ?? "알 수 없음";
}

function modeLabel(mode) {
  return {
    solo: "솔로 3인칭",
    "solo-fpp": "솔로 1인칭",
    duo: "듀오 3인칭",
    "duo-fpp": "듀오 1인칭",
    squad: "스쿼드 3인칭",
    "squad-fpp": "스쿼드 1인칭",
  }[mode] ?? mode ?? "알 수 없음";
}

function seasonLabel(seasonId) {
  if (seasonId === "lifetime") return "Lifetime";
  return seasonId.replace("division.bro.official.", "").replace("pc-", "PC ");
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
    displayName: displayName(player.name),
    displayEmoji: displayEmoji(player.name),
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

function summarizeModeStats(stats = {}) {
  const rounds = Number(stats.roundsPlayed ?? 0);
  const losses = Number(stats.losses ?? 0);
  const deaths = Math.max(1, rounds - Number(stats.wins ?? 0));
  const kills = Number(stats.kills ?? 0);
  const damage = Number(stats.damageDealt ?? 0);

  return {
    rounds,
    wins: Number(stats.wins ?? 0),
    top10s: Number(stats.top10s ?? 0),
    kills,
    assists: Number(stats.assists ?? 0),
    damage: Math.round(damage),
    avgDamage: rounds ? Math.round(damage / rounds) : 0,
    kd: Math.round((kills / deaths) * 100) / 100,
    winRate: rounds ? Math.round((Number(stats.wins ?? 0) / rounds) * 1000) / 10 : 0,
    top10Rate: rounds ? Math.round((Number(stats.top10s ?? 0) / rounds) * 1000) / 10 : 0,
    rankPoints: Math.round(Number(stats.rankPoints ?? stats.currentRankPoint ?? stats.bestRankPoint ?? 0)),
    tier: stats.currentTier?.tier ?? stats.bestTier?.tier ?? stats.tier ?? "",
    subTier: stats.currentTier?.subTier ?? stats.bestTier?.subTier ?? stats.subTier ?? "",
  };
}

function summarizeStatsResponse(response) {
  const attrs = response?.data?.attributes ?? {};
  const modeStats = attrs.rankedGameModeStats ?? attrs.gameModeStats ?? {};

  return Object.fromEntries(
    Object.entries(modeStats)
      .map(([mode, stats]) => [mode, summarizeModeStats(stats)])
      .filter(([, stats]) => stats.rounds > 0),
  );
}

async function safePubgFetch(url, fallback = null, options = {}) {
  try {
    return await pubgFetch(url, options);
  } catch (error) {
    console.warn(`Skipping optional PUBG request: ${error.message}`);
    return fallback;
  }
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

function buildGroupedMatches(players) {
  const matchMap = new Map();

  for (const player of players) {
    for (const match of player.matches) {
      const current = matchMap.get(match.id) ?? {
        id: match.id,
        createdAt: match.createdAt,
        gameMode: match.gameMode,
        gameModeLabel: match.gameModeLabel,
        mapName: match.mapName,
        duration: match.duration,
        participants: [],
      };

      current.participants.push({
        playerName: player.name,
        displayName: player.displayName,
        displayEmoji: player.displayEmoji,
        rank: match.rank,
        kills: match.kills,
        assists: match.assists,
        damage: match.damage,
        dbnos: match.dbnos,
        survivedMinutes: match.survivedMinutes,
      });

      matchMap.set(match.id, current);
    }
  }

  return [...matchMap.values()]
    .filter((match) => match.participants.length >= 2)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getSeasons() {
  const seasonsResponse = await safePubgFetch(`${BASE_URL}/seasons`, { data: [] }, { rateLimited: true });
  const seasons = seasonsResponse.data ?? [];
  const officialSeasons = seasons
    .filter((season) => season.id?.startsWith("division.bro.official.pc-"))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    current: officialSeasons.find((season) => season.attributes?.isCurrentSeason) ?? officialSeasons.at(-1) ?? null,
    recent: officialSeasons.slice(-MAX_SEASONS_PER_PLAYER).reverse(),
  };
}

async function getPlayerHistoricalStats(player, seasons) {
  const lifetimeResponse = await safePubgFetch(`${BASE_URL}/players/${player.id}/seasons/lifetime`, null, {
    rateLimited: true,
  });
  const rankedSeasonIds = seasons.recent.map((season) => season.id);
  const rankedSeasons = [];

  for (const seasonId of rankedSeasonIds) {
    const rankedResponse = await safePubgFetch(`${BASE_URL}/players/${player.id}/seasons/${seasonId}/ranked`, null, {
      rateLimited: true,
    });
    const modes = summarizeStatsResponse(rankedResponse);

    if (Object.keys(modes).length) {
      rankedSeasons.push({
        id: seasonId,
        label: seasonLabel(seasonId),
        isCurrentSeason: seasons.current?.id === seasonId,
        modes,
      });
    }
  }

  return {
    lifetime: summarizeStatsResponse(lifetimeResponse),
    rankedSeasons,
  };
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
      return `- ${match.displayName ?? match.playerName}: ${rank}, ${match.kills}킬, ${match.damage}딜, ${match.mapName} ${match.gameModeLabel}`;
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
  const playerResponse = await pubgFetch(playerUrl, { rateLimited: true });
  const players = playerResponse.data.map((player) => ({
    id: player.id,
    name: player.attributes.name,
    displayName: displayName(player.attributes.name),
    displayEmoji: displayEmoji(player.attributes.name),
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

  const seasons = await getSeasons();
  const enrichedPlayers = [];

  for (const player of players) {
    const matches = player.matchIds
      .map((matchId) => matchResponses.get(matchId))
      .filter(Boolean)
      .map((match) => summarizeMatch(match, player))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const history = await getPlayerHistoricalStats(player, seasons);

    enrichedPlayers.push({
      id: player.id,
      name: player.name,
      displayName: player.displayName,
      displayEmoji: player.displayEmoji,
      shardId: player.shardId,
      stats: aggregate(matches),
      matches,
      history,
    });
  }

  const data = {
    generatedAt: new Date().toISOString(),
    shard: SHARD,
    trackedPlayers: playerNames,
    limits: {
      recentMatchDays: 14,
      maxMatchesPerPlayer: MAX_MATCHES_PER_PLAYER,
      maxRankedSeasonsPerPlayer: MAX_SEASONS_PER_PLAYER,
    },
    seasons: {
      current: seasons.current
        ? {
            id: seasons.current.id,
            label: seasonLabel(seasons.current.id),
            isOffseason: Boolean(seasons.current.attributes?.isOffseason),
          }
        : null,
    },
    players: enrichedPlayers,
    highlights: buildHighlights(enrichedPlayers),
    groupedMatches: buildGroupedMatches(enrichedPlayers),
  };

  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await notifyDiscord(buildDiscordMessage(data, previous));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
