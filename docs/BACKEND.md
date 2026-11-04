# BALLER 백엔드

## 현재 연결

- Supabase 프로젝트: BALLER (`bogjkdfvghegnebetroh`, 서울)
- 서버: `http://127.0.0.1:3001`
- 프론트: Vite에서 `/api`를 서버 3001로 프록시
- 운영 모드: Supabase DB 우선 조회 / 외부 축구 API 수집 비활성화
- 이전 완료: 기존 브라우저 라이브러리 선수 5명, 시즌 기록 204개
- 이전 가능한 경기별 원본은 없었으므로 경기·경기별 스탯은 아직 비어 있음

## 실행

첫 터미널:

```sh
npm run server
```

둘째 터미널:

```sh
npm run dev
```

서버가 실행 중이면 중복 실행하지 않습니다. `GET /api/backend/health`에서 상태를 확인합니다.

## 환경 변수

`.env.local`은 Git에서 제외됩니다.

```dotenv
BALLER_DB_DRIVER=supabase
SUPABASE_URL=https://bogjkdfvghegnebetroh.supabase.co
SUPABASE_SECRET_KEY=서버에서만_사용하는_Secret_키
BALLER_BACKEND_URL=http://127.0.0.1:3001
BALLER_ALLOW_LIVE_API=false
BALLER_ALLOW_BROWSER_IMPORT=true
```

서버키에는 `sb_publishable_` 공개 키를 사용하지 않습니다. 서버키를 `VITE_` 변수에 넣지 않습니다.
키를 바꾸면 백엔드를 재시작합니다.

클라우드 없이 개발하려면 `BALLER_DB_DRIVER=local`로 설정합니다.
로컬 DB는 `.data/postgres/`에 저장되는 PostgreSQL(PGlite)입니다.
같은 디렉터리는 한 프로세스만 개방합니다. CLI로 로컬 DB를 관리할 때는 서버를 먼저 종료합니다.
클라우드 연결 실패 시 다른 DB나 외부 API로 자동 우회하지 않습니다.

## 구조

```text
React → /api → Node.js → Supabase PostgreSQL
                      ↳ 로컬 개발 모드: PGlite
외부 공급자 응답 → 변환 → 단일 트랜잭션 UPSERT → DB
```

- `server/db/schema.sql`: 두 DB 모드의 공통 PostgreSQL 스키마
- `server/db/normalize.mjs`: 공급자 응답을 테이블 행으로 변환
- `server/db/repository.mjs`: 로컬/Supabase 저장·조회 인터페이스
- `server/db/football-read.mjs`: 기존 프론트 API 형식으로 DB 데이터 변환
- `server/backend.mjs`: DB 조회 및 로컬 브라우저 기록 가져오기 API
- `server/index.mjs`: 독립 Node HTTP 서버
- `scripts/database.mjs`: 상태·기존 캐시·JSON 가져오기·원본 캐시 정리

## 테이블

| 테이블 | 용도 및 중복 기준 |
|---|---|
| baller_players | 선수, `(provider, external_id)` |
| baller_teams | 팀, `(provider, external_id)` |
| baller_matches | 경기, `(provider, external_id)` |
| baller_player_match_stats | 경기 상세, `(provider, player_id, match_id)` |
| baller_player_seasons | 선수·구단·리그·시즌·대회 유형별 누적 |
| baller_provider_responses | 원본 응답 캐시, `(scope, path)` |
| baller_ingest_runs | 수집 결과 기록 |

원본의 누락값과 0을 구분합니다. 다른 공급자의 같은 ID는 별도 데이터로 취급합니다.
일괄 저장은 `baller_ingest(jsonb)` RPC 한 번의 트랜잭션이며,
어느 행에서 오류가 나면 해당 호출 전체가 롤백됩니다.
DB 집계 결과만으로 존재하지 않는 경기별 데이터를 생성하지 않습니다.

모든 테이블은 RLS를 사용하고, 익명/일반 인증 사용자에게 직접 읽기·쓰기 권한을 주지 않습니다.
RPC도 서버 역할만 실행합니다. 프론트는 서버 API를 통해 조회합니다.

## API

- `GET /api/backend/health`: DB 모드와 저장 개수
- `GET /api/backend/players?q=&provider=highlightly&limit=20&offset=0`
- `GET /api/backend/players/:id`
- `GET /api/backend/players/:id/seasons`
- `GET /api/backend/players/:id/matches`
- `GET /api/backend/library`: 프론트 라이브러리 동기화
- `POST /api/backend/library`: 로컬 개발 화면에서 브라우저 선수·시즌 기록 저장
- `GET /api/football?...`: 기존 화면과 호환, 선수/시즌/프로필 DB 우선 조회

조회 한도는 최대 100개입니다. 브라우저 가져오기는 로컬 호스트의 동일 Origin,
루프백 접속, 명시적 설정을 모두 요구하고 2MB/100명으로 제한합니다.
공개 배포 시 해당 개발용 쓰기 기능을 비활성화하고 인증을 적용해야 합니다.

## 관리

```sh
npm run db:status
npm run db:import-cache
npm run db:import-json -- ./path/to/input.json
npm run db:prune-cache
```

JSON 가져오기 형식은 `{ "provider": "highlightly", "path": "/box-score/경기ID", "body": 원본응답 }`입니다.
`statsbomb` 등의 공급자는 ID 충돌을 피하는 구분자로 지원하며,
StatsBomb 이벤트 원본은 이 API 형식으로 변환하는 어댑터가 별도로 필요합니다.

`db:prune-cache`는 만료 후 30일이 지난 원본 응답만 삭제하고 선수·경기·통계 테이블은 유지합니다.
자동 외부 API 호출이나 Cron은 이번 작업에서 활성화하지 않았습니다.

## 검증

- PostgreSQL 저장·중복 갱신·외래키 및 전체 롤백 테스트
- 공급자 ID 분리, 캐시 스코프, 검색 파라미터, 브라우저 기록 가져오기 테스트
- Supabase 실제 RPC 저장 및 롤백 검증
- 익명/인증 역할의 RPC 실행 차단, 서버 역할 실행 허용, RLS 7개 테이블 확인
- Supabase 보안 advisors: 경고 없음
- 실제 서버의 health, 선수 시즌, 라이브러리 및 기존 호환 API 응답 200 확인
- 빌드된 클라이언트에 Supabase Secret/축구 API 키가 포함되지 않음을 확인
