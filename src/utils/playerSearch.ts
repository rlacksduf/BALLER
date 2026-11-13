// Korean aliases resolve to provider search names, never to hardcoded player IDs.
const aliases: [string[], string][] = [
  // Familiar Korean spellings for stars and legends, independent of their league.
  [["호나우지뉴", "호나우딩요", "호나우지뇨"], "Ronaldinho"],
  [["수아레즈", "수아레스", "루이스 수아레즈", "루이스 수아레스"], "Luis Suárez"],
  [["호나우두", "호나우두 나자리우", "호나우두 나자리오"], "Ronaldo"],
  [["지단", "지네딘 지단"], "Zinedine Zidane"],
  [["카카", "히카르두 카카"], "Kaká"],
  [["베컴", "데이비드 베컴"], "David Beckham"],
  [["앙리", "티에리 앙리"], "Thierry Henry"],
  [["제라드", "스티븐 제라드"], "Steven Gerrard"],
  [["램파드", "프랭크 램파드"], "Frank Lampard"],
  [["스콜스", "폴 스콜스"], "Paul Scholes"],
  [["루니", "웨인 루니"], "Wayne Rooney"],
  [["드로그바", "디디에 드로그바"], "Didier Drogba"],
  [["에투", "사무엘 에투"], "Samuel Eto'o"],
  [["사비", "차비", "사비 에르난데스", "차비 에르난데스"], "Xavi"],
  [["이니에스타", "안드레스 이니에스타"], "Andrés Iniesta"],
  [["푸욜", "카를레스 푸욜"], "Carles Puyol"],
  [["카시야스", "이케르 카시야스"], "Iker Casillas"],
  [["부폰", "잔루이지 부폰"], "Gianluigi Buffon"],
  [["말디니", "파올로 말디니"], "Paolo Maldini"],
  [["네스타", "알레산드로 네스타"], "Alessandro Nesta"],
  [["칸나바로", "파비오 칸나바로"], "Fabio Cannavaro"],
  [["피를로", "안드레아 피를로"], "Andrea Pirlo"],
  [["토티", "프란체스코 토티"], "Francesco Totti"],
  [["델피에로", "델 피에로", "알레산드로 델 피에로"], "Alessandro Del Piero"],
  [["바조", "로베르토 바조"], "Roberto Baggio"],
  [["세이도르프", "클라렌스 세이도르프"], "Clarence Seedorf"],
  [["비에이라", "파트리크 비에이라"], "Patrick Vieira"],
  [["로이 킨"], "Roy Keane"],
  [["칸토나", "에릭 칸토나"], "Eric Cantona"],
  [["베르캄프", "데니스 베르캄프"], "Dennis Bergkamp"],
  [["반바스텐", "반 바스텐", "마르코 반 바스텐"], "Marco van Basten"],
  [["굴리트", "루드 굴리트"], "Ruud Gullit"],
  [["레이카르트", "프랑크 레이카르트"], "Frank Rijkaard"],
  [["크루이프", "요한 크루이프"], "Johan Cruyff"],
  [["펠레"], "Pelé"],
  [["마라도나", "디에고 마라도나"], "Diego Maradona"],
  [["베켄바워", "프란츠 베켄바워"], "Franz Beckenbauer"],
  [["게르트 뮐러", "게르트뮐러"], "Gerd Müller"],
  [["푸스카스", "페렌츠 푸스카스"], "Ferenc Puskás"],
  [["조지 베스트"], "George Best"],
  [["조지 웨아"], "George Weah"],
  [["에우제비우", "에우제비오"], "Eusébio"],
  [["호베르투 카를루스", "로베르토 카를로스"], "Roberto Carlos"],
  [["카푸"], "Cafu"],
  [["마르셀루", "마르셀로"], "Marcelo"],
  [["베일", "가레스 베일"], "Gareth Bale"],
  [["아자르", "에덴 아자르"], "Eden Hazard"],
  [["외질", "메수트 외질", "메수트 오질"], "Mesut Özil"],
  [["발락", "미하엘 발락"], "Michael Ballack"],
  [["슈바인슈타이거", "바스티안 슈바인슈타이거"], "Bastian Schweinsteiger"],
  [["필립 람", "필리프 람"], "Philipp Lahm"],
  [["클로제", "미로슬라프 클로제"], "Miroslav Klose"],
  [["올리버 칸"], "Oliver Kahn"],
  [["체흐", "페트르 체흐"], "Petr Čech"],
  [["반데사르", "반 데 사르", "에드윈 반 데 사르"], "Edwin van der Sar"],
  [["피터 슈마이켈"], "Peter Schmeichel"],
  [["즐라탄", "이브라히모비치", "즐라탄 이브라히모비치"], "Zlatan Ibrahimović"],
  [["모드리치", "루카 모드리치"], "Luka Modrić"],
  [["크로스", "토니 크로스"], "Toni Kroos"],
  [["벤제마", "카림 벤제마"], "Karim Benzema"],
  [["사디오 마네"], "Sadio Mané"],
  [["피르미누", "피르미노", "호베르투 피르미누"], "Roberto Firmino"],
  [["마레즈", "리야드 마레즈"], "Riyad Mahrez"],
  [["캉테", "은골로 캉테"], "N'Golo Kanté"],
  [["카바니", "에딘손 카바니"], "Edinson Cavani"],
  [["디마리아", "디 마리아", "앙헬 디 마리아"], "Ángel Di María"],
  [["세르히오 라모스"], "Sergio Ramos"],
  [["부스케츠", "세르히오 부스케츠"], "Sergio Busquets"],
  [["조르디 알바", "호르디 알바"], "Jordi Alba"],
  [["라키티치", "이반 라키티치"], "Ivan Rakitić"],
  [["귄도안", "일카이 귄도안"], "İlkay Gündoğan"],
  [["차범근"], "Cha Bum-kun"],
  [["홍명보"], "Hong Myung-bo"],
  [["이영표"], "Lee Young-pyo"],
  [["안정환"], "Ahn Jung-hwan"],
  [["기성용"], "Ki Sung-yueng"],
  [["구자철"], "Koo Ja-cheol"],
  [["이동국"], "Lee Dong-gook"],
  [["나카타", "나카타 히데토시"], "Hidetoshi Nakata"],
  [["가가와 신지", "카가와 신지"], "Shinji Kagawa"],
  [["혼다 게이스케", "혼다 케이스케"], "Keisuke Honda"],
  [["나카무라 슌스케"], "Shunsuke Nakamura"],

  [["호마리우", "호마리오"], "Romário"],
  [["히바우두", "히바우도"], "Rivaldo"],
  [["반니스텔루이", "반 니스텔루이", "뤼트 판 니스텔로이"], "Ruud van Nistelrooy"],
  [["반페르시", "반 페르시", "로빈 반 페르시"], "Robin van Persie"],
  [["페르난도 토레스"], "Fernando Torres"],
  [["다비드 비야", "다비드 빌라"], "David Villa"],
  [["다비드 실바"], "David Silva"],
  [["베론", "후안 세바스티안 베론"], "Juan Sebastián Verón"],
  [["리켈메", "후안 로만 리켈메"], "Juan Román Riquelme"],
  [["포를란", "디에고 포를란"], "Diego Forlán"],
  [["마이클 오언", "마이클 오웬"], "Michael Owen"],
  [["앨런 시어러", "알란 시어러"], "Alan Shearer"],
  [["라울", "라울 곤살레스"], "Raúl"],
  [["히에로", "페르난도 이에로"], "Fernando Hierro"],
  [["존 테리"], "John Terry"],
  [["리오 퍼디난드"], "Rio Ferdinand"],
  [["비디치", "네마냐 비디치"], "Nemanja Vidić"],
  [["애슐리 콜", "애슐리콜"], "Ashley Cole"],
  [["야야 투레"], "Yaya Touré"],
  [["마켈렐레", "클로드 마켈렐레"], "Claude Makélélé"],
  [["에시앙", "마이클 에시앙"], "Michael Essien"],
  [["콤파니", "뱅상 콩파니", "빈센트 콤파니"], "Vincent Kompany"],
  [["손흥민", "손 흥민"], "Heung-Min Son"],
  [["이강인"], "Kang-In Lee"],
  [["김민재"], "Min-Jae Kim"],
  [["황희찬"], "Hee-Chan Hwang"],
  [["이재성"], "Jae-Sung Lee"],
  [["황인범"], "In-Beom Hwang"],
  [["박지성"], "Ji-Sung Park"],
  [["호날두", "크리스티아누 호날두"], "Cristiano Ronaldo"],
  [["메시", "리오넬 메시"], "Lionel Messi"],
  [["홀란", "홀란드", "엘링 홀란"], "Erling Haaland"],
  [["음바페", "킬리안 음바페"], "Kylian Mbappé"],
  [["라피냐", "하피냐"], "Raphael Dias Belloli"],
  [["니콜라스 잭슨", "니콜라 잭슨"], "Nicolas Jackson"],
  [["포든", "필 포든"], "Phil Foden"],
  [["살라", "살라흐", "모하메드 살라"], "Mohamed Salah"],
  [["케인", "해리 케인"], "Harry Kane"],
  [["벨링엄", "주드 벨링엄"], "Jude Bellingham"],
  [["비니시우스", "비니시우스 주니오르"], "Vinicius Junior"],
  [["더브라위너", "더 브라위너", "케빈 더브라위너"], "Kevin De Bruyne"],
  [["네이마르", "네이마르 주니오르"], "Neymar"],
  [["레반도프스키"], "Robert Lewandowski"],
  [["사카", "부카요 사카"], "Bukayo Saka"],
  [["페드리"], "Pedri"],
  [["로드리"], "Rodri"],
  [["반다이크", "반 다이크"], "Virgil van Dijk"],
];
const normalize = (value: string) => value.normalize("NFKD")
  .replace(/\p{M}/gu, "").toLowerCase().replace(/[\s\p{P}]/gu, "");
