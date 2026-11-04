# BALLER

React + TypeScript로 만든 축구 선수 검색·분석·비교 포트폴리오입니다.
일반 CSS, React Router, Recharts와 Highlightly API를 사용하며 분석 문장은 TypeScript 규칙으로 생성합니다.

## 실행

```sh
npm install
```

`.env.example`을 `.env.local`로 복사한 뒤 로컬에서 `HIGHLIGHTLY_API_KEY`를 설정합니다.
키는 서버에서만 사용하며 `VITE_` 접두사나 Git 커밋에 포함하지 않습니다.

```sh
npm run dev
```

터미널에 표시되는 로컬 URL을 엽니다. 기존 서버가 있으면 포트가 바뀔 수 있습니다.
Vite preview에는 API 미들웨어가 없으므로 실제 API 개발에는 `npm run dev`를 사용합니다.

## 주요 기능

- 홈 검색, 저장된 실제 선수의 시즌 대시보드·득점/도움 순위
- 영문 API 검색, 페이지 이동, 실제 선수 라이브러리 필터·정렬
- 실제 프로필, 시즌·대회 기록, 경기별 상세 스탯, 시즌 합산과 단위 전환
- 선수 두 명 선택·교체·초기화·선택 유지 및 URL 공유
- 일반·포지션·종합 비교, Recharts 레이더 및 양방향 그래프
- 역할 가중 점수와 강점·약점·전술적 결론, 확보한 표본 내 백분위
- API 오류·빈 결과·누락값·작은 표본·부분 수집·취소 처리

랭킹과 백분위는 저장된 선수 표본 기준입니다. 데이터 범위와 단계별 구현 상태는
[기능 현황](docs/FEATURE_STATUS.md)을 참고하세요.

## 검사

```sh
npm run build
npm run lint
npm test
```

테스트 실행에는 TypeScript 타입 제거를 지원하는 Node.js 버전이 필요합니다.

## 소스 구조

- `src/pages`: 홈, 선수 검색·상세·비교
- `src/components`: 프로필, 선택 바, 스탯·차트, 보고서
- `src/services`: API 변환, 경기 수집, 브라우저 저장
- `src/utils`: 검색·시즌 정렬, 집계·분석·역할 점수·백분위
- `server/highlightly.mjs`: 서버 전용 API 호출·검증·15분 메모리 캐시
- `api/football.mjs`: 향후 Vercel에서 사용할 API 핸들러
- `tests`: 네트워크 의존 없는 검증

## 데이터 문서

- https://highlightly.net/football-api/documentation/players/
- https://highlightly.net/football-api/documentation/players/by-id/
- https://highlightly.net/football-api/documentation/players/statistics/
- https://highlightly.net/football-api/documentation/matches/
- https://highlightly.net/football-api/documentation/box-score/

시즌 상세 수집은 경기당 API 호출이 발생합니다. 응답은 브라우저 및 로컬 서버 파일 캐시에 저장됩니다. 서버 재시작 후에도 파일 캐시와 한도 차단 상태가 유지됩니다.
무료 플랜의 접근 범위와 요청 한도, 실제 경기 데이터 누락 여부는 제공업체 상태에 따릅니다.
이번 작업에는 공개 배포를 포함하지 않습니다.

한도가 소진되면 새 외부 호출을 차단하고 확보한 저장 기록을 표시합니다. 제공업체 한도가 회복된 것을 확인한 뒤 화면의 연결 재개 버튼으로 앱 차단을 해제할 수 있습니다. 이 버튼이 제공업체 한도를 초기화하지는 않습니다.

## 백엔드 / Supabase

[백엔드 실행·DB 구조·API·검증 안내](docs/BACKEND.md)를 참고하세요.
현재는 Supabase 클라우드를 연결한 독립 Node 서버를 사용합니다.
`npm run server`와 `npm run dev`를 각각 실행하며 외부 축구 API 수집은 비활성화되어 있습니다.
