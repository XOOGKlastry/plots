(function(){
  "use strict";
  const app=window.PLOTS,button=document.getElementById("installApp");let prompt=null;
  const standalone=()=>matchMedia("(display-mode:standalone)").matches||navigator.standalone===true;
  if(standalone())button.hidden=true;
  window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();prompt=event;button.hidden=false;});
  window.addEventListener("appinstalled",()=>{button.hidden=true;prompt=null;app.toast("Aplikacja jest zainstalowana");});
  button.onclick=async()=>{
    if(prompt){const event=prompt;prompt=null;await event.prompt();await event.userChoice;return;}
    let dialog=document.getElementById("installDialog");
    if(!dialog){dialog=document.createElement("dialog");dialog.id="installDialog";dialog.className="install-dialog";dialog.setAttribute("aria-labelledby","installTitle");dialog.innerHTML='<h2 id="installTitle">Mapa na Twoim telefonie</h2><p>Własna ikona, pełny ekran i zapisane profile gmin.</p><h3>iPhone i iPad</h3><p>Otwórz stronę w Safari. Wybierz <b>Udostępnij</b>, a następnie <b>Dodaj do ekranu początkowego</b>.</p><h3>Android</h3><p>Otwórz stronę w Chrome. W menu przeglądarki wybierz <b>Zainstaluj aplikację</b> lub <b>Dodaj do ekranu głównego</b>.</p><p class="muted small">Mapy i nowe dane wymagają internetu. Zapisane profile i dane referencyjne są dostępne również bez połączenia.</p><form method="dialog"><button class="primary">Gotowe</button></form>';document.body.append(dialog);}
    dialog.showModal();
  };
  window.addEventListener("offline",()=>app.toast("Tryb offline: dostępne są zapisane profile gmin. Mapa wymaga internetu.",6000));
  if(!navigator.onLine)app.toast("Tryb offline: dostępne są zapisane profile gmin. Mapa wymaga internetu.",6000);
  if("serviceWorker"in navigator){
    navigator.serviceWorker.register("sw.js").then(registration=>{
      const offerUpdate=()=>{if(!registration.waiting)return;let b=document.getElementById("updateApp");if(b)return;b=document.createElement("button");b.id="updateApp";b.textContent="Nowa wersja · odśwież aplikację";b.onclick=()=>registration.waiting.postMessage({type:"ACTIVATE_UPDATE"});document.body.append(b);};
      if(registration.waiting)offerUpdate();
      registration.addEventListener("updatefound",()=>{const worker=registration.installing;if(worker)worker.addEventListener("statechange",()=>{if(worker.state==="installed"&&navigator.serviceWorker.controller)offerUpdate();});});
    }).catch(error=>console.warn("Instalacja offline:",error.message));
    let changed=false;navigator.serviceWorker.addEventListener("controllerchange",()=>{if(changed)return;changed=true;if(document.getElementById("updateApp"))location.reload();});
  }
  if(new URLSearchParams(location.search).get("view")==="gminy")app.showGmina();
})();
