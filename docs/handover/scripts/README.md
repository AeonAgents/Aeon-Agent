# 시험 스크립트 (인수인계용)

작업 중 쓰던 시험 스크립트를 그대로 옮긴 것입니다. 저장소의 정식 도구가 **아닙니다**(그래서 `tools/`가 아니라 `docs/handover/`에 있음). 필요하면 정리해서 `tools/`로 승격하세요.

- 경로의 사용자명은 `<you>`, 원래 세션 작업 폴더는 `<SCRATCH>`로 바꿔 놓았습니다 → **쓰기 전에 자기 환경에 맞게 고치세요.**
- 비밀 정보는 들어 있지 않습니다. EXAONE 키는 항상 저장소 루트의 `.env`(git 무시)나 프로세스 환경변수 `EXAONE_API_KEY`에서 읽습니다. **키를 출력하거나 앱 입력칸에 타이핑하지 마세요.**
- `t10-fuzz.mjs`의 `sk-abcdef…`는 비밀 가림 기능을 시험하려는 **가짜 값**입니다.

## dirty/ — 실서버 더티 테스트
| 파일 | 용도 |
|---|---|
| `serve-real.ps1` | 실제 EXAONE 키(`.env`)로 시험용 에이전트 서버를 켬(설정 폴더 `cfg`, 작업 폴더 `ws`, 포트 7421). 이전에 만든 `cfg`가 있으면 짝지어진 기기가 유지됨 |
| `drv.mjs` | 서명 요청을 보내는 "짝지어진 기기". `node drv.mjs pair <코드>`로 한 번 짝짓고(`node drv.mjs call METHOD PATH [JSON]`으로 한 번 호출도 가능), 다른 스크립트가 `import { call }`로 사용. 키는 `device.json`에 저장(**커밋 금지**) |
| `t1`~`t19` | 시나리오: t1 입력, t2 모호한 지시, t3 정상, t4 실패, t5 모드, t6 승인(허락/거절/동시 두 번), t7 기타, t8 한도, t9 긴 입력, t10 퍼지, t11 모든 기능, t12 스킬, t13 피드, t14 재시작, t15 폴더에서 스킬 설치, t16·t16b·t17 파일 삭제 작업을 만들고 그 승인 대기를 처리하는 보조, t18 거절된 작업, t19 첫 제안 |
| `chaos.mjs`, `cfg-proxy.mjs` | 연결을 일부러 끊거나 늦추는 프록시 |
| `serve-fake.ps1`, `restart-*.ps1` | 일부러 틀린 키로 서버를 켜기/재시작 |
| `cdp-*.mjs`, `ff-shot.mjs` | Chrome/Edge/Firefox를 CDP로 띄워 웹 앱 스크린샷(배율 1.75 문제 확인용) |

## desktop/ — 데스크톱·안드로이드 앱 자동 조작
- `launch-iso.ps1 -Name x`: 포장된 `Aeon.exe`를 **격리 프로필**(`AEON_UI_DIR`, `APPDATA`, `user.home`을 임시 폴더로)로 띄우고, EXAONE 키를 그 프로세스 환경변수로만 줌.
- `winact.ps1 -Do click -X 600 -Y 1200` / `-Do shot -Out 파일.png` / `-Do type|key`: 창 기준 **물리 픽셀** 좌표. 창 크기에 따라 좌표가 다름(처음 실행 1180×760, 저장된 상태는 2065×1330 등).
- `winshot.ps1`: 창 스크린샷만.
- `atap.mjs`: 안드로이드 adb — `node atap.mjs list|tap "글자"|xy x,y|text "abc"|key 키코드|shot 이름`.

## exaone/ — API 직접 탐침
`probe-exaone.mjs`(기능 지원), `probe-busy.mjs`(바쁨 429), `latency.mjs`, `stream-probe.mjs`, `feed-replay.mjs`·`rev-trial*.mjs`·`writer-capture.mjs`(피드 글쓰기 재현·검토 규칙 시험), `slow.mjs`, `variants.mjs`, `probe-rt.mjs`. 실행: `node --env-file=.env docs/handover/scripts/exaone/<파일>.mjs`.
