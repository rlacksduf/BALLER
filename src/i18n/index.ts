import {useSyncExternalStore} from 'react';
import english from './en.json';
export type Language='ko'|'en';
const key='baller-language';
const listeners=new Set<()=>void>();
let language:Language='ko';
try { if(localStorage.getItem(key)==='en')language='en'; } catch { /* Storage can be unavailable. */ }
const dictionary:Record<string,string>=english;
export function getLanguage(){return language;}
function subscribe(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};}
export function useLanguage(){return useSyncExternalStore(subscribe,getLanguage);}
export function setLanguage(value:Language){
 language=value;
 try {localStorage.setItem(key,value);}catch { /* The current session still works. */ }
 document.documentElement.lang=value;
 listeners.forEach(listener=>listener());
}
export function t(korean:string, values:Record<string,string|number>={}){const text=language==='en'?(dictionary[korean]??translateGenerated(korean)):korean;return text.replace(/\{(\w+)\}/g,(match,key:string)=>String(values[key]??match));}
export function localized(korean:string,english:string){return language==='en'?english:korean;}
export function locale(){return language==='en'?'en-US':'ko-KR';}
window.addEventListener('storage',event=>{if(event.key===key)setLanguage(event.newValue==='en'?'en':'ko');});
document.documentElement.lang=language;

function translateGenerated(text:string):string {
 let match=text.match(/^수집한 (\d+)경기에서는 (.+) 역할의 기록이 관찰됩니다\./);
 if(match){const roles:Record<string,string>={'마무리':'finishing','기회 창출':'chance creation','수비 개입':'defensive contribution','골문 방어':'goalkeeping','균형적인 경기 참여':'balanced involvement'};return `Across ${match[1]} collected matches, the records suggest ${roles[match[2]!]??match[2]}. This is a rule-based summary, not a league percentile or overall player ranking.`;}
 match=text.match(/^(FW|MF|DF|GK) 기준으로 (.+) 지표가 가장 두드러집니다\((\d+)\/100\)\. (.+) 포지션별로/);
 if(match){const weak=match[4]!.match(/^(.+) 지표는 낮게/);return `${match[1]}: ${t(match[2]!)} is the strongest axis (${match[3]}/100). ${weak?`${t(weak[1]!)} scores lower; consider tactical and match context.`:'Review contributions across multiple roles.'} Role weights differ by position, so overall indices do not rank players across positions.`;}
 match=text.match(/^같은 (FW|MF|DF|GK) 역할의 지표를 비교합니다\./);
 if(match)return `Comparing the same ${match[1]} role. Tactical and league environments can still differ.`;
 return text;
}
