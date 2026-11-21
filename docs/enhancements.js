(() => {
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 const items=[...document.querySelectorAll('main>section:not(.hero),.feature-list article,.install-grid li')];
 let observer,counterFrame=0,shownAmount=0;
 const output=document.getElementById('amountOutput');
 function animateAmount(target){
  cancelAnimationFrame(counterFrame);
  const start=shownAmount,at=performance.now();
  function paint(now){
   const progress=preference.matches?1:Math.min(1,(now-at)/650);
   shownAmount=start+(target-start)*(1-Math.pow(1-progress,3));
   output.textContent='Сохранили тебе '+Math.round(shownAmount).toLocaleString('ru-RU')+' ₽ :3';
   if(progress<1)counterFrame=requestAnimationFrame(paint);
  }
  counterFrame=requestAnimationFrame(paint);
 }
 const amounts=[...document.querySelectorAll('[data-amount]')];
 amounts.forEach(button=>button.onclick=()=>{
  amounts.forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
  animateAmount(Number(button.dataset.amount));
 });
 let counted=false;
 function enter(element){
  element.classList.add('is-visible');
  if(element.classList.contains('features'))element.classList.add('words-ready');
  if(element.classList.contains('statement')&&!counted){
   counted=true;amounts[1]?.setAttribute('aria-pressed','true');animateAmount(100);
  }
 }
 function setupMotion(){
  observer?.disconnect();
  document.documentElement.classList.toggle('motion-enabled',!preference.matches);
  document.querySelectorAll('.feature-list article,.install-grid li').forEach((element,index)=>{
   element.style.setProperty('--stagger',(index%4)*90+'ms');
  });
  if(preference.matches||!('IntersectionObserver' in window)){items.forEach(enter);return;}
  observer=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting){enter(entry.target);observer.unobserve(entry.target);}
  },{threshold:.08});
  items.forEach(element=>{element.classList.add('motion-item');observer.observe(element);});
 }
 preference.addEventListener('change',setupMotion);
 document.getElementById('wordToggle').addEventListener('change',event=>{
  document.querySelector('.features').classList.toggle('words-disabled',!event.target.checked);
 });
 const toggle=document.getElementById('applyMask');
 function updateToggle(){
  const mode=document.getElementById('maskMode').value;
  toggle.textContent=applied?'Убрать маску':mode==='blur'?'Применить размытие': 'Скрыть рекламу';
  toggle.setAttribute('aria-pressed',String(applied));
 }
 toggle.onclick=()=>{applied=!applied;applyDemo();updateToggle();};
 document.getElementById('maskMode').addEventListener('change',updateToggle);
 updateToggle();setupMotion();
})();