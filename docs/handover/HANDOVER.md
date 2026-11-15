# 인수인계서 — Aeon Agent (2026-11-15)

다른 AI(또는 사람)가 **이 문서만 읽고 이어서 작업**할 수 있게 쓴 문서입니다. 먼저 §1~§3을 읽고, §8의 "첫 30분 체크리스트"부터 시작하세요.
모든 사실에는 근거가 있습니다: 결정은 `docs/DECISIONS.md`, 시험 증거는 `docs/TESTING.md`, 릴리스는 `docs/RELEASING.md`. 이 문서가 그것들과 다르면 그쪽이 맞습니다.

---

## 1. 프로젝트와 소유자의 목표

- **Aeon**: 연속성 중심의 개인 AI 에이전트. TypeScript 코어(`src/`), Kotlin/Compose Multiplatform 앱(`ui/`: Android, Windows·Linux 데스크톱, 웹).
- 저장소: **`AeonAgents/Aeon-Agent`** (공개, Apache-2.0). 소유자 = GitHub `spear34000`. 공동 관리자 = `sampple-korea` (조직 admin, 팀 `@AeonAgents/maintainers`).
- **소유자가 준 진행 중인 목표(/goal)의 요지** (Stop 훅이 매 턴 이 문장을 다시 보냅니다):
  1. 현재 서비스를 **비개발자도 설명 없이** 쉽게 쓰도록 전면 개선.
  2. API는 **EXAONE** 기준. 모든 기능이 실제로 연동되는지부터 확인하고, **실사용 환경에서 더티 테스트**(비정상 입력, 중복 조작, 네트워크 오류, API 실패, 앱 재실행 …).
  3. 버그는 직접 고치고 **재테스트**. 분석·보고로 끝내지 말고 *테스트 → 발견 → 수정 → 재검증*을 반복.
  4. 모든 UI/UX를 일반 사용자 눈으로 점검(혼란스러운 것, 전문 용어, 복잡한 설정 제거).
  5. 끝에 **수정 내역·테스트 결과·미해결 문제**를 정리. **검증하지 않은 것은 성공으로 적지 않기.**
  6. **"내 계정으로 PR 올려서 내가 받는 비효율" 금지, git 저장소는 제대로 관리.** → 일반 변경은 체크만 통과하면 **AI가 직접 병합**, 위험 파일만 다른 관리자 승인(§3).
- 소유자와는 **한국어**로 대화합니다.

## 2. 지금 어디까지 왔나 (2026-11-15 기준)

