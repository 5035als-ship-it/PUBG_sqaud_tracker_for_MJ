const dataUrl = "./data/pubg-stats.json";

const summary = document.querySelector("#summary");
const players = document.querySelector("#players");
const matchRows = document.querySelector("#matchRows");
const groupRows = document.querySelector("#groupRows");
const seasonRows = document.querySelector("#seasonRows");
const playerFilter = document.querySelector("#playerFilter");
const historyFilter = document.querySelector("#historyFilter");
const updatedAt = document.querySelector("#updatedAt");

const numberFormat = new Intl.NumberFormat("ko-KR");
const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function asNumber(value) {
  return numberFormat.format(Number(value || 0));
}

function rankClass(rank) {
  if (rank === 1) return "rankWin";
  if (Number(rank) <= 10) return "rankTop";
  return "";
}

function tierText(stats) {
  return [stats.tier, stats.subTier].filter(Boolean).join(" ") || "-";
}

function allRecentMatches(data) {
  return data.players.flatMap((player) => player.matches.map((match) => ({ ...match, playerName: player.name })));
}

function renderSummary(data) {
  const { bestDamage, bestKills, latestWin } = data.highlights ?? {};
  const cards = [
    {
      label: "Best damage",
      value: bestDamage ? `${asNumber(bestDamage.damage)} dmg` : "-",
      sub: bestDamage ? `${bestDamage.playerName} / ${bestDamage.mapName}` : "No record yet",
    },
    {
      label: "Most kills",
      value: bestKills ? `${bestKills.kills} kills` : "-",
      sub: bestKills ? `${bestKills.playerName} / ${bestKills.gameModeLabel}` : "No record yet",
    },
    {
      label: "Latest chicken",
      value: latestWin ? latestWin.playerName : "-",
      sub: latestWin ? `${latestWin.mapName} / ${dateFormat.format(new Date(latestWin.createdAt))}` : "No win yet",
    },
    {
      label: "Shared matches",
      value: asNumber(data.groupedMatches?.length ?? 0),
      sub: "Tracked players in the same match",
    },
  ];

  summary.innerHTML = cards
    .map((card) => {
      return `<article class="statCard">
        <p class="label">${card.label}</p>
        <p class="value">${card.value}</p>
        <p class="sub">${card.sub}</p>
      </article>`;
    })
    .join("");
}

function renderPlayers(data) {
  players.innerHTML = data.players
    .map((player) => {
      const lifetimeModes = Object.values(player.history?.lifetime ?? {});
      const lifetimeRounds = lifetimeModes.reduce((sum, mode) => sum + mode.rounds, 0);
      const lifetimeKills = lifetimeModes.reduce((sum, mode) => sum + mode.kills, 0);
      return `<article class="playerCard">
        <h3>${player.name}</h3>
        <p class="sub">Recent ${player.stats.matches} matches / Lifetime ${asNumber(lifetimeRounds)} rounds</p>
        <div class="metrics">
          <div class="metric"><strong>${player.stats.avgDamage}</strong><span>recent avg dmg</span></div>
          <div class="metric"><strong>${player.stats.avgKills}</strong><span>recent avg kills</span></div>
          <div class="metric"><strong>${player.stats.top10Rate}%</strong><span>recent top 10</span></div>
          <div class="metric"><strong>${asNumber(lifetimeKills)}</strong><span>lifetime kills</span></div>
        </div>
      </article>`;
    })
    .join("");
}

function renderMatches(data) {
  const selected = playerFilter.value;
  const matches = allRecentMatches(data)
    .filter((match) => selected === "all" || match.playerName === selected)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!matches.length) {
    matchRows.innerHTML = `<tr><td class="empty" colspan="9">No recent matches to display.</td></tr>`;
    return;
  }

  matchRows.innerHTML = matches
    .map((match) => {
      const rank = match.rank ? `#${match.rank}` : "-";
      return `<tr>
        <td>${dateFormat.format(new Date(match.createdAt))}</td>
        <td>${match.playerName}</td>
        <td>${match.mapName}</td>
        <td>${match.gameModeLabel}</td>
        <td class="${rankClass(match.rank)}">${rank}</td>
        <td>${match.kills}</td>
        <td>${asNumber(match.damage)}</td>
        <td>${match.dbnos}</td>
        <td>${match.survivedMinutes}m</td>
      </tr>`;
    })
    .join("");
}

