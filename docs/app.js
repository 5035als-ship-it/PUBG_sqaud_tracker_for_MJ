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

function seasonText(season) {
  if (season === "Lifetime") return "라이프타임";
  return season.replace(" (current)", " (현재 시즌)").replace("PC ", "PC 시즌 ");
}

function allRecentMatches(data) {
  return data.players.flatMap((player) => player.matches.map((match) => ({ ...match, playerName: player.name })));
}

function renderSummary(data) {
  const { bestDamage, bestKills, latestWin } = data.highlights ?? {};
  const cards = [
    {
      label: "최고 딜량",
      value: bestDamage ? `${asNumber(bestDamage.damage)} dmg` : "-",
      sub: bestDamage ? `${bestDamage.playerName} / ${bestDamage.mapName}` : "기록 없음",
    },
    {
      label: "최다 킬",
      value: bestKills ? `${bestKills.kills} kills` : "-",
      sub: bestKills ? `${bestKills.playerName} / ${bestKills.gameModeLabel}` : "기록 없음",
    },
    {
      label: "최근 치킨",
      value: latestWin ? latestWin.playerName : "-",
      sub: latestWin ? `${latestWin.mapName} / ${dateFormat.format(new Date(latestWin.createdAt))}` : "아직 없음",
    },
    {
      label: "함께한 경기",
      value: asNumber(data.groupedMatches?.length ?? 0),
      sub: "등록 플레이어가 같은 매치에 잡힌 기록",
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
        <p class="sub">최근 ${player.stats.matches}경기 / 라이프타임 ${asNumber(lifetimeRounds)}경기</p>
        <div class="metrics">
          <div class="metric"><strong>${player.stats.avgDamage}</strong><span>최근 평균 딜량</span></div>
          <div class="metric"><strong>${player.stats.avgKills}</strong><span>최근 평균 킬</span></div>
          <div class="metric"><strong>${player.stats.top10Rate}%</strong><span>최근 TOP 10</span></div>
          <div class="metric"><strong>${asNumber(lifetimeKills)}</strong><span>라이프타임 킬</span></div>
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
    matchRows.innerHTML = `<tr><td class="empty" colspan="9">표시할 최근 경기가 없습니다.</td></tr>`;
    return;
  }

  matchRows.innerHTML = matches
    .map((match) => {
      const rank = match.rank ? `#${match.rank}` : "-";
      return `<tr>
        <td data-label="시간">${dateFormat.format(new Date(match.createdAt))}</td>
        <td data-label="플레이어">${match.playerName}</td>
        <td data-label="맵">${match.mapName}</td>
        <td data-label="모드">${match.gameModeLabel}</td>
        <td data-label="순위" class="${rankClass(match.rank)}">${rank}</td>
        <td data-label="킬">${match.kills}</td>
        <td data-label="딜량">${asNumber(match.damage)}</td>
        <td data-label="DBNO">${match.dbnos}</td>
        <td data-label="생존">${match.survivedMinutes}분</td>
      </tr>`;
    })
    .join("");
}

function renderGroupedMatches(data) {
  const groupedMatches = data.groupedMatches ?? [];

  if (!groupedMatches.length) {
    groupRows.innerHTML = `<tr><td class="empty" colspan="8">최근 API 조회 범위에서 함께 플레이한 경기가 없습니다.</td></tr>`;
    return;
  }

  groupRows.innerHTML = groupedMatches
    .map((match) => {
      const participants = match.participants
        .map((player) => `${player.playerName}: #${player.rank ?? "-"} / ${player.kills}킬 / ${asNumber(player.damage)}딜`)
        .join("<br>");
      const totalKills = match.participants.reduce((sum, player) => sum + player.kills, 0);
      const totalDamage = match.participants.reduce((sum, player) => sum + player.damage, 0);

      return `<tr>
        <td data-label="시간">${dateFormat.format(new Date(match.createdAt))}</td>
        <td data-label="맵">${match.mapName}</td>
        <td data-label="모드">${match.gameModeLabel}</td>
        <td data-label="인원">${match.participants.length}명</td>
        <td data-label="플레이어 기록">${participants}</td>
        <td data-label="합산 킬">${totalKills}</td>
        <td data-label="합산 딜량">${asNumber(totalDamage)}</td>
        <td data-label="경기 시간">${match.duration}분</td>
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
    seasonRows.innerHTML = `<tr><td class="empty" colspan="10">API에서 라이프타임 또는 경쟁전 시즌 기록을 반환하지 않았습니다.</td></tr>`;
    return;
  }

  seasonRows.innerHTML = rows
    .map((row) => {
      return `<tr>
        <td data-label="플레이어">${row.player}</td>
        <td data-label="시즌">${seasonText(row.season)}</td>
        <td data-label="모드">${row.mode}</td>
        <td data-label="경기 수">${asNumber(row.stats.rounds)}</td>
        <td data-label="승리">${asNumber(row.stats.wins)}</td>
        <td data-label="킬">${asNumber(row.stats.kills)}</td>
        <td data-label="평균 딜량">${asNumber(row.stats.avgDamage)}</td>
        <td data-label="K/D">${row.stats.kd}</td>
        <td data-label="승률">${row.stats.winRate}%</td>
        <td data-label="티어">${tierText(row.stats)}</td>
      </tr>`;
    })
    .join("");
}

function populateFilters(data) {
  const options = data.players.map((player) => `<option value="${player.name}">${player.name}</option>`).join("");
  playerFilter.innerHTML = `<option value="all">전체 플레이어</option>${options}`;
  historyFilter.innerHTML = `<option value="all">전체 플레이어</option>${options}`;
}

async function load() {
  try {
    const response = await fetch(dataUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("data file not found");
    const data = await response.json();
    const limits = data.limits ?? {};

    updatedAt.textContent = `마지막 갱신: ${dateFormat.format(new Date(data.generatedAt))} / ${data.shard} / 최근 경기 상세는 PUBG API 정책상 ${limits.recentMatchDays ?? 14}일까지만 조회됩니다`;
    populateFilters(data);
    renderSummary(data);
    renderPlayers(data);
    renderMatches(data);
    renderGroupedMatches(data);
    renderSeasonHistory(data);

    playerFilter.addEventListener("change", () => renderMatches(data));
    historyFilter.addEventListener("change", () => renderSeasonHistory(data));
  } catch (error) {
    updatedAt.textContent = "전적 데이터가 아직 생성되지 않았습니다.";
    summary.innerHTML = `<div class="error">GitHub Actions에 PUBG_API_KEY를 설정하고 워크플로를 한 번 실행하세요.</div>`;
    players.innerHTML = "";
    matchRows.innerHTML = `<tr><td class="empty" colspan="9">docs/data/pubg-stats.json 파일이 필요합니다.</td></tr>`;
    groupRows.innerHTML = `<tr><td class="empty" colspan="8">데이터 없음</td></tr>`;
    seasonRows.innerHTML = `<tr><td class="empty" colspan="10">데이터 없음</td></tr>`;
    console.error(error);
  }
}

load();