### 2.1 `main`에 들어간 것 (조직 이전 이후, PR #15~#48)
요약 (전체 목록은 `git log` / GitHub):
- **저장소 운영**: 조직 이전, 파일별 검토 규칙, 모든 Action 커밋 해시 고정 (#25, D34·D35). 릴리스 워크플로(#17, D30).
- **EXAONE 실사용 확인과 수정**: 한 번 답에 최대 290초 대기(#31), 피드 글쓰기 복사 검토·잘림 재시도(#32 #33), 바쁜 서비스(429) 처리(#19, D32).
- **사용성**: 쉬운 말로 바꾼 도입부·힌트·스캔 결과·승인 기록(#27 #43 #45), 데스크톱 사이드바·창 제목(#29), 데스크톱/웹 넓은 화면에서 안 열리던 피드·둘러보기·에이전트·스킬 화면(#34 #39), 설정 저장 순서 꼬임(#35).
- **거절된 작업의 상태 표시(#46)**: 마지막 동작이 거절되면 초록 "완료" 대신 주황 **"하지 못했어요"** (코어: `lastActionRefused`, `REFUSED_NOTE` in `src/core/workflow.ts`).
- 시험 기록 행들(#30 #36~#42 #44 #47 #48) → `docs/TESTING.md`.

### 2.2 열려 있는 PR
| PR | 내용 | 상태 | 다음 |
|---|---|---|---|
| **#49** `feat/desktop-own-agent` | **Windows 설치 파일이 에이전트를 품는다 (D36)**: 데스크톱 앱이 스스로 에이전트를 켠다 → Node.js·터미널 불필요. 아래 §2.3 | 필수 체크 3개 + 릴리스 드라이런(Android·Windows·Ubuntu·웹) **모두 초록**. 리뷰 0개. `BLOCKED` = 위험 파일(`.github/`, `ui/composeApp/build.gradle.kts`, `docs/DECISIONS.md`, CODEOWNERS)이라 **관리자 승인 필요** | **소유자의 결정 대기**: (a) 관리자 우회로 병합 (b) `sampple-korea` 승인 기다림. 소유자가 채팅에서 명시적으로 말하기 전엔 **병합 금지** |
| #28 `docs/review-rule-wording` | D34/CODEOWNERS 문구 정정 | `BEHIND`, 승인 대기 | #49 병합 후 `gh pr update-branch 28 --repo AeonAgents/Aeon-Agent`, `sampple-korea` 승인 |
| #23 (dependabot) | `actions/download-artifact` 4.3.0 → 8.0.2 | `BEHIND` | **릴리스 리허설 뒤에** 병합 (릴리스 워크플로가 쓰는 액션이라 먼저 실제로 돌려봐야 함) |
| #18 (`sampple-korea`) | 이슈 양식·트리아지 | 충돌(`DIRTY`) | 남의 브랜치에 **푸시 금지**. 댓글로 "브랜치를 main에 맞추고 액션을 커밋 해시로 고정(D35)" 요청 |

### 2.3 PR #49가 한 일 (D36)
- `tools/package-agent.mjs`: 컴파일된 에이전트 + Node.js 런타임을 한 폴더로. 런타임은 `tools/agent-runtime.json`에 **주소와 SHA-256으로 고정**(nodejs.org `v24.19.0 win-x64 node.exe`, 해시 불일치면 사용 거부). 테스트 `test/package-agent.test.ts`.
- `ui/composeApp/build.gradle.kts`: `-PbundleAgent`일 때만 `prepareAgent` 실행 후 Compose가 앱 옆(`app/resources/agent/…`)에 복사. `-PagentNode=경로`면 내려받지 않고 PC의 node 사용. `.github/workflows/release.yml`: Windows 항목이 `-PbundleAgent` 사용. `ci.yml`: Kotlin 잡이 먼저 `npm ci && npm run build:mobile`.
- `ui/composeApp/src/desktopMain/.../LocalAgent.desktop.kt`: 폰의 `LocalAgentHost` 인터페이스의 데스크톱 구현. 번들 런타임으로 에이전트를 `127.0.0.1:7421`(루프백 전용)에 켜고, **일회용 연결 코드는 파일로** 받아 스스로 연결, 앱이 끝나면 에이전트도 끝. 데이터는 `%APPDATA%\Aeon\agent`, 에이전트가 일하는 폴더는 `문서\Aeon`.
- 앱 쪽: `AppModel.offline()` — **에이전트가 사라지면(창 두 개 중 하나를 닫음, 충돌) 앱이 다시 켠다**(8초 간격, 원격 에이전트는 절대 안 켬). 설정 화면 문구("이 컴퓨터에서 바로 쓰기" / "다른 컴퓨터에 연결"), 환영 화면에 작업 폴더 위치 표시, 첫 제안 3개를 작업 폴더 기준으로 교체, AI 사용 허락 체크가 사용 중인 AI에선 즉시 저장.
- **실제로 해 본 것**(증거는 `docs/TESTING.md`의 "The desktop app with its own agent" 행): 포장된 `Aeon.exe` 첫 실행·종료·재실행, 실제 EXAONE 과제, 강제 종료 후 재접속, 창 두 개, **GitHub Windows 러너에서 node.exe 실제 다운로드+해시 검증+설치 파일 빌드(두 설치 파일 합쳐 211MB)**, 로컬에서 MSI 빌드(107MB)·`msiexec /a`로 풀어 그 안의 앱 실행.

## 3. 반드시 지킬 규칙 (소유자가 정한 것 + 시스템이 강제하는 것)

**저장소 / 병합**
- `main`은 보호됨(클래식): PR 필수, 필수 체크 3개 = `Core (TypeScript) (ubuntu-latest)`, `Core (TypeScript) (windows-latest)`, `Apps (Kotlin)`. 필요 승인 수 0 + **코드 소유자 검토 필수**. `CODEOWNERS`에 있는 파일(정책·가드·서버·스킬·메모리·`/.github/`·gradle·`package.json`·`tools/package-agent.mjs`·`tools/agent-runtime.json`·`DECISIONS.md`·`THREAT_MODEL.md`·`LICENSE`)만 `@AeonAgents/maintainers` 승인 필요. **그 외 PR은 체크 3개가 초록이면 AI가 직접 병합**(스쿼시, 브랜치 삭제).
- `require_last_push_approval`은 **꺼져 있어야** 합니다(켜면 승인 0개여도 모든 PR이 막힘, 실측).
- **관리자 우회 병합**(`enforce_admins` 꺼짐 → 가능)은 **소유자가 채팅에서 그 PR을 지목해 명시적으로 허락했을 때만**. 지금까지 #22, #25 두 번만 허락됨(PR마다 새로 받아야 함). 우회하면 PR 댓글에 그 사실을 적을 것.
- **자동 병합 켜기 금지.** 남의 브랜치·포크에 **푸시 금지**(댓글로).
- 병합 실패(502/"already in progress") 시: `gh api -X PUT repos/AeonAgents/Aeon-Agent/pulls/N/merge -f merge_method=squash`.
- 커밋 메시지 끝: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. PR 본문 끝: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- 태그 `v*`는 **관리자만** 만들 수 있음(ruleset). 환경 `release`는 두 관리자 중 한 명의 승인이 필요. **실제 릴리스 서명 키는 AI가 만들지 않음**(소유자가 직접 만들고 백업, `docs/RELEASING.md`).

**작업 방식**
- **크거나 애매한 결정은 먼저 묻고**(`[DECISION REQUIRED]` 형식 또는 질문 도구), 승인되면 `docs/DECISIONS.md`에 기록(D번호). 소유자가 정한 것은 다시 따지지 않기.
- **검증하지 않은 것은 성공으로 쓰지 않기.** 목(mock) 시험과 실서비스 확인을 구분. 시험한 것은 `docs/TESTING.md`에 *무엇을·어떻게·결과·안 해 본 것*을 적기.
- **비용 0**: 유료 API·VPS·도메인·SaaS 금지(소유자 승인 없이는).
- **보안/프라이버시**: 실제 키·비밀번호를 앱 입력칸에 **타이핑 금지**(시험은 프로세스 환경변수로만 — §5). `.env`는 출력 금지. 다운로드(파일 내려받기)는 소유자 허락 필요 → GitHub에서 스킬 설치 시험은 못 함. 소유자 개인정보(이름·이메일 등)를 외부 서비스·공개 저장소에 넣지 말 것(이 문서도 GitHub 로그인 이름만 씀).
- 코드 소유자 파일을 건드리는 PR은 **병합을 소유자의 말 또는 `sampple-korea`의 승인에 맡길 것**. 소유자는 "PR 올리고 내가 받는" 흐름을 싫어함 → **일을 묶어서 PR 수를 줄이고**, 체크 통과한 일반 PR은 바로 병합.

**Stop 훅(주의)**: 환경에 "목표가 충족됐나?"를 매 턴 되묻는 훅이 있습니다. 사람/다른 관리자의 결정을 기다리는 동안엔 **조건이 충족될 수 없어** 같은 문구가 계속 옵니다. 그때는 상태를 한두 문단으로 짧게 보고하고 질문 한 번만 하세요(불필요한 GitHub 재조회·반복 질문은 도움이 안 됩니다).

## 4. 개발 환경 (Windows 11, 소유자 PC)

- 셸: Git Bash(주) + PowerShell. Node **24.19.0**(`C:\Program Files\nodejs`), JDK 21, Gradle은 `ui/`의 래퍼.
- 코어: `npm ci`, `npm test`(**424개 중 422 통과·2 건너뜀**), `npx tsc --noEmit`, `npm run build:mobile`(→ `dist-mobile/`, 안드로이드·데스크톱 에이전트가 쓰는 빌드).
- 앱: `cd ui && ./gradlew :composeApp:desktopTest :composeApp:compileKotlinWasmJs --console=plain`(CI "Apps (Kotlin)"과 같음). 안드로이드: `./gradlew :androidApp:assembleDebug`(NDK 29.0.14206865, `node tools/fetch-nodejs-mobile.mjs` 필요). 웹: `:composeApp:wasmJsBrowserDistribution`.
- 에이전트 포함 데스크톱 앱 폴더: `./gradlew :composeApp:createDistributable -PbundleAgent "-PagentNode=C:/Program Files/nodejs/node.exe"` → `ui/composeApp/build/compose/binaries/main/app/Aeon/Aeon.exe`. MSI: `:composeApp:packageMsi` 같은 옵션.
- **안드로이드 에뮬레이터**: `C:\Android\emulator\emulator.exe -avd aeon-test -no-snapshot -no-audio -no-metrics -crash-report-mode never`, adb `C:\Android\platform-tools\adb.exe`, 에뮬레이터 → PC 서버는 `http://10.0.2.2:7421`. 설치는 `C:/Users/…` 형식 경로로.
- **EXAONE**: 키는 저장소 루트 `.env`(`EXAONE_API_KEY`, git 무시됨). `https://api.exaone.ai/v1`, 모델 `k-exaone_v2.5`.

## 5. 시험 도구 (`docs/handover/scripts/`)

세션 작업 폴더에 있던 시험 스크립트를 그대로(경로의 사용자명·세션 폴더만 `<you>`·`<SCRATCH>`로 바꿔) 옮겼습니다. 자세한 사용법은 `docs/handover/scripts/README.md`.
- `dirty/`: **실서버 더티 테스트** — `serve-real.ps1`(실제 EXAONE 키로 시험용 서버), `drv.mjs`(서명 요청을 보내는 "짝지어진 기기" 흉내), `t1`~`t19`(입력·승인·한도·장시간·피드·스킬·재시작·거절 시나리오), `chaos.mjs`(연결을 일부러 끊는 프록시).
- `desktop/`: **데스크톱 앱 자동 조작** — `winact.ps1`(창 기준 좌표 클릭/키/스크린샷), `winshot.ps1`, `launch-iso.ps1`(격리 실행), `atap.mjs`(안드로이드 adb 탭·스크린샷).
- `exaone/`: EXAONE 직접 탐침(기능 지원 여부, 지연, 바쁨 429, 스트리밍), 피드 글쓰기 재현.

**격리 실행 방법(중요)**: 실제 프로필을 건드리지 않으려면 앱을 이렇게 띄웁니다 — `AEON_UI_DIR`, `APPDATA`, `JAVA_TOOL_OPTIONS=-Duser.home=<임시>`를 그 프로세스에만 설정(`launch-iso.ps1`). 실제 EXAONE 키는 **그 프로세스의 환경변수 `EXAONE_API_KEY`로만** 줍니다(앱 입력칸에 치지 않음). 시험 후 프로세스·임시 폴더 정리.

**함정 모음 (실제로 겪은 것)**
- Git Bash의 `pkill`은 **Windows 프로세스를 못 죽입니다** → PowerShell `Stop-Process`. (남은 시험 서버가 7421 포트에 응답하고 있어서 앱이 그것을 "이미 켜진 에이전트"로 착각한 적 있음.)
- `cmd /c gradlew.bat` 실패 → Bash에서 `./gradlew`. `node -e '…'`에 한글 따옴표가 섞이면 깨짐 → `.cjs` 파일로 써서 실행.
- 테스트에서 `spawnSync`로 자식 프로세스를 기다리면 **같은 프로세스가 띄운 HTTP 서버가 멈춥니다**(교착). 비동기 `spawn` 사용.
- 테스트 파일들이 **같은 `dist-mobile`을 지우고 다시 빌드**하면 서로 깨집니다(실제로 CI가 한 번 깨짐). 새 도구는 자기 폴더에 빌드하세요(`build-mobile.mjs <폴더>`).
- Gradle `createDistributable`은 에이전트 폴더가 **새로 생긴 것**을 모르고 UP-TO-DATE로 건너뛸 수 있음 → `ui/composeApp/build/compose/binaries` 삭제 후 다시(깨끗한 체크아웃인 CI는 문제 없음).
- 앱 창 크기는 **처음 실행하면 1180×760**, 저장된 상태가 있으면 2065×1330 등 → `winact.ps1`의 좌표는 **창 크기마다 다름**(비율 약 0.571). 스크린샷은 한 프레임 늦게 찍힐 수 있으니 클릭 후 2~4초 기다린 뒤 확인. 아래 2065×1330 기준 좌표: 시작하기(1035,1233), 건너뛰기(1400,101), 전체 동의(663,405), 동의하고 계속(1033,1148), 어디서 실행 1번 카드(1033,425), 계속(1033,1240), 새 대화(88,174), 설정(88,693), 보내기(1978,1247), 창 닫기(2012,26).
- `Set-Clipboard`는 가끔 실패(재시도), 합성 클릭이 입력칸에 포커스를 못 주는 경우 있음.

## 6. EXAONE API에 대해 확인된 것 (실측, 소유자 키)
- 도구 호출(native tools)·`response_format`(json_object/json_schema)은 **문서에 없지만 실제로 동작**(코드는 여전히 "unknown"으로 취급). 스트리밍(SSE) 동작. `reasoning_effort`: low/medium/high/max 가능, `none`은 400.
- 잘못된 키 401, 없는 모델 404. **서비스가 자주 바쁨**: `429 service is busy`(약 60%, 동시 8개 전부 거절), 이때 초당 7~8토큰이라 긴 답이 185~301초 걸리고 **약 300초에서 서비스가 끊음**. → 코드: EXAONE 요청 제한 290초(`EXAONE_REQUEST_TIMEOUT_MS`), 작업 임대 하트비트(ttl/3).

## 7. 아직 남은 일 (우선순위 순)

1. **PR #49 병합 결정 받기** (소유자). 병합 뒤: 로컬 `main` 갱신·브랜치 삭제, `gh pr update-branch 28`.
2. **첫 릴리스(`v0.1.0`) — 비개발자가 설치 파일을 받을 수 있게 되는 단계.** 소유자 확인 후 관리자가 `git tag v0.1.0 && git push origin v0.1.0` → 워크플로가 테스트·빌드 → `release` 환경 승인 → **초안 릴리스** → 소유자가 읽고 Publish. 서명 키가 없으면 안드로이드는 debug-key APK만 나옴(설치는 되지만 업데이트 불가). 릴리스 뒤 **깨끗한 Windows(Node 없음)에서 MSI/EXE 실제 설치·실행·제거·덮어쓰기 설치**를 시험하고 `docs/TESTING.md`에 적을 것(아직 한 번도 안 함).
3. **PR #23** 은 위 릴리스 리허설(시험 태그, 끝나면 삭제) 후 병합. **PR #28**: 승인만 받으면 됨. **PR #18**: 댓글.
4. **안 해 본 시험(성공으로 치지 말 것)**: MSI/EXE **실제 설치**(시작 메뉴·제거·업그레이드), Linux `.deb`·Windows ARM64(에이전트가 안 들어 있음 → 설정에 "준비 중" 표시), SmartScreen(서명 안 됨), **실제 폰**, Safari(Mac 필요), **두 번째 GitHub 계정**으로 태그 거절 확인, 실서명 릴리스, GitHub 소스 스킬 설치(다운로드 허락 필요), 설치된 앱의 자동 갱신(없음).
5. **알려졌지만 고치지 않은 사용성 문제(후보)**
   - 사용자의 "질문 거절(건너뜀)" 뒤 AI가 일을 못 끝내고 끝나는 작업은 여전히 초록 "완료"(의도적: 질문 거절이 실패라는 보장이 없음, `docs/TESTING.md` 참고).
   - 끝난 작업에 이전 대기 상태의 `note`("waiting for your answer…")가 남음(화면엔 안 보임).
   - 에이전트는 `문서\Aeon` 안의 파일만 봄 → "다운로드 폴더 정리" 같은 일은 불가. **폴더를 고르는 방법이 없음** — 소유자 결정 필요(보안 가드와 직결).
   - "다른 컴퓨터에 연결"의 안내는 여전히 개발자용(Node 24 + git clone + 터미널).
   - 에이전트는 **앱이 열려 있을 때만** 동작 → 반복 작업(루틴)은 앱이 꺼져 있으면 멈춤(D36 한계에 적힘).
   - 안드로이드: 이번 세션의 `AppModel` 자동 재시작(에이전트가 사라지면 다시 켬)은 **공통 코드라 컴파일은 되지만 에뮬레이터에서 다시 시험하지 않음.** 안드로이드에서도 같은 동작을 하므로 확인 필요.
6. 보안 경고: Dependabot `ws` 8.20.1(높음, Ktor 3.6.1이 정확히 고정) — Ktor가 고칠 때까지 열어 둠.
7. 위험/주의: 설치 파일에 들어가는 Node 런타임을 올릴 땐 `tools/agent-runtime.json`의 **버전·주소·해시를 함께** 바꾸고(해시는 `https://nodejs.org/dist/v<버전>/SHASUMS256.txt`) `docs/RELEASING.md`를 확인.

## 8. 첫 30분 체크리스트 (이어받는 AI)

1. `git fetch && git status`, `gh pr list --repo AeonAgents/Aeon-Agent` → §2.2 표와 같은지 확인.
2. `docs/DECISIONS.md`의 D29~D36, `docs/TESTING.md`의 최근 행, `docs/RELEASING.md`, `docs/BRANCHING.md` 읽기.
3. 소유자에게 **PR #49 병합 방법**을 한 번만 물어보기(아직 답이 없음). 답 전에는 병합·태그 금지.
4. 실행 중인 시험 프로세스가 없는지 확인(PowerShell: `Get-Process Aeon`, `Get-CimInstance Win32_Process -Filter "Name='node.exe'"`, 7421 포트).
5. 새 작업을 시작하면: 브랜치 → 수정 → 테스트(`npm test`, `tsc`, `desktopTest`) → **실제로 띄워 확인** → `docs/TESTING.md`에 행 추가 → PR(일반 파일이면 체크 통과 후 직접 병합) 순서를 지킬 것.

## 9. 코드 지도 (최근 작업 위주)

- `src/core/`: 워크플로(`workflow.ts`), 에이전트(`agent.ts`), 모델(`models/`), 정책·검증. `src/node/`: 서버(`serve.ts`, `server/`), 피드(`feed-*.ts`), 스킬(`skill-*.ts`), 기기용 진입점(`mobile-main.ts`).
- `ui/composeApp/src/commonMain/kotlin/dev/aeon/ui/`: `state/AppModel.kt`(상태·폴링·`offline()`), `screens/`(`Where.kt`, `Thread.kt`, `Setup.kt`, `Skills.kt`, `Layouts.kt` …), `platform/LocalAgent.kt`(인터페이스). 플랫폼: `desktopMain`(`LocalAgent.desktop.kt`), `androidMain`(`LocalAgent.android.kt`), `wasmJsMain`.
- `ui/composeApp/src/desktopTest/`: `DesktopLocalAgentTest`, `SetupFlowTest`, `CopyTest`, `ServerIntegrationTest`(진짜 Node 서버를 띄움) 등.
- `tools/`: `build-mobile.mjs`, `package-agent.mjs`, `agent-runtime.json`, `fetch-nodejs-mobile.mjs`. `test/`: Node 테스트.
