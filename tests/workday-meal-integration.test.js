const test=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const wd=require('../extension/workday-core'),core=require('../extension/core'),api=require('../extension/workday-api'),adapter=require('../extension/workday-content');
const date='2026-10-19';
const settings={enabled:true,calendarIds:['work','meals'],keyword:'SCU Block',timeZone:'UTC',timeType:'Hours',outReason:'Out',calendarMeals:true,updateOverlaps:true};
const event=(a,b,summary='SCU Block')=>({summary,start:{dateTime:`${date}T${a}:00Z`},end:{dateTime:`${date}T${b}:00Z`}});
function fixture(initial=[],{ignoreReason=false,closingDelay=0,staleHidden=false,overlayDelay=0}={}) {
 const dom=new JSDOM(`<h1>Enter Time</h1><div data-automation-id="calendarToolbar"><button aria-label="Actions" aria-expanded="true" id="actions"></button><h2 data-automation-id="dateRangeTitle">Monday, October 19, 2026</h2><span data-automation-id="calendarViewSelection">Day</span></div><div data-automation-id="weeklyBody"><div data-automation-id="dayCell-2026-10-19">10/19</div></div><div class="gwt-appointment-panel">${'<div class="minor-time-interval"></div>'.repeat(96)}<div data-automation-id="timedDaySeparator_0"></div><div class="hit-target"></div></div><button>Review</button><button>Submit</button><button>Next</button>`,{url:'https://www.myworkday.com/scu/'});
 const doc=dom.window.document,entries=[],saves=[],cancelled=[],forbidden=[];
 dom.window.HTMLElement.prototype.getClientRects=function(){return this.hidden?[]:[{}]};dom.window.HTMLElement.prototype.scrollIntoView=function(){};
 let overlayUntil=0;
 const actions=doc.querySelector('#actions');actions.getBoundingClientRect=()=>({left:800,top:0,width:100,height:40});
 const panel=doc.querySelector('.gwt-appointment-panel');panel.getBoundingClientRect=()=>({left:0,top:0,width:700,height:1440});doc.elementFromPoint=(x)=>x>800 ? (Date.now()<overlayUntil ? doc.body : actions) : panel.querySelector('.hit-target');
 const minutes=value=>{const [,h,m,ampm]=/^(\d+):(\d+) (AM|PM)$/.exec(value);return (+h%12+(ampm==='PM'?12:0))*60 + +m};
 function render(entry){
  let el=entry.el;
  if(!el){el=entry.el=doc.createElement('div');doc.body.append(el);el.onclick=()=>open(entry)}
  el.setAttribute('role','link');el.setAttribute('data-automation-id','calendarevent');el.setAttribute('data-automation-eventid',entry.id);
  for(const part of ['start','end'])el.setAttribute(`data-automation-${part}date`,`10-19-${Math.floor(entry[part]/60)}-${entry[part]%60}`);
  el.innerHTML=`<span data-automation-id="calendarAppointmentTitle">Hours</span><span data-automation-icontype="${entry.status||'Not Submitted'}">${entry.status||'Not Submitted'}</span>`;
 }
 function close(d){
  d.remove();
  if(staleHidden){doc.body.setAttribute('aria-hidden','true');overlayUntil=Date.now()+overlayDelay;}
  if(closingDelay){const toolbar=doc.querySelector('[data-automation-id=calendarToolbar]');toolbar.setAttribute('aria-hidden','true');setTimeout(()=>toolbar.removeAttribute('aria-hidden'),closingDelay);}
 }
 function open(entry){
  if(Date.now()<overlayUntil || doc.querySelector('[data-automation-id=calendarToolbar]').hasAttribute('aria-hidden')){forbidden.push('Open while closing');return;}
  const d=doc.createElement('div');d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-label','Enter Time');
  d.innerHTML=`<p>10/19/2026</p><span data-automation-id="promptOption">${entry?.status||'Not Submitted'}</span><div role="listbox" aria-label="items selected for Time Type"><div role="option">Hours</div></div><label>In<input id="in" value="${entry?wd.clock(entry.start):''}"></label><label>Out<input id="out" value="${entry?wd.clock(entry.end):''}"></label><div role="combobox" aria-label="Out Reason"><div data-automation-id="selectSelectedOption">${entry?.reason||'Out'}</div><div>${entry?.reason||'Out'} selected</div></div><span data-automation-id="numericText">${entry?(entry.end-entry.start)/60:0}</span><label for="comment">Comment</label><textarea id="comment">${entry?.comment||''}</textarea><button>Cancel</button>${entry?'<button>Delete</button>':''}<button>OK</button>`;
  doc.body.append(d);
  const reason=d.querySelector('[role=combobox]');
  reason.onclick=()=>{
   const options=doc.createElement('div');options.setAttribute('role','listbox');
   for(const name of ['Out','Meal']){const el=doc.createElement('div');el.setAttribute('role','option');el.textContent=name;el.onclick=()=>{if(!ignoreReason){reason.querySelector('[data-automation-id=selectSelectedOption]').textContent=name;reason.lastElementChild.textContent=`${name} selected`;}options.remove()};options.append(el)}doc.body.append(options);
  };
  d.querySelector('#out').onblur=()=>{d.querySelector('[data-automation-id=numericText]').textContent=String((minutes(d.querySelector('#out').value)-minutes(d.querySelector('#in').value))/60)};
  for(const button of d.querySelectorAll('button'))button.onclick=()=>{
   if(button.textContent==='Delete'){forbidden.push('Delete');return}
   if(button.textContent==='Cancel'){cancelled.push(entry?.id||'new');close(d);return}
   const value={id:entry?.id||`new-${entries.length}`,start:minutes(d.querySelector('#in').value),end:minutes(d.querySelector('#out').value),reason:reason.querySelector('[data-automation-id=selectSelectedOption]').textContent,comment:d.querySelector('textarea').value};saves.push({...value});
   if(entry)Object.assign(entry,value);else{entry=value;entries.push(entry)}render(entry);close(d);
  };
 }
 panel.querySelector('.hit-target').onclick=()=>open();
 for(const button of doc.querySelectorAll('button'))if(['Review','Submit','Next'].includes(button.textContent))button.onclick=()=>forbidden.push(button.textContent);
 for(const value of initial){const entry={...value};entries.push(entry);render(entry)}
 return {dom,doc,entries,saves,cancelled,forbidden};
}
async function importEvents(f,events,changes={}) {
 const s=wd.settingsFrom({...settings,...changes}),base=adapter.readView(f.doc,wd);
 const result=wd.plan({events,dates:base.dates,settings:s,existing:adapter.readExisting(f.doc,base.dates),core,now:Infinity});
 const outcomes=[];
 for(const block of result.update)outcomes.push(await adapter.updateBlock(f.doc,wd,base,block,s));
 for(const block of result.add)outcomes.push(await adapter.createBlock(f.doc,wd,base,block,s));
 return {result,outcomes};
}
test('multiple-calendar API → planner → visible Workday forms splits a draft and reruns without writes',async()=>{
 const urls=[];
 const events=await api.listEvents({accessToken:'test',core:wd,settings,dates:[date],fetcher:async url=>{
  urls.push(new URL(url).pathname);return {ok:true,json:async()=>({items:url.includes('/work/')?[event('09:00','17:00')]:[event('12:00','12:30','lUnCh')]})};
 }});
 const f=fixture([{id:'original',start:540,end:1020,reason:'Out',comment:'Keep this note'}]);
 const first=await importEvents(f,events);assert.deepEqual(first.outcomes,['updated','added']);
 assert.deepEqual(f.entries.map(e=>[e.id,e.start,e.end,e.reason,e.comment]),[['original',540,720,'Meal','Keep this note'],['new-1',750,1020,'Out','']]);
 assert.equal(f.entries.reduce((n,e)=>n+e.end-e.start,0),450);
 const second=await importEvents(f,events);assert.deepEqual(second.outcomes,['already-entered','already-entered']);assert.equal(f.saves.length,2);assert.equal(f.cancelled.length,2);
 assert.equal(urls.length,2);assert.deepEqual(f.forbidden,[]);f.dom.window.close();
});
test('automatic meal creates two entries, selects Meal and Out, then makes no rerun writes',async()=>{
 const f=fixture(),events=[event('09:00','17:00')];
 await importEvents(f,events,{calendarMeals:false,autoMeal:true});
 assert.deepEqual(f.entries.map(e=>[e.start,e.end,e.reason]),[[540,840,'Meal'],[870,1020,'Out']]);
 await importEvents(f,events,{calendarMeals:false,autoMeal:true});assert.equal(f.saves.length,2);assert.deepEqual(f.forbidden,[]);f.dom.window.close();
});
test('reason-only correction changes Out to Meal, preserves comment and skips the next run',async()=>{
 const f=fixture([{id:'existing',start:540,end:720,reason:'Out',comment:'Original note'}]);
 const events=[event('09:00','12:00'),event('12:00','12:30','Lunch')];
 assert.deepEqual((await importEvents(f,events)).outcomes,['updated']);
 assert.deepEqual((await importEvents(f,events)).outcomes,['already-entered']);
 assert.equal(f.saves.length,1);assert.equal(f.saves[0].reason,'Meal');assert.equal(f.saves[0].comment,'Original note');f.dom.window.close();
});
test('submitted entries are left intact and reported as meal conflicts',async()=>{
 const f=fixture([{id:'submitted',start:540,end:1020,reason:'Out',status:'Submitted'}]);
 const r=await importEvents(f,[event('09:00','17:00'),event('12:00','12:30','Lunch')]);
 assert.equal(r.result.conflicts.length,2);assert.equal(f.saves.length,0);assert.deepEqual(f.forbidden,[]);f.dom.window.close();
});

test('batch waits for Workday to restore calendar access after both Save and Cancel',async()=>{
 const f=fixture([{id:'existing',start:540,end:720,reason:'Out'}],{closingDelay:75});
 const events=[event('09:00','12:00'),event('12:00','12:30','Lunch'),event('12:30','17:00')];
 assert.deepEqual((await importEvents(f,events)).outcomes,['updated','added']);
 assert.deepEqual((await importEvents(f,events)).outcomes,['already-entered','already-entered']);
 assert.equal(f.saves.length,2);assert.deepEqual(f.forbidden,[]);f.dom.window.close();
});

test('rerun tolerates Workday stale ancestor aria-hidden only after the overlay clears',async()=>{
 const f=fixture([{id:'morning',start:600,end:720,reason:'Meal'},{id:'afternoon',start:750,end:1020,reason:'Out'}],{staleHidden:true,overlayDelay:150});
 const r=await importEvents(f,[event('10:00','12:00'),event('12:00','12:30','Lunch'),event('12:30','17:00')]);
 assert.deepEqual(r.outcomes,['already-entered','already-entered']);
 assert.equal(f.saves.length,0);assert.deepEqual(f.forbidden,[]);f.dom.window.close();
});
