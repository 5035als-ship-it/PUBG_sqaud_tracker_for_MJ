const dataUrl = "./data/pubg-stats.json";
const summary = document.querySelector("#summary");
const players = document.querySelector("#players");
const matchRows = document.querySelector("#matchRows");
const playerFilter = document.querySelector("#playerFilter");
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

function renderSummary(data) {
  const { bestDamage, bestKills, latestWin } = data.highlights;
  const cards = [
    {
      label: "최고 딜량",
      value: bestDamage ? `${asNumber(bestDamage.damage)} dmg` : "-",
      sub: bestDamage ? `${bestDamage.playerName} · ${bestDamage.mapName}` : "기록 없음",
    },
    {
      label: "최다 킬",
      value: bestKills ? `${bestKills.kills} kills` : "-",
      sub: bestKills ? `${bestKills.playerName} · ${bestKills.gameModeLabel}` : "기록 없음",
    },
    {
      label: "최근 치킨",
      value: latestWin ? latestWin.playerName : "-",
      sub: latestWin ? `${latestWin.mapName} · ${dateFormat.format(new Date(latestWin.createdAt))}` : "아직 없음",
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
      return `<article class="playerCard">
        <h3>${player.name}</h3>
        <p class="sub">최근 ${player.stats.matches}경기 분석</p>
        <div class="metrics">
          <div class="metric"><strong>${player.stats.avgDamage}</strong><span>평균 딜량</span></div>
          <div class="metric"><strong>${player.stats.avgKills}</strong><span>평균 킬</span></div>
          <div class="metric"><strong>${player.stats.top10Rate}%</strong><span>TOP 10</span></div>
          <div class="metric"><strong>${player.stats.wins}</strong><span>치킨</span></div>
        </div>
      </article>`;
    })
    .join("");
}

function renderMatches(data) {
  const selected = playerFilter.value;
  const matches = data.players
    .flatMap((player) => player.matches.map((match) => ({ ...match, playerName: player.name })))
    .filter((match) => selected === "all" || match.playerName === selected)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!matches.length) {
    matchRows.innerHTML = `<tr><td class="empty" colspan="9">표시할 경기가 없습니다.</td></tr>`;
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
        <td>${match.survivedMinutes}분</td>
      </tr>`;
    })
    .join("");
}

function populateFilter(data) {
  playerFilter.innerHTML = `<option value="all">전체</option>${data.players
    .map((player) => `<option value="${player.name}">${player.name}</option>`)
    .join("")}`;
}

async function load() {
  try {
    const response = await fetch(dataUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("data file not found");
    const data = await response.json();

    updatedAt.textContent = `마지막 갱신: ${dateFormat.format(new Date(data.generatedAt))} · ${data.shard}`;
    populateFilter(data);
    renderSummary(data);
    renderPlayers(data);
    renderMatches(data);
    playerFilter.addEventListener("change", () => renderMatches(data));
  } catch (error) {
    updatedAt.textContent = "전적 데이터가 아직 생성되지 않았습니다.";
    summary.innerHTML = `<div class="error">GitHub Actions에서 PUBG_API_KEY를 설정하고 워크플로를 한 번 실행하세요.</div>`;
    players.innerHTML = "";
    matchRows.innerHTML = `<tr><td class="empty" colspan="9">docs/data/pubg-stats.json 파일이 필요합니다.</td></tr>`;
    console.error(error);
  }
}

load();

