const ad=document.getElementById('ad'),mask=document.getElementById('mask');ad.onclick=()=>{ad.hidden=true;mask.hidden=false;document.getElementById('demoStatus').textContent='Логотип закрыт. Стрим продолжается.'};document.getElementById('reset').onclick=()=>{ad.hidden=false;mask.hidden=true;document.getElementById('demoStatus').textContent='Нажми на рекламу в примере'};document.getElementById('wordToggle').onchange=e=>{document.querySelectorAll('.replace-line strong').forEach(x=>x.hidden=!e.target.checked);document.querySelectorAll('.replace-line s').forEach(x=>x.style.textDecoration=e.target.checked?'line-through':'none')};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function acknowledge(node){
 if(!reduced)node.animate([{opacity:.4,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'ease-out'});
}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{
 document.querySelectorAll('[data-view]').forEach(tab=>{
  const active=tab===button;tab.setAttribute('aria-pressed',String(active));
  const view=document.getElementById(tab.dataset.view+'View');view.hidden=!active;
  if(active)acknowledge(view);
 });
});
const sponsor=document.getElementById('sampleSponsor');
let applied=false;
function applyDemo(){
 const mode=document.getElementById('maskMode').value;
 sponsor.className=applied?'masked-'+mode:'';
 sponsor.style.setProperty('--power',document.getElementById('blurPower').value+'px');
 sponsor.textContent='';
 acknowledge(sponsor);
}


document.getElementById('maskMode').onchange=()=>{if(applied)applyDemo();};
document.getElementById('blurPower').oninput=()=>{if(applied)applyDemo();};

const wordInput=document.getElementById('wordInput');
wordInput.oninput=()=>{document.getElementById('wordResult').textContent=wordInput.value.replace(/лига ставок/gi,'Лига остатков').replace(/upgrader/gi,'Даунгрейдер кошелька').replace(/winline/gi,'svinline');};
wordInput.oninput();


const channelState={one:{enabled:false},two:{enabled:false}};
let activeChannel='one';
function renderChannel(){
 const enabled=channelState[activeChannel].enabled;
 document.getElementById('profileEnabled').checked=enabled;
 document.getElementById('profileName').textContent=activeChannel==='one'?'bu5terenko':'sasich';
 document.querySelectorAll('[data-channel]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.channel===activeChannel)));
 const cover=document.getElementById('profileCover'),ad=document.getElementById('profileAd');
 cover.classList.toggle('right',activeChannel==='two');ad.classList.toggle('right',activeChannel==='two');
 cover.hidden=!enabled;ad.hidden=enabled;
 document.getElementById('profileFeedback').textContent=enabled?'Маска этого канала включена':'У этого канала маска выключена';
}
document.querySelectorAll('[data-channel]').forEach(button=>button.onclick=()=>{activeChannel=button.dataset.channel;renderChannel();});
document.getElementById('profileEnabled').onchange=event=>{channelState[activeChannel].enabled=event.target.checked;renderChannel();};
renderChannel();
const power=document.getElementById('blurPower');
power.addEventListener('input',()=>document.getElementById('powerNumber').value=power.value);
document.getElementById('maskMode').addEventListener('change',()=>{
 const enabled=document.getElementById('maskMode').value==='blur';
 power.disabled=!enabled;
});


document.querySelectorAll('details').forEach(details=>{
 details.addEventListener('toggle',()=>{
  if(details.open&&!reduced)details.querySelector('p')?.animate([{opacity:0,transform:'translateY(-5px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'ease-out'});
 });
});


sponsor.style.setProperty('--banner','url(swinline.png)');
applyDemo();