function renderGroupedMatches(data) {
  const groupedMatches = data.groupedMatches ?? [];

  if (!groupedMatches.length) {
    groupRows.innerHTML = `<tr><td class="empty" colspan="8">No shared matches found in the recent API window.</td></tr>`;
    return;
  }

  groupRows.innerHTML = groupedMatches
    .map((match) => {
      const participants = match.participants
        .map((player) => `${player.playerName}: #${player.rank ?? "-"} / ${player.kills}K / ${asNumber(player.damage)} dmg`)
        .join("<br>");
      const totalKills = match.participants.reduce((sum, player) => sum + player.kills, 0);
      const totalDamage = match.participants.reduce((sum, player) => sum + player.damage, 0);

      return `<tr>
        <td>${dateFormat.format(new Date(match.createdAt))}</td>
        <td>${match.mapName}</td>
        <td>${match.gameModeLabel}</td>
        <td>${match.participants.length}</td>
        <td>${participants}</td>
        <td>${totalKills}</td>
        <td>${asNumber(totalDamage)}</td>
        <td>${match.duration}m</td>
      </tr>`;
    })
    .join("");
}

function renderSeasonHistory(data) {
  const selected = historyFilter.value;
  const targetPlayers = data.players.filter((player) => selected === "all" || player.name === selected);
  const rows = [];

  for (const player of targetPlayers) {
    for (const [mode, stats] of Object.entries(player.history?.lifetime ?? {})) {
      rows.push({ player: player.name, season: "Lifetime", mode, stats });
    }

    for (const season of player.history?.rankedSeasons ?? []) {
      for (const [mode, stats] of Object.entries(season.modes ?? {})) {
        rows.push({
          player: player.name,
          season: `${season.label}${season.isCurrentSeason ? " (current)" : ""}`,
          mode,
          stats,
        });
      }
    }
  }

  if (!rows.length) {
    seasonRows.innerHTML = `<tr><td class="empty" colspan="10">No lifetime or ranked season stats returned by the API.</td></tr>`;
    return;
  }

  seasonRows.innerHTML = rows
    .map((row) => {
      return `<tr>
        <td>${row.player}</td>
        <td>${row.season}</td>
        <td>${row.mode}</td>
        <td>${asNumber(row.stats.rounds)}</td>
        <td>${asNumber(row.stats.wins)}</td>
        <td>${asNumber(row.stats.kills)}</td>
        <td>${asNumber(row.stats.avgDamage)}</td>
        <td>${row.stats.kd}</td>
        <td>${row.stats.winRate}%</td>
        <td>${tierText(row.stats)}</td>
      </tr>`;
    })
    .join("");
}

function populateFilters(data) {
  const options = data.players.map((player) => `<option value="${player.name}">${player.name}</option>`).join("");
  playerFilter.innerHTML = `<option value="all">All players</option>${options}`;
  historyFilter.innerHTML = `<option value="all">All players</option>${options}`;
}

async function load() {
  try {
    const response = await fetch(dataUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("data file not found");
    const data = await response.json();
    const limits = data.limits ?? {};

    updatedAt.textContent = `Updated ${dateFormat.format(new Date(data.generatedAt))} / ${data.shard} / recent matches are limited to ${limits.recentMatchDays ?? 14} days by PUBG API`;
    populateFilters(data);
    renderSummary(data);
    renderPlayers(data);
    renderMatches(data);
    renderGroupedMatches(data);
    renderSeasonHistory(data);

    playerFilter.addEventListener("change", () => renderMatches(data));
    historyFilter.addEventListener("change", () => renderSeasonHistory(data));
  } catch (error) {
    updatedAt.textContent = "Stats data has not been generated yet.";
    summary.innerHTML = `<div class="error">Set PUBG_API_KEY in GitHub Actions and run the workflow once.</div>`;
    players.innerHTML = "";
    matchRows.innerHTML = `<tr><td class="empty" colspan="9">docs/data/pubg-stats.json is required.</td></tr>`;
    groupRows.innerHTML = `<tr><td class="empty" colspan="8">No data.</td></tr>`;
    seasonRows.innerHTML = `<tr><td class="empty" colspan="10">No data.</td></tr>`;
    console.error(error);
  }
}

load();
