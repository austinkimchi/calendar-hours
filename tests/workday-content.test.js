const test=require('node:test');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');
const adapter=require('../extension/workday-content.js'),core=require('../extension/workday-core.js'),titleCore=require('../extension/core.js');
const settings={enabled:true,calendarId:'test',keyword:'Work block',timeZone:'UTC',timeType:'Hours',outReason:'Out'};
function fixture({day=true,date='2026-10-19',dialogDate='10/19/2026',existingDialog=false,padTime=false,changeTime=false,discardPrompt=false,calculationDelay=0}={}){
 const days=day?[date]:Array.from({length:7},(_,i)=>core.addDays(date,i));
 const dom=new JSDOM(`<h1>Enter Time</h1><div data-automation-id="calendarToolbar"><button id="actions-menu-trigger" aria-label="Actions" aria-expanded="true"></button><h2 data-automation-id="dateRangeTitle">${day?'Monday, October 19':'Oct 19 – 25'}, 2026</h2><span data-automation-id="calendarViewSelection">${day?'Day':'Week'}</span></div><div data-automation-id="weeklyBody">${days.map(d=>`<div data-automation-id="dayCell-${d}">${+d.slice(5,7)}/${+d.slice(8)}</div>`).join('')}</div><div class="gwt-appointment-panel">${Array.from({length:96},()=>'<div class="minor-time-interval"></div>').join('')}<div data-automation-id="timedDaySeparator_0"></div><div class="hit-target"></div></div><button>Review</button><button>Submit</button><button>Next</button>`,{url:'https://www.myworkday.com/example/'});
 const {document:doc}=dom.window;dom.window.HTMLElement.prototype.getClientRects=function(){return this.hidden?[]:[{}]};
 dom.window.HTMLElement.prototype.scrollIntoView=function(){};
 const panel=doc.querySelector('.gwt-appointment-panel');
 doc.elementFromPoint=()=>panel.querySelector('.hit-target');panel.getBoundingClientRect=()=>({left:0,top:0,width:700,height:1440});
 let saved=[],cancelled=0,forbidden=[],selection=[];
 for(const type of ['pointerdown','mousedown','pointerup','mouseup','click']) panel.addEventListener(type,e=>selection.push({type,target:e.target.className,x:e.clientX,y:e.clientY}));
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
 return {dom,doc,saved,forbidden,selection,get cancelled(){return cancelled}};
}
test('single-day and week extraction takes dates from rendered headers',()=>{
 const f=fixture();assert.deepEqual(adapter.readView(f.doc,core).dates,['2026-10-19']);f.dom.window.close();
 const w=fixture({day:false});assert.equal(adapter.readView(w.doc,core).dates.at(-1),'2026-10-25');w.dom.window.close();
});
test('individual draft save writes exact times with no comment by default; rerun skips',async()=>{
 const f=fixture(),base=adapter.readView(f.doc,core),block={date:'2026-10-19',start:547,end:765,title:'Work block (3.63 hours)'};
 assert.equal(await adapter.createBlock(f.doc,core,base,block,settings),'added');
 assert.deepEqual(f.saved,[{start:'9:07 AM',end:'12:45 PM',comment:''}]);
 assert.deepEqual(f.selection.map(e=>e.type),['pointerdown','mousedown','pointerup','mouseup','click']);assert.ok(f.selection.every(e=>e.target==='hit-target'));
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
 const item=menu.querySelector('[data-calendar-hours="workday-import"]');assert.equal(item.textContent,'Auto-fill from Calendar');assert.equal(menu.firstElementChild,item);item.click();
 await new Promise(r=>setTimeout(r,10));assert.deepEqual(requests.map(m=>m.type),['CALENDAR_HOURS_WORKDAY_EVENTS','CALENDAR_HOURS_WORKDAY_SETUP']);assert.deepEqual(requests[0].dates,['2026-10-19']);
 assert.ok(f.doc.querySelector('.calendar-hours-workday-status'));f.doc.querySelector('[data-automation-id^="dayCell-"]').textContent='10/20';await new Promise(r=>setTimeout(r,10));assert.equal(f.doc.querySelector('.calendar-hours-workday-status'),null);f.dom.window.close();
});

