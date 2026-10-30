const routes=['overview','tickets','compose','escalations','activity'];
export function mountNavigation() {
  function show(focus=false){
    const requested=window.location.hash.slice(1),route=routes.includes(requested)?requested:'overview';
    for(const panel of document.querySelectorAll('[data-view]'))panel.hidden=panel.dataset.view!==route;
    for(const link of document.querySelectorAll('[data-route]')){
      if(link.dataset.route===route)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    }
    const title=document.getElementById(`${route}-title`);document.title=`tft | ${route==='compose'?'New ticket':route.charAt(0).toUpperCase()+route.slice(1)}`;
    if(focus)title.focus();
  }
  window.addEventListener('hashchange',()=>show(true));show();
  return {go(route){if(!routes.includes(route))return;if(window.location.hash===`#${route}`)show(true);else window.location.hash=route;}};
}
