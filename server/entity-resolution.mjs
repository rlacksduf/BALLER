// Resolve provider entities for every supported competition, without guessing an ID.
const clubAliases = new Map([
  ['bayernmunchen','bayernmunich'], ['parissg','parissaintgermain'], ['psg','parissaintgermain'],
  ['manutd','manchesterunited'], ['manunited','manchesterunited'],
  ['manchesterutd','manchesterunited'], ['intermilan','inter'], ['internazionale','inter'],
  ['athleticbilbao','athleticclub'], ['wolves','wolverhamptonwanderers'],
]);
export function normalizeEntityName(value) {
  const key = value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()
    .replace(/\b(football club|fc|cf|afc|as|ac|sc|fk|sk|sv|vfb|vfl)\b/g,'')
    .replace(/[^\p{L}\p{N}]/gu,'');
  return clubAliases.get(key) ?? key;
}
export function selectExactEntity(rows, name) {
  if (!Array.isArray(rows)) return null;
  const hits = unique(rows.filter(row => valid(row) && normalizeEntityName(row.name) === normalizeEntityName(name)));
  return hits.length === 1 ? hits[0] : null;
}
const valid = row => Number.isSafeInteger(row?.id) && row.id > 0 && typeof row.name === 'string';
const unique = rows => [...new Map(rows.map(row => [row.id,row])).values()];
const leagueKey = name => name.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()
  .replace(/\b(mc ?donald['’]?s|uber eats|enilive|ea sports|santander|sky bet|betclic|trendyol)\b/g,'')
  .replace(/[^\p{L}\p{N}]/gu,'');
const failure = (kind, message) => ({status:422,body:{code:kind,error:message}});
function invalidPage() { return {status:502,body:{error:'팀·대회 목록 응답이 올바르지 않습니다.'}}; }
async function pages(path, params, query) {
  const rows=[]; let offset=0; const seenPages=new Set();
  for(let page=0;page<100;page++) {
    const result=await query(`${path}?${new URLSearchParams({...params,limit:'100',offset:String(offset)})}`);
    if(result.status!==200)return {error:result};
    if(!Array.isArray(result.body?.data))return {error:invalidPage()};
    const data=result.body.data;
    const fingerprint=JSON.stringify(data);
    if(data.length && seenPages.has(fingerprint))return {error:invalidPage()};
    seenPages.add(fingerprint); rows.push(...data);
    const total=result.body.pagination?.totalCount;
    if(data.length===0 || (Number.isFinite(total)?offset+data.length>=total:data.length<100)) return {rows};
    offset+=data.length;
  }
  return {error:{status:502,body:{error:'목록이 너무 커서 식별자 확인을 완료하지 못했습니다. 조회 범위를 좁혀 주세요.'}}};
}
export async function matchesByIdentity(team, league, season, side, query) {
  const saudi=leagueKey(league)==='saudiproleague';
  const leagueName=saudi?'Pro League':league==='LaLiga'?'La Liga':league;
  const params=saudi?{countryCode:'SA',season}:{leagueName,season};
  let catalog=await pages('/leagues',params,query);
  if(catalog.error)return catalog.error;
  const matchesLeague=row=>valid(row)&&leagueKey(row.name)===leagueKey(leagueName)&&(!saudi||row.country?.code==='SA'||row.country?.name==='Saudi Arabia');
  let leagues=unique(catalog.rows.filter(matchesLeague));
  // Search filters may use different spelling than season statistics. A shared,
  // paginated season catalog supports unknown leagues without a hardcoded ID list.
  if(!leagues.length) {
    catalog=await pages('/leagues',{season,...(saudi?{countryCode:'SA'}:{})},query);
    if(catalog.error)return catalog.error;
    leagues=unique(catalog.rows.filter(matchesLeague));
  }
  if(!leagues.length)return failure('LEAGUE_NOT_FOUND',`${league} · ${season}: API에서 해당 대회·시즌을 찾지 못했습니다. 제공 범위와 이용 권한을 확인해 주세요.`);
  const cleaned=team.replace(/\b(FC|CF|AFC|AS|AC|SC|FK|SK|SV|VFB|VFL)\b/gi,'').replace(/\s+/g,' ').trim();
  let teams=await pages('/teams',{name:cleaned || team},query);
  if(teams.error)return teams.error;
  let resolvedTeam=selectExactEntity(teams.rows,team);
  if(leagues.length>1) {
    const hits=[];
    for (const candidate of leagues) {
      const fixtures=await pages('/matches',{leagueId:String(candidate.id),season},query);
      if(fixtures.error)return fixtures.error;
      const scoped=unique(fixtures.rows.flatMap(match=>[match.homeTeam,match.awayTeam]).filter(valid));
      const found=selectExactEntity(scoped,team);
      if(found) hits.push({league:candidate,team:found,fixtures:fixtures.rows});
    }
    if(hits.length!==1)return failure('LEAGUE_AMBIGUOUS',`${league}: 해당 팀과 대회를 한 개로 확인하지 못했습니다. 국가·시즌 또는 API 제공 범위를 확인해 주세요.`);
    const hit=hits[0];
    const data=hit.fixtures.filter(match=>match[side==='home'?'homeTeam':'awayTeam']?.id===hit.team.id);
    return {status:200,body:{data,pagination:{offset:0,limit:data.length,totalCount:data.length}}};
  }
  const resolvedLeague=leagues[0];
  if(resolvedTeam) return query(`/matches?${new URLSearchParams({[side==='home'?'homeTeamId':'awayTeamId']:String(resolvedTeam.id),leagueId:String(resolvedLeague.id),season,limit:'100',offset:'0'})}`);
  // Resolve within the league's own fixtures, rather than scanning or choosing
  // an unrelated team from the global catalog. National teams also work here.
  const fixtures=await pages('/matches',{leagueId:String(resolvedLeague.id),season},query);
  if(fixtures.error)return fixtures.error;
  const scopedTeams=unique(fixtures.rows.flatMap(match=>[match.homeTeam,match.awayTeam]).filter(valid));
  resolvedTeam=selectExactEntity(scopedTeams,team);
  if(!resolvedTeam) {
    const ambiguous=scopedTeams.filter(row=>normalizeEntityName(row.name)===normalizeEntityName(team)).length>1;
    return failure(ambiguous?'TEAM_AMBIGUOUS':'TEAM_NOT_FOUND',`${team} · ${league}: ${ambiguous?'동명 팀이 여러 개라 구분이 필요합니다.':'해당 시즌의 경기에서 팀을 확인하지 못했습니다. 팀 표기·API 제공 범위·이용 권한을 확인해 주세요.'}`);
  }
  const data=fixtures.rows.filter(match=>match[side==='home'?'homeTeam':'awayTeam']?.id===resolvedTeam.id);
  return {status:200,body:{data,pagination:{offset:0,limit:data.length,totalCount:data.length}}};
}
