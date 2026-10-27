const test=require('node:test');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');
const adapter=require('../extension/workday-content.js'),core=require('../extension/workday-core.js'),titleCore=require('../extension/core.js');
const settings={enabled:true,calendarId:'test',keyword:'Work block',timeZone:'UTC',timeType:'Hours',outReason:'Out'};
function fixture({day=true,date='2026-10-19',dialogDate='10/19/2026',existingDialog=false,padTime=false,changeTime=false,discardPrompt=false,calculationDelay=0}={}){
 const days=day?[date]:Array.from({length:7},(_,i)=>core.addDays(date,i));
 const dom=new JSDOM(`<h1>Enter Time</h1><div data-automation-id="calendarToolbar"><button id="actions-menu-trigger" aria-label="Actions" aria-expanded="true"></button><h2 data-automation-id="dateRangeTitle">${day?'Monday, October 19':'Oct 19 – 25'}, 2026</h2><span data-automation-id="calendarViewSelection">${day?'Day':'Week'}</span></div><div data-automation-id="weeklyBody">${days.map(d=>`<div data-automation-id="dayCell-${d}">${+d.slice(5,7)}/${+d.slice(8)}</div>`).join('')}</div><div class="gwt-appointment-panel"><div data-automation-id="timedDaySeparator_0"></div></div><button>Review</button><button>Submit</button><button>Next</button>`,{url:'https://www.myworkday.com/example/'});
 const {document:doc}=dom.window;dom.window.HTMLElement.prototype.getClientRects=function(){return this.hidden?[]:[{}]};
 const panel=doc.querySelector('.gwt-appointment-panel');panel.getBoundingClientRect=()=>({left:0,top:0,width:700,height:1440});
 let saved=[],cancelled=0,forbidden=[];
 for(const b of doc.querySelectorAll('button')) if(['Review','Submit','Next'].includes(b.textContent))b.addEventListener('click',()=>forbidden.push(b.textContent));
 panel.addEventListener('click',()=>{
   const el=doc.createElement('div');el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Enter Time');
   el.innerHTML=`<p>${dialogDate}</p><div role="listbox" aria-label="items selected for Time Type"><div role="option">Hours</div></div><label for="in">In*</label><input id="in"><label for="out">Out*</label><input id="out"><div role="combobox" aria-label="Out Reason">Out</div><div data-automation-id="numericText">0</div><label for="comment">Comment</label><textarea id="comment"></textarea><button>Cancel</button><button>OK</button>${existingDialog?'<button>Delete</button>':''}`;
   doc.body.append(el);
   if(padTime || changeTime) for(const input of el.querySelectorAll("#in,#out")) input.addEventListener("blur",()=>{input.value=changeTime ? "10:00 AM" : input.value.replace(/^(\d):/,"0$1:")});
   const minutes=s=>{const match=/^(\d+):(\d+) (AM|PM)$/.exec(s);if(!match)return NaN;const [,h,m,ampm]=match;return (+h%12+(ampm==='PM'?12:0))*60 + +m};
   el.querySelector('#out').addEventListener('blur',()=>{setTimeout(()=>{el.querySelector('[data-automation-id="numericText"]').textContent=String((minutes(el.querySelector('#out').value)-minutes(el.querySelector('#in').value))/60)},calculationDelay)});
   [...el.querySelectorAll('button')].find(b=>b.textContent==='Cancel').onclick=()=>{
     if(!discardPrompt){cancelled++;el.remove();return}
     const confirm=doc.createElement('div');confirm.setAttribute('role','dialog');confirm.setAttribute('aria-label','Discard Changes?');confirm.innerHTML='<button>Discard</button><button>Continue</button>';doc.body.append(confirm);
     confirm.querySelector('button').onclick=()=>{cancelled++;el.remove();confirm.remove()};
   };
   [...el.querySelectorAll('button')].find(b=>b.textContent==='OK').onclick=()=>{
     const values={start:el.querySelector('#in').value,end:el.querySelector('#out').value,comment:el.querySelector('#comment').value};saved.push(values);
     const minutes=s=>{const [,h,m,ampm]=/^(\d+):(\d+) (AM|PM)$/.exec(s);return (+h%12+(ampm==='PM'?12:0))*60 + +m};
     const entry=doc.createElement('div');entry.setAttribute('data-automation-id','calendarevent');entry.setAttribute('role','link');
     for(const [attr,value] of [['start',values.start],['end',values.end]]){const min=minutes(value);entry.setAttribute(`data-automation-${attr}date`,`${+date.slice(5,7)}-${+date.slice(8)}-${Math.floor(min/60)}-${min%60}`)}
     entry.innerHTML='<span data-automation-id="calendarAppointmentTitle">Hours</span>Not Submitted';doc.body.append(entry);el.remove();
   };
 });
 return {dom,doc,saved,forbidden,get cancelled(){return cancelled}};
}
test('single-day and week extraction takes dates from rendered headers',()=>{
 const f=fixture();assert.deepEqual(adapter.readView(f.doc,core).dates,['2026-10-19']);f.dom.window.close();
 const w=fixture({day:false});assert.equal(adapter.readView(w.doc,core).dates.at(-1),'2026-10-25');w.dom.window.close();
});
test('individual draft save writes exact times and title; rerun skips, without any review/submit action',async()=>{
 const f=fixture(),base=adapter.readView(f.doc,core),block={date:'2026-10-19',start:547,end:765,title:'Work block (3.63 hours)'};
 assert.equal(await adapter.createBlock(f.doc,core,base,block,settings),'added');
 assert.deepEqual(f.saved,[{start:'9:07 AM',end:'12:45 PM',comment:block.title}]);
 assert.equal(await adapter.createBlock(f.doc,core,base,block,settings),'already-entered');assert.equal(f.saved.length,1);assert.deepEqual(f.forbidden,[]);f.dom.window.close();
});
test('unexpected date or existing-entry dialog is cancelled before saving',async()=>{
 for(const options of [{dialogDate:'10/20/2026'},{existingDialog:true}]){
   const f=fixture(options);await assert.rejects(adapter.createBlock(f.doc,core,adapter.readView(f.doc,core),{date:'2026-10-19',start:540,end:600,title:'Work block'},settings));
   assert.equal(f.saved.length,0);assert.equal(f.cancelled,1);assert.deepEqual(f.forbidden,[]);f.dom.window.close();
 }
});
test('navigation during import stops before opening any form',async()=>{
 const f=fixture(),base=adapter.readView(f.doc,core);f.doc.querySelector('[data-automation-id^="dayCell-"]').textContent='10/20';
 await assert.rejects(adapter.createBlock(f.doc,core,base,{date:'2026-10-19',start:540,end:600},settings),/displayed dates changed/);assert.equal(f.saved.length,0);f.dom.window.close();
});
test('Actions menu adds import and sends unconfigured users directly to setup',async()=>{
 const f=fixture();const menu=f.doc.createElement('div');menu.setAttribute('role','listbox');menu.setAttribute('aria-labelledby','actions-menu-trigger');menu.innerHTML='<div role="option">Enter Time by Week</div>';f.doc.body.append(menu);
 const requests=[];adapter.install(f.doc,{runtime:{sendMessage:async m=>{requests.push(m);return {ok:false,needsSetup:true,reason:'Choose calendar'}}}},core,titleCore);
 const item=menu.querySelector('[data-calendar-hours="workday-import"]');assert.equal(item.textContent,'Auto-fill from Calendar');item.click();
 await new Promise(r=>setTimeout(r,10));assert.deepEqual(requests.map(m=>m.type),['CALENDAR_HOURS_WORKDAY_EVENTS','CALENDAR_HOURS_WORKDAY_SETUP']);assert.deepEqual(requests[0].dates,['2026-10-19']);f.dom.window.close();
});


