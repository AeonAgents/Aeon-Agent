# Aeon Agent (한국어)

연속성(재시작·장애 후에도 작업 유지), 소유권(데이터·키·모델·실행환경은 사용자 소유), 검증 가능성(실제 결과로 완료를 확인), 접근성(클라우드 지식 없이 사용)을 목표로 하는 오픈소스 개인 AI 에이전트입니다.

> **현재 상태:** TypeScript 에이전트와 Windows·Android·웹 앱이 있습니다. Windows x64 앱은 로컬 에이전트를 포함하도록 만들 수 있습니다. 시험한 범위와 아직 확인하지 못한 플랫폼·설치 항목은 [테스트 기록](docs/TESTING.md)을 확인하세요. 여러 기기의 자원을 원격으로 사용하는 Fabric 기능은 아직 구현 중입니다.

## 지금 되는 것

- SQLite에 작업 상태 저장, lease + fencing token. 오래된 실행의 상태 변경을 거부합니다. 외부 서비스에 이미 반영된 작업은 장애 후 중복될 수 있습니다.
- 계획 → 실행 반복, 단계마다 체크포인트, 지수 백오프 재시도, 취소, 예약 시작(`--at`).
- 기본 거부 정책. 파일 쓰기는 작업 폴더 안으로 제한, 삭제·네트워크 쓰기·명령 실행은 사용자 승인 필요(승인은 24시간 후 만료, 화면에 보여준 그 동작에만 유효).
- 기본 명령 실행은 Docker 컨테이너에서 승인 후 수행합니다. 사용자가 승인한 스킬 스크립트는 컴퓨터에서 실행할 수도 있으며 격리 수준은 언어별로 다릅니다.
- 완료 여부는 실제 파일·HTTP 상태로 확인합니다. 결과는 `verified` / `failed` / `unverified` / `user_confirmed`로 구분됩니다.
- 모델: 공식 EXAONE API Platform의 K-EXAONE 2.5, Ollama, llama.cpp 서버, OpenAI 호환 API. 호출 제한에 걸리면 실패 처리하지 않고 대기합니다.
- API 키는 환경 변수 또는 플랫폼별 저장소에서 읽으며, 알려진 키와 비밀 형태는 로그·오류·저장 상태·프롬프트에서 가립니다.

## 설치와 테스트

Node.js 24 이상이 필요합니다. Docker는 `sandbox.exec`를 쓸 때만 필요합니다.

```bash
npm install
npm test
```

## EXAONE 사용

```bash
export EXAONE_API_KEY=...   # 저장소에 커밋하지 마세요. 약관상 키는 발급 30일 후 만료됩니다.
node src/node/cli.ts run "README.md를 요약해서 summary.txt로 저장" --providers exaone --consent exaone --check file_exists:summary.txt
```

`--consent exaone`은 프롬프트(에이전트가 읽은 파일 일부 포함)가 LG AI연구원 서비스로 전송되는 것을 허용한다는 뜻입니다. 이 옵션이 없으면 외부 제공업체를 호출하지 않습니다.

> **EXAONE 약관은 사용자에게 적용됩니다.** Aeon은 키 없이 EXAONE 클라이언트만 배포합니다(각자 키 사용). EXAONE API 약관은 비상업 이용만 허용하고, 키 공유와 제3자가 제품을 통해 모델을 호출하는 것을 금지하며, 오픈소스 BYOK 앱은 따로 다루지 않습니다(소유자 결정 D9: 그대로 공개). 사용 전에 [약관](https://docs.exaone.ai/ko/terms/terms-of-service)을 읽고 상업적으로 쓰지 마세요.

## Aeon Fabric

앱의 **기기 → 이 기기 자원 보기** 또는 `node src/node/cli.ts fabric inspect`에서 현재 기기의 자원 정보를 확인할 수 있습니다. 아직 다른 기기를 등록하거나 원격으로 실행하지는 않습니다. 전체 구상과 단계별 한계는 [설계 문서](docs/superpowers/specs/2026-11-15-aeon-fabric-design.md)를 참고하세요.

## 제거

앱은 운영체제의 앱 제거 기능으로 삭제합니다. 설정·키·기록은 사용자 설정 폴더나 시스템 비밀 저장소에 남을 수 있고, 작업 폴더에는 요청하여 만든 파일이 있을 수 있습니다. Windows 기본 설정 폴더는 `%APPDATA%\Aeon`, 내장 에이전트의 작업 폴더는 `문서\Aeon`입니다. 데이터를 지우기 전에 보관할 것을 백업하세요.

자세한 내용: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/TESTING.md](docs/TESTING.md), [docs/DECISIONS.md](docs/DECISIONS.md)
