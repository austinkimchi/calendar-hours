const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const core=require('../extension/workday-core.js');
function harness(settings){let listener;const reads=[],opened=[];const chrome={commands:{onCommand:{addListener(){}}},runtime:{getURL:p=>`chrome-extension://example/${p}`,onInstalled:{addListener(){}},onMessage:{addListener(f){listener=f}}},tabs:{create:async o=>opened.push(o)},storage:{sync:{get:async()=>({workdayIntegration:settings})}}};
vm.runInNewContext(fs.readFileSync('extension/background.js','utf8'),{chrome,URL,console,setTimeout,globalThis:{CalendarHoursWorkday:core,CalendarHoursOAuth:{status:async()=>({calendarListAccess:true}),getAccessToken:async()=>'private-test-token',connectWorkday:async()=>({connected:true})},CalendarHoursWorkdayApi:{listEvents:async input=>{reads.push(input);return []},listCalendars:async()=>[]}}});
return {reads,opened,send:(message,sender)=>new Promise(resolve=>listener(message,sender,resolve))};}
const sender={tab:{id:1},url:'https://www.myworkday.com/example/enter-time'};
const settings={enabled:true,calendarId:'chosen',keyword:'Work',timeZone:'UTC'};
test('Workday events require a trusted tab and a one-day or seven-day range',async()=>{
 const h=harness(settings),m={type:'CALENDAR_HOURS_WORKDAY_EVENTS',dates:['2026-10-19']};
 for(const bad of [{url:sender.url},{tab:{id:1},url:'https://www.myworkday.com.evil.test/x'},{tab:{id:1},url:'https://calendar.google.com/calendar/'}]) assert.equal((await h.send(m,bad)).ok,false);
 assert.equal((await h.send({...m,dates:['2026-10-19','2026-10-21']},sender)).ok,false);assert.equal(h.reads.length,0);
 const good=await h.send(m,sender);assert.equal(good.ok,true);assert.equal(good.accessToken,undefined);assert.equal(h.reads[0].settings.calendarId,'chosen');
});
test('first use leads to setup and settings hash is trusted, other extension pages cannot connect',async()=>{
 const h=harness({});assert.equal((await h.send({type:'CALENDAR_HOURS_WORKDAY_EVENTS',dates:['2026-10-19']},sender)).needsSetup,true);
 assert.equal((await h.send({type:'CALENDAR_HOURS_WORKDAY_SETUP'},sender)).ok,true);assert.equal(h.opened[0].url,'chrome-extension://example/options.html#workday');
 assert.equal((await h.send({type:'CALENDAR_HOURS_WORKDAY_CALENDARS'},{url:'chrome-extension://example/options.html#workday'})).ok,true);
 assert.equal((await h.send({type:'CALENDAR_HOURS_WORKDAY_CONNECT'},sender)).ok,false);
 assert.equal((await h.send({type:'CALENDAR_HOURS_WORKDAY_CONNECT'},{url:'chrome-extension://example/untrusted.html'})).ok,false);
});
