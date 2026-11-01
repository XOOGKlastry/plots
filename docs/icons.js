(function(){
 'use strict';
 window.Icons={svg(name,extra=''){if(!/^[a-z-]+$/.test(name))return '';return `<svg class="ic ph-icon ${extra}" viewBox="0 0 256 256" aria-hidden="true"><use href="icons/phosphor.svg#${name}"/></svg>`;}};
})();
