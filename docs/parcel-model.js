(function(root){
  "use strict";
  function positive(value){if(value===null||value===undefined||value==="")return null;const n=Number(value);return Number.isFinite(n)&&n>0?n:null;}
  function area(parcel){
    const geometry=positive(parcel.powierzchnia_geom_m2);
    if(geometry!==null)return {m2:geometry,ha:geometry/10000,source:"Z geometrii"};
    const cadastral=positive(parcel.pole_ewid);
    if(cadastral!==null)return {m2:cadastral*10000,ha:cadastral,source:"Ewidencyjna"};
    return {m2:null,ha:null,source:"Brak danych"};
  }
  function format(value,unit){return value===null?"Brak danych":value.toLocaleString("pl-PL",{maximumFractionDigits:unit==="ha"?4:2})+" "+unit;}
  const api={area,format};if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.ParcelModel=api;
})(typeof window!=="undefined"?window:globalThis);