test('Workday zero-padded time formatting is accepted but changed time values are rejected',async()=>{
 for(const changeTime of [false,true]){
  const f=fixture({padTime:true,changeTime}),block={date:'2026-10-19',start:547,end:765,title:'Work block'};
  if(changeTime) {await assert.rejects(adapter.createBlock(f.doc,core,adapter.readView(f.doc,core),block,settings),/exact calendar times/);assert.equal(f.saved.length,0);assert.equal(f.cancelled,1)}
  else {assert.equal(await adapter.createBlock(f.doc,core,adapter.readView(f.doc,core),block,settings),'added');assert.equal(f.saved[0].start,'09:07 AM')}
  f.dom.window.close();
 }
});


test('failed draft cleanup handles Workday Discard Changes without touching saved entries',async()=>{
 const f=fixture({changeTime:true,discardPrompt:true});
 await assert.rejects(adapter.createBlock(f.doc,core,adapter.readView(f.doc,core),{date:'2026-10-19',start:547,end:765,title:'Work block'},settings),/exact calendar times/);
 assert.equal(f.cancelled,1);assert.equal(f.saved.length,0);assert.equal(f.doc.querySelector('[role="dialog"]'),null);f.dom.window.close();
});
test('the adapter waits for Workday to calculate the exact hours before OK',async()=>{
 const f=fixture({calculationDelay:180}),before=Date.now();
 assert.equal(await adapter.createBlock(f.doc,core,adapter.readView(f.doc,core),{date:'2026-10-19',start:547,end:765,title:'Work block'},settings),'added');
 assert.ok(Date.now()-before>=180);assert.equal(f.saved.length,1);f.dom.window.close();
});
