# PUBG Squad Tracker

`config/tracked-players.json`에 등록된 Steam PUBG 플레이어 전적을 GitHub Actions로 갱신하고, GitHub Pages 사이트에서 보여주는 프로젝트입니다.

## 설정 방법

1. PUBG 공식 개발자 포털에서 API 키를 발급합니다.
2. GitHub 저장소에 아래 secret을 추가합니다.
   - `PUBG_API_KEY`
3. 디스코드 알림을 사용하려면 아래 secret도 추가합니다.
   - `DISCORD_WEBHOOK_URL`
4. GitHub Pages를 켭니다.
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/docs`
5. `Actions > Update PUBG stats > Run workflow`를 한 번 실행합니다.

워크플로는 매시간 `docs/data/pubg-stats.json`을 갱신하고 저장소에 자동 커밋합니다.

## 추적 플레이어 변경

`config/tracked-players.json` 파일을 수정하면 됩니다.

```json
{
  "players": [
    "ClassMusic",
    "MJpantythief",
    "Machine_Jun",
    "coca_cola_bear_"
  ]
}
```

GitHub에서 파일을 수정한 뒤 `Actions > Update PUBG stats > Run workflow`를 실행하거나, 매시간 자동 갱신을 기다리면 됩니다.

## 로컬 갱신

```powershell
$env:PUBG_API_KEY="your-api-key"
node scripts/update-pubg.mjs
```

그 다음 `docs/index.html`을 열면 됩니다.

## 데이터 범위

PUBG API 정책상 개별 매치 상세 기록은 최근 14일까지만 조회됩니다. 오래된 기록은 API가 제공하는 라이프타임 누적 전적과 경쟁전 시즌 요약을 사용합니다.
