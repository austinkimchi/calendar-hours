const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');const {JSDOM}=require('jsdom');
async function harness(available=true){const dom=new JSDOM(fs.readFileSync('extension/options.html','utf8'),{runScripts:'outside-only',url:'https://extension.test/options.html#workday'}),writes=[];
 dom.window.HTMLElement.prototype.scrollIntoView=function(){};
 dom.window.chrome={storage:{sync:{get:async()=>({}),set:async v=>writes.push(v)}},runtime:{sendMessage:async()=>available?{ok:true,calendars:[{id:'work-test',name:'Work',timeZone:'America/Los_Angeles'}]}:{ok:false,needsSetup:true,reason:'Reconnect Google Calendar'}}};
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
