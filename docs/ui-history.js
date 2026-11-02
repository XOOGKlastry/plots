(function(){
  'use strict';
  // Keep transient panels in the same-document history, including Android Back.
  const entries=[];let serial=0,popping=false,pending=false,queued=[];
  const token=()=>history.state?.plotsSurfaceToken;
  function open(key,close,replace=false){
    if(pending){queued.push(()=>open(key,close,replace));return;}
    const top=entries.at(-1);if(top?.key===key&&!top.closed)return;
    const entry={key,close,id:'plots-'+Date.now()+'-'+(++serial),closed:false};
    const state={...history.state,plotsSurfaceToken:entry.id};
    try{if(replace&&top&&token()===top.id){entries.pop();history.replaceState(state,'');}else history.pushState(state,'');entries.push(entry);}catch(error){console.warn('Historia widoku:',error.message);}
  }
  function dismiss(key){
    if(popping)return;const top=entries.at(-1);if(!top||top.key!==key||top.closed)return;
    top.closed=true;
    if(token()===top.id){pending=true;history.back();}
  }
  window.addEventListener('popstate',()=>{
    popping=true;const target=token();
    while(entries.length&&entries.at(-1).id!==target){const entry=entries.pop();if(!entry.closed)entry.close();}
    popping=false;pending=false;const tasks=queued;queued=[];tasks.forEach(task=>task());
  });
  window.UIHistory={open,dismiss,current:()=>entries.at(-1)?.key||null};
})();
