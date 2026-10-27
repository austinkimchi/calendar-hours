const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');const {JSDOM}=require('jsdom');
async function harness(available=true,saved={},calendarZone="America/Los_Angeles"){const dom=new JSDOM(fs.readFileSync('extension/options.html','utf8'),{runScripts:'outside-only',url:'https://extension.test/options.html#workday'}),writes=[];
 dom.window.HTMLElement.prototype.scrollIntoView=function(){};
 dom.window.chrome={storage:{sync:{get:async()=>({workdayIntegration:saved}),set:async v=>writes.push(v)}},runtime:{sendMessage:async()=>available?{ok:true,calendars:[{id:'work-test',name:'Work',timeZone:calendarZone}]}:{ok:false,needsSetup:true,reason:'Reconnect Google Calendar'}}};
 dom.window.eval(fs.readFileSync('extension/workday-core.js','utf8'));dom.window.eval(fs.readFileSync('extension/workday-options.js','utf8'));await new Promise(r=>setTimeout(r,10));
 return {dom,writes,form:dom.window.document.querySelector('#workday-settings')};
}
test('setup persists selected calendar and independent import keyword, without changing title settings',async()=>{
 const f=await harness(),el=n=>f.form.elements.namedItem(n);el('calendarId').value='work-test';el('calendarId').dispatchEvent(new f.dom.window.Event('change'));el('keyword').value='Work block';el('enabled').checked=true;
 f.form.dispatchEvent(new f.dom.window.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,10));
 assert.equal(f.writes.length,1);assert.deepEqual(Object.keys(f.writes[0]),['workdayIntegration']);assert.equal(f.writes[0].workdayIntegration.calendarId,'work-test');assert.equal(f.writes[0].workdayIntegration.keyword,'Work block');assert.equal(f.writes[0].workdayIntegration.timeZone,'America/Los_Angeles');f.dom.window.close();
});
test('missing calendar access and invalid time zones cannot enable an import',async()=>{
 for(const available of [false,true]){const f=await harness(available);f.form.elements.namedItem('enabled').checked=true;f.form.elements.namedItem('calendarId').value='work-test';f.form.elements.namedItem('keyword').value='Work block';f.form.elements.namedItem('timeZone').value='invalid';f.form.dispatchEvent(new f.dom.window.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,5));assert.equal(f.writes.length,0);f.dom.window.close()}
});

test('time zone dropdown preserves saved zones and saves a new choice without resetting preferences', async () => {
 for (const timeZone of ['America/Los_Angeles', 'US/Pacific', 'UTC']) {
  const saved = {enabled:true, calendarId:'work-test', keyword:'Work block', timeZone, includeFuture:true, timeType:'Hours', outReason:'Out'};
  const f = await harness(true, saved), zone = f.form.elements.namedItem('timeZone');
  assert.equal(zone.tagName, 'SELECT');
  assert.equal(zone.value, timeZone);
  assert.equal(f.form.elements.namedItem('includeFuture').checked, true);
  assert.equal(f.writes.length, 0, 'loading settings must not write anything');
  assert.ok([...zone.options].some(option => option.value === 'America/Los_Angeles' && option.textContent.includes('Pacific Time')));
  assert.ok([...zone.options].some(option => option.value === 'Europe/London'));
  assert.equal(new Set([...zone.options].map(option => option.value)).size, zone.options.length);
  zone.value = 'America/New_York';
  zone.dispatchEvent(new f.dom.window.Event('input', {bubbles:true}));
  f.form.dispatchEvent(new f.dom.window.Event('submit', {cancelable:true}));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(f.writes[0].workdayIntegration.timeZone, 'America/New_York');
  assert.equal(f.writes[0].workdayIntegration.includeFuture, true);
  assert.equal(f.writes[0].workdayIntegration.outReason, 'Out');
  assert.equal(f.form.elements.namedItem('outReason').required, true);
  f.dom.window.close();
 }
});

test('choosing a calendar supports time zone aliases missing from the standard list', async () => {
 const f = await harness(true, {timeZone:'America/New_York'}, 'US/Pacific');
 const calendar = f.form.elements.namedItem('calendarId');
 assert.equal(f.form.elements.namedItem('timeZone').value, 'America/New_York');
 calendar.value = 'work-test';
 calendar.dispatchEvent(new f.dom.window.Event('change', {bubbles:true}));
 assert.equal(f.form.elements.namedItem('timeZone').value, 'US/Pacific');
 f.dom.window.close();
});

test('overlap updates default on and an explicitly saved off choice survives reopening settings', async () => {
 const saved={enabled:true,calendarId:'work-test',keyword:'Work block',timeZone:'America/Los_Angeles'};
 const f=await harness(true,saved);
 const field=f.form.elements.namedItem('updateOverlaps');
 assert.equal(field.checked,true);
 assert.equal(f.writes.length,0, 'applying the default must not overwrite saved settings');
 assert.equal(f.form.elements.namedItem('importComments').checked,false);
 field.click();
 f.form.elements.namedItem('importComments').click();
 f.form.dispatchEvent(new f.dom.window.Event('submit',{cancelable:true}));
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(f.writes[0].workdayIntegration.updateOverlaps,false);
 assert.equal(f.writes[0].workdayIntegration.importComments,true);
 const reopened=await harness(true,f.writes[0].workdayIntegration);
 assert.equal(reopened.form.elements.namedItem('updateOverlaps').checked,false);
 assert.equal(reopened.form.elements.namedItem('importComments').checked,true);
 reopened.dom.window.close();f.dom.window.close();
});
