const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
async function harness({connected=false,calendarListAccess=false,fail=false}={}) {
 const dom=new JSDOM(fs.readFileSync('extension/options.html','utf8'),{runScripts:'outside-only',url:'https://extension.test/options.html'});
 const {window}=dom;window.HTMLElement.prototype.scrollIntoView=function(){};
 const messages=[],writes=[];
 const saved={apiSync:false,workdayIntegration:{enabled:true,calendarId:'work-test',keyword:'Work block',timeZone:'America/Los_Angeles',includeFuture:true,updateOverlaps:true}};
 window.chrome={storage:{sync:{get:async()=>structuredClone(saved),set:async v=>writes.push(v),remove:async()=>{}}},runtime:{sendMessage:async message=>{
  messages.push(message.type);
  if(message.type==='CALENDAR_HOURS_API_STATUS')return {configured:true,connected,calendarListAccess};
  if(message.type==='CALENDAR_HOURS_API_CONNECT') {
   if(fail)return {ok:false,reason:'Sign-in cancelled'};
   connected=calendarListAccess=true;return {connected:true,calendarListAccess:true};
  }
  if(message.type==='CALENDAR_HOURS_API_DISCONNECT'){connected=calendarListAccess=false;return {connected:false};}
  if(message.type==='CALENDAR_HOURS_WORKDAY_CALENDARS')return connected&&calendarListAccess
   ?{ok:true,calendars:[{id:'work-test',name:'Work',timeZone:'America/Los_Angeles'}]}
   :{ok:false,needsSetup:true,reason:'Connect Google Calendar in General.'};
  throw new Error(`Unexpected message ${message.type}`);
 }}};
 for(const script of ['core.js','calendar-connection.js','options.js','workday-core.js','workday-options.js'])window.eval(fs.readFileSync(`extension/${script}`,'utf8'));
 await settle();await settle();
 return {dom,window,messages,writes,doc:window.document};
}
test('one shared connect populates Workday without a second OAuth call or preference changes',async()=>{
 const f=await harness(),button=f.doc.querySelector('#connect-api');
 assert.equal(button.closest('section').id,'general');
 assert.equal(f.doc.querySelector('#workday-connect'),null);
 assert.equal(f.doc.querySelector('#workday-manage-connection').hidden,false);
 f.doc.querySelector('#workday-phrase').value='Unsaved phrase';
 button.click();await settle();await settle();
 assert.equal(f.messages.filter(type=>type.endsWith('_CONNECT')).length,1);
 assert.equal(f.doc.querySelector('#workday-calendar').value,'work-test');
 assert.equal(f.doc.querySelector('#workday-phrase').value,'Unsaved phrase');
 assert.equal(f.doc.querySelector('#workday-connection').hidden,true);
 assert.equal(f.doc.querySelector('#workday-manage-connection').hidden,true);
 assert.equal(f.doc.querySelector('#api-status').textContent,'Connected.');
 assert.equal(f.doc.querySelector('[name="apiSync"]').checked,false);
 assert.equal(f.doc.querySelector('[name="enabled"]').checked,true);
 assert.equal(f.writes.length,0);
 f.doc.querySelector('#workday-refresh').click();await settle();
 assert.equal(f.messages.filter(type=>type.endsWith('_CONNECT')).length,1,'refreshing the calendar list never reconnects');
 f.dom.window.close();
});
test('shared disconnect removes calendar access without erasing saved import choices',async()=>{
 const f=await harness({connected:true,calendarListAccess:true});
 f.doc.querySelector('#disconnect-api').click();await settle();await settle();
 assert.equal(f.doc.querySelector('#workday-manage-connection').hidden,false);
 assert.equal(f.doc.querySelector('#workday-calendar').value,'work-test');
 assert.equal(f.doc.querySelector('#workday-phrase').value,'Work block');
 f.doc.querySelector('#workday-settings').dispatchEvent(new f.window.Event('submit',{cancelable:true}));await settle();
 assert.equal(f.writes.length,0,'disconnected import cannot be enabled/saved as ready');
 f.dom.window.close();
});
test('existing complete connections load without consent, and cancelled upgrades preserve choices',async()=>{
 for(const complete of [true,false]) {
  const f=await harness({connected:true,calendarListAccess:complete,fail:true});
  assert.equal(f.messages.filter(type=>type.endsWith('_CONNECT')).length,0);
  if(!complete) {
   f.doc.querySelector('#connect-api').click();await settle();
   assert.match(f.doc.querySelector('#api-status').textContent,/Sign-in cancelled/);
   assert.equal(f.doc.querySelector('#connect-api').disabled,false);
   assert.equal(f.doc.querySelector('#workday-phrase').value,'Work block');
   assert.equal(f.writes.length,0);
  }
  f.dom.window.close();
 }
});
