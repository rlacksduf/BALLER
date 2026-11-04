import {useEffect,useRef,useState} from 'react';
import {locale} from '../i18n';
export default function AnimatedNumber({value}:{value:number|null|undefined}){
 const ref=useRef<HTMLSpanElement>(null);
 const [display,setDisplay]=useState(value);
 useEffect(()=>{
  const element=ref.current;if(!element)return;
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0;let observer:IntersectionObserver|undefined;
  setDisplay(value);
  function finish(){observer?.disconnect();cancelAnimationFrame(frame);setDisplay(value);}
  if(value!=null&&!preference.matches&&'IntersectionObserver' in window){
   const target=value;
   observer=new IntersectionObserver(entries=>{
    cancelAnimationFrame(frame);
    if(!entries.some(entry=>entry.isIntersecting)){setDisplay(target);return;}
    const started=performance.now();
    function tick(now:number){const progress=Math.min(1,(now-started)/1200);setDisplay(Math.round(target*(1-Math.pow(1-progress,3))));if(progress<1)frame=requestAnimationFrame(tick);}
    frame=requestAnimationFrame(tick);
   });observer.observe(element);
  }
  preference.addEventListener('change',finish);
  return ()=>{cancelAnimationFrame(frame);observer?.disconnect();preference.removeEventListener('change',finish);};
 },[value]);
 return <span ref={ref} aria-label={value?.toLocaleString(locale())??'—'}><span aria-hidden="true">{display?.toLocaleString(locale())??'—'}</span></span>;
}