let indexedNames: { en: string; key: string }[] = [];
let loading: Promise<void> | undefined;
export function loadPlayerSearchIndex(): Promise<void> {
  if (!loading) loading = import("../data/player-names.ko.json", { with: { type: "json" } })
    .then(({ default: index }) => {
      indexedNames = index.players.map(player => ({ en: player.en, key: normalize(player.ko) }));
    }).catch(error => { loading = undefined; throw error; });
  return loading;
}
export function playerSearchCandidates(query: string): string[] {
  const trimmed = query.trim();
  const key = normalize(trimmed);
  if (!key) return [""];
  const manual = aliases.find(([names]) => names.some(name => normalize(name) === key));
  if (manual) return [manual[1]];
  if (!/[가-힣]/.test(trimmed)) return [trimmed];
  const exact = indexedNames.filter(player => player.key === key);
  const matches = exact.length ? exact : indexedNames.filter(player => player.key.includes(key));
  return [...new Set(matches.map(player => player.en))];
}
export function resolvePlayerSearch(query: string): string {
  const candidates = playerSearchCandidates(query);
  return candidates.length === 1 ? candidates[0]! : query.trim();
}
export function matchesPlayerSearch(name: string, query: string): boolean {
  if (normalize(name).includes(normalize(query))) return true;
  return playerSearchCandidates(query).some(candidate => normalize(name).includes(normalize(candidate)));
}