function actionMenu(f) {
 const menu=f.doc.createElement('ul');menu.tabIndex=0;menu.setAttribute('role','listbox');menu.setAttribute('aria-labelledby','actions-menu-trigger');
 menu.setAttribute('aria-activedescendant','prior');
 menu.innerHTML='<li role="presentation"><div role="option" id="prior" aria-selected="true">Auto-fill from Prior Week</div></li><li role="presentation"><div role="option" id="disabled" aria-disabled="true">Unavailable action</div></li><li role="presentation"><div role="option" id="week">Enter Time by Week</div></li>';
 f.doc.body.append(menu);
 return menu;
}
test('status aligns with Actions, dismisses for the current run, and returns on the next run',async()=>{
 const f=fixture(),menu=actionMenu(f),trigger=f.doc.querySelector('#actions-menu-trigger');
 let right=900,respond;
 trigger.getBoundingClientRect=()=>({right});
 f.dom.window.HTMLElement.prototype.getBoundingClientRect=function(){return {left:100}};
 adapter.install(f.doc,{runtime:{sendMessage:()=>new Promise(resolve=>{respond=resolve})}},core,titleCore);
 const item=menu.querySelector('[data-calendar-hours="workday-import"]');item.click();
 let status=f.doc.querySelector('.calendar-hours-workday-status');assert.equal(status.style.width,'800px');
 right=700;f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));assert.equal(status.style.width,'600px');
 assert.equal(status.querySelectorAll('button').length,1,'routine messages only show Dismiss');
 const dismiss=status.querySelector('[aria-label="Dismiss calendar import message"]');dismiss.focus();dismiss.click();
 assert.equal(f.doc.activeElement,trigger);assert.equal(f.doc.querySelector('.calendar-hours-workday-status'),null);
 respond({ok:true,events:[],settings});await new Promise(r=>setTimeout(r,0));
 assert.equal(f.doc.querySelector('.calendar-hours-workday-status'),null,'later progress does not reopen a dismissed message');
 item.click();assert.ok(f.doc.querySelector('.calendar-hours-workday-status'));
 respond({ok:false,needsSetup:true,reason:'Connect Google Calendar'});await new Promise(r=>setTimeout(r,0));
 status=f.doc.querySelector('.calendar-hours-workday-status');assert.ok(status.textContent.includes('Set up calendar import'));
 assert.equal(status.querySelectorAll('button').length,2);f.dom.window.close();
});
test('Actions opens with Calendar selected and Enter activates only Calendar',async()=>{
 const f=fixture(),menu=actionMenu(f),requests=[];let nativeEnter=0,priorClicks=0;
 menu.addEventListener('keydown',event=>{if(event.key==='Enter')nativeEnter++});
 menu.querySelector('#prior').addEventListener('click',()=>priorClicks++);
 adapter.install(f.doc,{runtime:{sendMessage:async m=>{requests.push(m);return {ok:true,events:[],settings}}}},core,titleCore);
 const item=menu.querySelector('[data-calendar-hours="workday-import"]');
 assert.equal(f.doc.activeElement,menu);
 assert.equal(menu.getAttribute('aria-activedescendant'),item.id);
 assert.equal(item.getAttribute('aria-selected'),'true');
 assert.equal(menu.querySelector('#prior').getAttribute('aria-selected'),'false');
 menu.setAttribute('aria-activedescendant','prior');
 await new Promise(r=>setTimeout(r,0));
 assert.equal(menu.getAttribute('aria-activedescendant'),item.id,'late Workday focus updates cannot restore the prior-week selection');
 menu.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
 await new Promise(r=>setTimeout(r,0));
 assert.deepEqual(requests.map(r=>r.type),['CALENDAR_HOURS_WORKDAY_EVENTS']);
 assert.equal(nativeEnter,0);assert.equal(priorClicks,0);assert.deepEqual(f.forbidden,[]);f.dom.window.close();
});
test('Actions arrows, pointer hover and typeahead select the highlighted option and reopen resets to Calendar',async()=>{
 const f=fixture(),menu=actionMenu(f),trigger=f.doc.querySelector('#actions-menu-trigger');let priorClicks=0,nativeEscape=0;
 menu.querySelector('#prior').addEventListener('click',()=>priorClicks++);
 menu.addEventListener('keydown',event=>{if(event.key==='Escape')nativeEscape++});
 adapter.install(f.doc,{runtime:{sendMessage:async()=>({ok:true,events:[],settings})}},core,titleCore);
 const item=menu.querySelector('[data-calendar-hours="workday-import"]');
 const key=key=>menu.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
 const selected=()=>menu.getAttribute('aria-activedescendant');
 key('ArrowDown');assert.equal(selected(),'prior');
 key('ArrowDown');assert.equal(selected(),'week','disabled items are skipped');
 key('ArrowDown');assert.equal(selected(),item.id);
 key('ArrowUp');assert.equal(selected(),'week');
 key('Home');assert.equal(selected(),item.id);
 key('End');assert.equal(selected(),'week');
 key('a');assert.equal(selected(),item.id);
 menu.querySelector('#prior').dispatchEvent(new f.dom.window.MouseEvent('mouseover',{bubbles:true}));
 assert.equal(selected(),'prior');key('Enter');assert.equal(priorClicks,1);
 key('Escape');assert.equal(nativeEscape,1,'native menu dismissal remains available');
 trigger.setAttribute('aria-expanded','false');menu.hidden=true;
 await new Promise(r=>setTimeout(r,0));
 menu.hidden=false;trigger.setAttribute('aria-expanded','true');
 await new Promise(r=>setTimeout(r,0));
 assert.equal(selected(),item.id);
 assert.equal(menu.querySelectorAll('[data-calendar-hours="workday-import"]').length,1);
 assert.deepEqual(f.forbidden,[]);f.dom.window.close();
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

function editableDraft(f,{status='Not Submitted',dialogStatus=status,wrongTimes=false,changeDuringEdit=false,discard=false,renderDelay=0}={}) {
 const entry=f.doc.createElement('div');
 entry.setAttribute('role','link');entry.setAttribute('data-automation-id','calendarevent');
 entry.setAttribute('data-automation-eventid','draft-1');
 entry.setAttribute('data-automation-startdate','10-19-13-0');entry.setAttribute('data-automation-enddate','10-19-15-0');
 entry.innerHTML=`<span data-automation-id="calendarAppointmentTitle">Hours</span><span data-automation-icontype="${status}">${status}</span>`;
 f.doc.body.append(entry);
 let opens=0,cancelled=0;
 entry.addEventListener('click',()=>{
  opens++;
  const dialog=f.doc.createElement('div');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Enter Time');
  dialog.innerHTML='<p>10/19/2026</p>';
  f.doc.body.append(dialog);
  const render=()=>{
  dialog.innerHTML=`<p>10/19/2026</p><span data-automation-id="promptOption">${dialogStatus}</span><div role="listbox" aria-label="items selected for Time Type"><div role="option">Hours</div></div><label>In<input id="edit-in" value="${wrongTimes?'02:00 PM':'01:00 PM'}"></label><label>Out<input id="edit-out" value="03:00 PM"></label><div role="combobox" aria-label="Out Reason">Out</div><span data-automation-id="numericText">2</span><label for="edit-comment">Comment</label><textarea id="edit-comment">Old calendar title</textarea><button>Cancel</button><button>Delete</button><button>OK</button>`;
  const minutes=value=>{const [,h,m,ampm]=/^(\d+):(\d+) (AM|PM)$/.exec(value);return (+h%12+(ampm==='PM'?12:0))*60 + +m};
  dialog.querySelector('#edit-out').addEventListener('blur',()=>{
    dialog.querySelector('[data-automation-id="numericText"]').textContent=String((minutes(dialog.querySelector('#edit-out').value)-minutes(dialog.querySelector('#edit-in').value))/60);
    if(changeDuringEdit)entry.setAttribute('data-automation-enddate','10-19-16-0');
  });
  const cancel=()=>{cancelled++;dialog.remove()};
  [...dialog.querySelectorAll('button')].find(b=>b.textContent==='Cancel').onclick=()=>{
    if(!discard){cancel();return}
    const confirm=f.doc.createElement('div');confirm.setAttribute('role','dialog');confirm.setAttribute('aria-label','Discard Changes?');confirm.innerHTML='<button>Discard</button>';f.doc.body.append(confirm);
    confirm.querySelector('button').onclick=()=>{cancel();confirm.remove()};
  };
  [...dialog.querySelectorAll('button')].find(b=>b.textContent==='Delete').onclick=()=>f.forbidden.push('Delete');
  [...dialog.querySelectorAll('button')].find(b=>b.textContent==='OK').onclick=()=>{
    const values={start:dialog.querySelector('#edit-in').value,end:dialog.querySelector('#edit-out').value,comment:dialog.querySelector('textarea').value};
    f.saved.push(values);
    for(const [key,value] of [['start',values.start],['end',values.end]]) {const min=minutes(value);entry.setAttribute(`data-automation-${key}date`,`10-19-${Math.floor(min/60)}-${min%60}`)}
    dialog.remove();
  };
  };
  if(renderDelay)setTimeout(render,renderDelay);else render();
 });
 return {entry,get opens(){return opens},get cancelled(){return cancelled}};
}
const editBlock={date:'2026-10-19',start:750,end:900,title:'Work block (2.5 hours)',previous:{date:'2026-10-19',start:780,end:900,type:'Hours',eventId:'draft-1'}};
test('overlap update edits the existing draft in place and a rerun skips it',async()=>{
 const f=fixture(),draft=editableDraft(f,{renderDelay:120}),base=adapter.readView(f.doc,core),enabled={...settings,updateOverlaps:true};
 assert.equal(await adapter.updateBlock(f.doc,core,base,editBlock,enabled),'updated');
 assert.deepEqual(f.saved,[{start:'12:30 PM',end:'3:00 PM',comment:'Old calendar title'}]);
 assert.equal(f.doc.querySelectorAll('[data-automation-id="calendarevent"]').length,1);
 assert.equal(draft.entry.getAttribute('data-automation-startdate'),'10-19-12-30');
 const rerun=core.plan({events:[{summary:editBlock.title,start:{dateTime:'2026-10-19T12:30:00Z'},end:{dateTime:'2026-10-19T15:00:00Z'}}],dates:base.dates,settings:enabled,existing:adapter.readExisting(f.doc,base.dates),core:titleCore});
 assert.equal(rerun.update.length,0);assert.equal(rerun.add.length,0);assert.equal(rerun.skipped[0].reason,'already-entered');
 assert.deepEqual(f.forbidden,[]);f.dom.window.close();
});
test('overlap update rejects disabled settings, submitted entries, wrong forms and changed entries',async()=>{
 for(const options of [{enabled:false},{status:'Submitted'},{dialogStatus:'Approved'},{wrongTimes:true},{changeDuringEdit:true,discard:true}]) {
  const f=fixture(),draft=editableDraft(f,options),base=adapter.readView(f.doc,core);
  await assert.rejects(adapter.updateBlock(f.doc,core,base,editBlock,{...settings,updateOverlaps:options.enabled!==false}));
  assert.equal(f.saved.length,0);assert.deepEqual(f.forbidden,[]);
  if(options.enabled===false||options.status==='Submitted')assert.equal(draft.opens,0);
  else assert.equal(draft.cancelled,1);
  assert.equal(f.doc.querySelector('[role="dialog"]'),null);
  assert.equal(draft.entry.getAttribute('data-automation-startdate'),'10-19-13-0');
  assert.equal(draft.entry.getAttribute('data-automation-enddate'),options.changeDuringEdit?'10-19-16-0':'10-19-15-0');
  f.dom.window.close();
 }
});

test('optional comments use plain-text Calendar descriptions, never event titles',async()=>{
 const f=fixture();
 const descriptions=['<p>Lab work &amp; documentation</p><p>Follow-up<br>Notes</p><script>ignore this</script>'];
 assert.equal(await adapter.createBlock(f.doc,core,adapter.readView(f.doc,core),{date:'2026-10-19',start:540,end:600,title:'Work block (1 hour)',descriptions},{...settings,importComments:true}),'added');
 assert.equal(f.saved[0].comment,'Lab work & documentation\nFollow-up\nNotes');
 assert.equal(adapter.commentText(f.doc,['a'.repeat(1200)]).length,1000);
 f.dom.window.close();
 for(const descriptions of [['Updated project notes'],[]]) {
  const edit=fixture();editableDraft(edit);
  await adapter.updateBlock(edit.doc,core,adapter.readView(edit.doc,core),{...editBlock,descriptions},{...settings,updateOverlaps:true,importComments:true});
  assert.equal(edit.saved[0].comment,descriptions[0]||'');
  assert.deepEqual(edit.forbidden,[]);edit.dom.window.close();
 }
});
