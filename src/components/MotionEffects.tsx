import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';

// Progressive enhancement: content stays visible if observation or animation is unavailable.
export default function MotionEffects(){
 const {pathname}=useLocation();
 useEffect(()=>{
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  let cleanup=()=>{};
  function start(){
   cleanup();
   if(preference.matches||!('IntersectionObserver' in window)||!Element.prototype.animate)return;
   const seen=new WeakSet<Element>();
   const animations=new Set<Animation>();
   const active=new WeakMap<Element,Animation>();
   const selector='.home-features > a, .player-grid > article, .players-content > .api-search, .library-results, .role-score-card, .role-battle-panel, .final-verdict, .detail-summary, .role-track > span, .bar-track > div';
   const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
     const element=entry.target as HTMLElement;
     const previous=active.get(element);
     if(previous){previous.cancel();animations.delete(previous);active.delete(element);}
     if(!entry.isIntersecting)continue;
     const bar=element.matches('.role-track > span, .bar-track > div');
     const index=element.parentElement?.matches('.player-grid,.home-features')?Array.from(element.parentElement.children).indexOf(element)%6:0;
     const animation=element.animate(bar?[
      {transform:'scaleX(0)',transformOrigin:'left'},
      {transform:'scaleX(1)',transformOrigin:'left'},
     ]:[{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:bar?1200:950,delay:index*100,easing:'cubic-bezier(.2,.75,.25,1)',fill:'backwards'});
     animations.add(animation);active.set(element,animation);animation.onfinish=()=>{animations.delete(animation);active.delete(element);};
    }
   },{threshold:0,rootMargin:'0px 0px -24px 0px'});
   function observe(){document.querySelectorAll(selector).forEach(element=>{if(!seen.has(element)){seen.add(element);observer.observe(element);}});}
   observe();
   const mutations=new MutationObserver(observe);
   mutations.observe(document.getElementById('root')!,{childList:true,subtree:true});
   cleanup=()=>{observer.disconnect();mutations.disconnect();animations.forEach(animation=>animation.cancel());};
  }
  start();preference.addEventListener('change',start);
  return ()=>{cleanup();preference.removeEventListener('change',start);};
 },[pathname]);
 return null;
}
