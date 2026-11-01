(function(root){
 'use strict';
 const minutes=[5,10,15,20,25,30,40,50,60];
 function metres(code){if(!Number.isInteger(code)||code<0||code>255)throw Error('Nieprawidłowy kod odległości');return code===255?null:code<100?code*20:code<180?2000+(code-100)*100:10000+(code-180)*500;}
 function time(code){const d=metres(code);return d===null?null:d/5000*60;}
 function matches(code,mode,threshold){const t=time(code);return mode==='all'||t!==null&&(mode==='within'?t<=threshold:t>threshold);}
 const api={minutes,metres,time,matches};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BuildingDistanceModel=api;
})(typeof window!=='undefined'?window:globalThis);
