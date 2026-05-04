const dataUrl = "./data/pubg-stats.json";

const summary = document.querySelector("#summary");
const players = document.querySelector("#players");
const matchRows = document.querySelector("#matchRows");
const groupRows = document.querySelector("#groupRows");
const seasonRows = document.querySelector("#seasonRows");
const playerFilter = document.querySelector("#playerFilter");
const historyFilter = document.querySelector("#historyFilter");
const updatedAt = document.querySelector("#updatedAt");

const displayNames = new Map(
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

const displayEmojis = new Map(
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

const anyaIconPath = "./assets/anya-peace.png";

const mapNames = new Map(
  Object.entries({
    Erangel: "에란겔",
    Miramar: "미라마",
    Vikendi: "비켄디",
    Taego: "태이고",
    Rondo: "론도",
    Deston: "데스턴",
    Sanhok: "사녹",
    Karakin: "카라킨",
    Haven: "헤이븐",
    "Chimera_Main": "파라모",
    "Camp Jackal": "훈련장",
  }),
);

const modeNames = new Map(
  Object.entries({
    "Solo TPP": "솔로 3인칭",
    "Solo FPP": "솔로 1인칭",
    "Duo TPP": "듀오 3인칭",
    "Duo FPP": "듀오 1인칭",
    "Squad TPP": "스쿼드 3인칭",
    "Squad FPP": "스쿼드 1인칭",
    solo: "솔로 3인칭",
    "solo-fpp": "솔로 1인칭",
    duo: "듀오 3인칭",
    "duo-fpp": "듀오 1인칭",
    squad: "스쿼드 3인칭",
    "squad-fpp": "스쿼드 1인칭",
  }),
);

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

function playerName(player) {
  const raw = typeof player === "string" ? player : player.displayName ?? player.playerName ?? player.name;
  const lookup = typeof player === "string" ? player : player.playerName ?? player.name ?? raw;
  return displayNames.get(String(lookup).toLowerCase()) ?? raw;
}

function playerEmoji(player) {
  const lookup = typeof player === "string" ? player : player.playerName ?? player.name ?? "";
  return (typeof player === "object" && player.displayEmoji) || displayEmojis.get(String(lookup).toLowerCase()) || "🎮";
}

function usesAnyaIcon(player) {
  const lookup = typeof player === "string" ? player : player.playerName ?? player.name ?? "";
  return ["mjpantythief"].includes(String(lookup).toLowerCase());
}

function playerLabel(player) {
  if (usesAnyaIcon(player)) {
    return `<span class="playerBadge"><img class="miniAvatar" src="${anyaIconPath}" alt="" /> <span>${playerName(player)}</span></span>`;
  }

  return `<span class="playerBadge"><span class="emojiIcon">${playerEmoji(player)}</span> <span>${playerName(player)}</span></span>`;
}

function playerOptionLabel(player) {
  return `${usesAnyaIcon(player) ? "🌸" : playerEmoji(player)} ${playerName(player)}`;
}

function playerAvatar(player) {
  if (usesAnyaIcon(player)) {
    return `<img class="avatarImage" src="${anyaIconPath}" alt="" />`;
  }

  return playerEmoji(player);
}

function originalName(player) {
  return typeof player === "string" ? player : player.playerName ?? player.name ?? "";
}

function mapText(name) {
  return mapNames.get(name) ?? name ?? "-";
}

function modeText(mode, label) {
  return modeNames.get(label) ?? modeNames.get(mode) ?? label ?? mode ?? "-";
}

function rankClass(rank) {
  if (rank === 1) return "rankWin";
  if (Number(rank) <= 10) return "rankTop";
  return "";
}

function seasonText(season) {
  if (season === "Lifetime") return "라이프타임";
  return season.replace(" (current)", " (현재)").replace("PC ", "PC 시즌 ");
}

function tierText(stats) {
  return [stats.tier, stats.subTier].filter(Boolean).join(" ") || "-";
}

function allRecentMatches(data) {
  return data.players.flatMap((player) => {
    return player.matches.map((match) => ({
      ...match,
      playerName: player.name,
      displayName: player.displayName ?? playerName(player),
    }));
  });
}

function bestBy(players, getter) {
  return [...players].sort((a, b) => getter(b) - getter(a))[0] ?? null;
}

function favoriteMap(matches) {
  const counts = new Map();
  for (const match of matches) counts.set(mapText(match.mapName), (counts.get(mapText(match.mapName)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
}

function buildInsightCards(data) {
  const recentMatches = allRecentMatches(data);
  const bestDamageMatch = [...recentMatches].sort((a, b) => b.damage - a.damage)[0] ?? null;
  const bestKillsMatch = [...recentMatches].sort((a, b) => b.kills - a.kills)[0] ?? null;
  const ace = bestBy(data.players, (player) => player.stats.avgDamage);
  const finisher = bestBy(data.players, (player) => player.stats.avgKills);
  const survivor = bestBy(data.players, (player) => player.stats.top10Rate);
  const favorite = favoriteMap(recentMatches);
  const totalWins = data.players.reduce((sum, player) => sum + player.stats.wins, 0);
  const sharedCount = data.groupedMatches?.length ?? 0;

  return [
    {
      icon: "🏆",
      label: "최근 치킨",
      value: `${totalWins}회`,
      sub: "등록 멤버 합산",
    },
    {
      icon: "🔥",
      label: "한 판 최고 딜",
      value: bestDamageMatch ? `${asNumber(bestDamageMatch.damage)}딜` : "-",
      sub: bestDamageMatch ? `${playerLabel(bestDamageMatch)} / ${mapText(bestDamageMatch.mapName)}` : "기록 없음",
    },
    {
      icon: "🎯",
      label: "한 판 최다 킬",
      value: bestKillsMatch ? `${bestKillsMatch.kills}킬` : "-",
      sub: bestKillsMatch ? playerLabel(bestKillsMatch) : "기록 없음",
    },
    {
      icon: "⚡",
      label: "평딜 에이스",
      value: ace ? `${ace.stats.avgDamage}` : "-",
      sub: ace ? playerLabel(ace) : "기록 없음",
    },
    {
      icon: "🧨",
      label: "킬 템포",
      value: finisher ? `${finisher.stats.avgKills}` : "-",
      sub: finisher ? `${playerLabel(finisher)} 평균 킬` : "기록 없음",
    },
    {
      icon: "🛡️",
      label: "생존 감각",
      value: survivor ? `${survivor.stats.top10Rate}%` : "-",
      sub: survivor ? `${playerLabel(survivor)} TOP 10` : "기록 없음",
    },
    {
      icon: "🤝",
      label: "같이 잡힌 판",
      value: `${sharedCount}판`,
      sub: "2명 이상 같은 매치",
    },
    {
      icon: "🗺️",
      label: "주요 전장",
      value: favorite ? favorite[0] : "-",
      sub: favorite ? `${favorite[1]}회 등장` : "기록 없음",
    },
  ];
}

function renderSummary(data) {
  summary.innerHTML = buildInsightCards(data)
    .map((card) => {
      return `<article class="statCard">
        <div class="cardTop"><span class="cardIcon">${card.icon}</span><p class="label">${card.label}</p></div>
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
      const name = playerName(player);

      return `<article class="playerCard">
        <div class="playerHead">
          <div class="avatar">${playerAvatar(player)}</div>
          <div>
            <h3>${name}</h3>
            <p class="sub">${originalName(player)}</p>
          </div>
        </div>
        <div class="metrics">
          <div class="metric"><strong>${player.stats.avgDamage}</strong><span>평딜</span></div>
          <div class="metric"><strong>${player.stats.avgKills}</strong><span>평균 킬</span></div>
          <div class="metric"><strong>${player.stats.top10Rate}%</strong><span>TOP 10</span></div>
          <div class="metric"><strong>${asNumber(lifetimeKills)}</strong><span>누적 킬</span></div>
        </div>
        <p class="tinyNote">최근 ${player.stats.matches}경기 / 누적 ${asNumber(lifetimeRounds)}경기</p>
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
        <td data-label="플레이어"><strong>${playerLabel(match)}</strong></td>
        <td data-label="맵">${mapText(match.mapName)}</td>
        <td data-label="모드">${modeText(match.gameMode, match.gameModeLabel)}</td>
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
    groupRows.innerHTML = `<tr><td class="empty" colspan="8">최근 조회 범위에서 함께 플레이한 경기가 없습니다.</td></tr>`;
    return;
  }

  groupRows.innerHTML = groupedMatches
    .map((match) => {
      const participants = match.participants
        .map((participant) => `<span class="playerLine">${playerLabel(participant)} <b>#${participant.rank ?? "-"}</b> · ${participant.kills}킬 · ${asNumber(participant.damage)}딜</span>`)
        .join("");
      const totalKills = match.participants.reduce((sum, participant) => sum + participant.kills, 0);
      const totalDamage = match.participants.reduce((sum, participant) => sum + participant.damage, 0);

      return `<tr>
        <td data-label="시간">${dateFormat.format(new Date(match.createdAt))}</td>
        <td data-label="맵">${mapText(match.mapName)}</td>
        <td data-label="모드">${modeText(match.gameMode, match.gameModeLabel)}</td>
        <td data-label="인원">${match.participants.length}명</td>
        <td data-label="기록">${participants}</td>
        <td data-label="합산 킬">${totalKills}</td>
        <td data-label="합산 딜량">${asNumber(totalDamage)}</td>
        <td data-label="시간">${match.duration}분</td>
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
      rows.push({ player, season: "Lifetime", mode, stats });
    }

    for (const season of player.history?.rankedSeasons ?? []) {
      for (const [mode, stats] of Object.entries(season.modes ?? {})) {
        rows.push({
          player,
          season: `${season.label}${season.isCurrentSeason ? " (current)" : ""}`,
          mode,
          stats,
        });
      }
    }
  }

  if (!rows.length) {
    seasonRows.innerHTML = `<tr><td class="empty" colspan="10">라이프타임 또는 경쟁전 시즌 기록이 없습니다.</td></tr>`;
    return;
  }

  seasonRows.innerHTML = rows
    .map((row) => {
      return `<tr>
        <td data-label="플레이어"><strong>${playerLabel(row.player)}</strong></td>
        <td data-label="시즌">${seasonText(row.season)}</td>
        <td data-label="모드">${modeText(row.mode, row.mode)}</td>
        <td data-label="경기">${asNumber(row.stats.rounds)}</td>
        <td data-label="승리">${asNumber(row.stats.wins)}</td>
        <td data-label="킬">${asNumber(row.stats.kills)}</td>
        <td data-label="평딜">${asNumber(row.stats.avgDamage)}</td>
        <td data-label="K/D">${row.stats.kd}</td>
        <td data-label="승률">${row.stats.winRate}%</td>
        <td data-label="티어">${tierText(row.stats)}</td>
      </tr>`;
    })
    .join("");
}

function populateFilters(data) {
  const options = data.players.map((player) => `<option value="${player.name}">${playerOptionLabel(player)}</option>`).join("");
  playerFilter.innerHTML = `<option value="all">전체 플레이어</option>${options}`;
  historyFilter.innerHTML = `<option value="all">전체 플레이어</option>${options}`;
}

async function load() {
  try {
    const response = await fetch(dataUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("data file not found");
    const data = await response.json();
    const limits = data.limits ?? {};

    updatedAt.textContent = `마지막 갱신 ${dateFormat.format(new Date(data.generatedAt))} · 최근 상세 ${limits.recentMatchDays ?? 14}일`;
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
