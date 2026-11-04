import {getApiPlayerDetails} from './football.ts';
import type {CompetitionStats} from './football.ts';
import {newestSeasonFirst} from '../utils/seasons.ts';
export type ComparisonDetail={name:string;stats:CompetitionStats[]};
export function validComparisonId(value:string){return value===''||/^[1-9]\d{0,11}$/.test(value);}
export function commonSeasons(left:ComparisonDetail|null,right:ComparisonDetail|null){
 return [...new Set((left??right)?.stats.map(row=>row.season)??[])].filter(season=>!left||!right||right.stats.some(row=>row.season===season)).sort(newestSeasonFirst);
}
export async function loadComparison(a:string,b:string,signal:AbortSignal,load=getApiPlayerDetails){
 if(!validComparisonId(a)||!validComparisonId(b))throw new Error('선수 주소가 올바르지 않습니다.');
 const pending=new Map<string,Promise<ComparisonDetail|null>>();
 const read=(id:string)=>{if(!id)return Promise.resolve(null);if(!pending.has(id))pending.set(id,load(Number(id),signal));return pending.get(id)!;};
 const [left,right]=await Promise.allSettled([read(a),read(b)]);
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 return {left:left.status==='fulfilled'?left.value:null,right:right.status==='fulfilled'?right.value:null,errors:[left,right].flatMap(result=>result.status==='rejected'?[result.reason instanceof Error?result.reason.message:'선수 조회 실패']:[])};
}
