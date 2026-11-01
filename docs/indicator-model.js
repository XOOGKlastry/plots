(function(root){
  "use strict";
  // Descriptive sizes have an ordering, but no implied judgement of quality.
  const descriptive=new Set(['ludnosc','powierzchnia','gestosc_ludnosci','pit_suma','biblioteki_czytelnicy','zlobki_miejsca','przedszkola_dzieci','drogi_km','gaz_odbiorcy','gaz_ogrzewanie','mieszkanie_srednie_m2']);
  const lower=new Set(['bezrobocie_proc','zgony_1000','obciazenie_demograficzne','odpady_kg']);
  function rank(item,peers){
    if(!Number.isFinite(item.value)||!item.year)return {tone:'missing',label:'Brak porównywalnego rocznika',rank:null,n:0};
    const values=peers.filter(p=>p.year===item.year&&Number.isFinite(p.value)).map(p=>p.value);
    if(values.length<30)return {tone:'missing',label:'Za mało porównywalnych danych',rank:null,n:values.length};
    const direction=lower.has(item.key)?-1:1,better=values.filter(v=>(v-item.value)*direction>0).length,ties=Math.max(1,values.filter(v=>v===item.value).length),n=values.length;
    const tone=descriptive.has(item.key)?'neutral':(better+ties)/n<=.2?'good':better/n>=.8?'bad':'neutral';
    return {tone,label:descriptive.has(item.key)?'Wskaźnik opisowy':tone==='good'?'Najlepsze 20%':tone==='bad'?'Najsłabsze 20%':(better/n<.2||(better+ties)/n>.8)?'Remis na granicy':'Środkowe 60%',rank:better+1,n,direction};
  }
  function trend(item){
    const previous=item.history?.find(p=>p.year===item.year-1&&Number.isFinite(p.value));
    if(!Number.isFinite(item.value)||!previous)return {text:'Brak danych rok do roku',tone:'missing'};
    const delta=item.value-previous.value,sign=delta>0?'+':'';
    const unit=item.unit==='%'?'p.p.':item.unit;
    return {direction:delta>0?'up':delta<0?'down':'flat',text:`${sign}${delta.toLocaleString('pl-PL',{maximumFractionDigits:item.digits})} ${unit} r/r`,tone:'neutral',delta,year:previous.year};
  }
  const api={rank,trend,descriptive:[...descriptive],lower:[...lower]};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IndicatorModel=api;
})(typeof window!=='undefined'?window:globalThis);
