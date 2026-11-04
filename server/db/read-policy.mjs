const day=86400000;
export const freshnessPolicy={profile:7*day,seasons:day,matches:Infinity};
export function freshness(kind,dates,now=Date.now()){
 const timestamps=dates.map(value=>Date.parse(value)).filter(Number.isFinite);
 const fetchedAt=timestamps.length?new Date(Math.min(...timestamps)).toISOString():null;
 return {fetchedAt,stale:!fetchedAt||now-Date.parse(fetchedAt)>=freshnessPolicy[kind],maxAgeSeconds:Number.isFinite(freshnessPolicy[kind])?freshnessPolicy[kind]/1000:null};
}
export function basicProfile(player,rows=[]){
 const stored=player.profile??{};
 const newest=[...rows].sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at))[0];
 return {...stored,citizenship:stored.citizenship??player.nationality??null,position:{...stored.position,main:stored.position?.main??player.position??null},club:{...stored.club,current:stored.club?.current??newest?.club??null}};
}
// A failed refresh never replaces a usable stored response.
export async function preferStored(stored,refresh,{allowed=false}={}){
 if(!stored.metadata?.stale||!allowed)return stored;
 try {const updated=await refresh();if(updated?.status===200)return updated;return {...stored,metadata:{...stored.metadata,refreshFailed:true},blockedUntil:updated?.blockedUntil};}
 catch{return {...stored,metadata:{...stored.metadata,refreshFailed:true}};}
}
