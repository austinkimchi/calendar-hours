const test=require('node:test');const assert=require('node:assert/strict');
const api=require('../extension/workday-api.js');const core=require('../extension/workday-core.js');
test('calendar picker paginates and only returns readable, non-deleted calendars',async()=>{
  const urls=[];const calendars=await api.listCalendars({accessToken:'test',fetcher:async(url,opts)=>{
    urls.push(new URL(url));assert.equal(opts.headers.Authorization,'Bearer test');
    return {ok:true,json:async()=>urls.length===1?{items:[{id:'a',summary:'A'},{id:'x',deleted:true}],nextPageToken:'second'}:{items:[{id:'b',summary:'B',timeZone:'UTC'}]}};
  }});
  assert.deepEqual(calendars.map(c=>c.id),['a','b']);assert.equal(urls[0].searchParams.get('minAccessRole'),'reader');assert.equal(urls[1].searchParams.get('pageToken'),'second');
});
test('events read only the configured calendar and exact displayed dates, expanding recurrences and paging',async()=>{
  const urls=[];const result=await api.listEvents({accessToken:'test',core,settings:{calendarId:'work/test',timeZone:'America/Los_Angeles'},dates:['2026-11-01'],fetcher:async url=>{
    urls.push(new URL(url));return {ok:true,json:async()=>urls.length===1?{items:[{summary:'Example',id:'private-id',attendees:['not needed'],start:{dateTime:'2026-11-01T09:00:00-08:00'},end:{dateTime:'2026-11-01T10:00:00-08:00'}}],nextPageToken:'p2'}:{items:[]}};
  }});
  assert.equal(urls[0].pathname,'/calendar/v3/calendars/work%2Ftest/events');
  assert.equal(urls[0].searchParams.get('timeMin'),'2026-11-01T07:00:00.000Z');
  assert.equal(urls[0].searchParams.get('timeMax'),'2026-11-02T08:00:00.000Z');
  assert.equal(urls[0].searchParams.get('singleEvents'),'true');assert.equal(urls[0].searchParams.get('showDeleted'),'false');
  assert.equal(urls[1].searchParams.get('pageToken'),'p2');assert.equal(result[0].id,undefined);assert.equal(result[0].attendees,undefined);
});
test('revoked access and removed calendars lead back to setup',async()=>{
  for(const status of [401,403,404]) await assert.rejects(api.listCalendars({accessToken:'test',fetcher:async()=>({ok:false,status})}),e=>e.needsSetup===true);
  await assert.rejects(api.listCalendars({accessToken:'test',fetcher:async()=>({ok:false,status:500})}),e=>!e.needsSetup);
});
test('Calendar descriptions reach meal detection independently of comment importing',async()=>{
  for(const importComments of [false,true]) for(const calendarMeals of [false,true]) {
    const events=await api.listEvents({accessToken:'test',core,settings:{calendarId:'chosen',timeZone:'UTC',importComments,calendarMeals},dates:['2026-10-19'],fetcher:async()=>({ok:true,json:async()=>({items:[{summary:'Work block',description:'Project notes',attendees:['not needed']}]})})});
    assert.equal(events[0].description,importComments||calendarMeals?'Project notes':undefined);
    assert.equal(events[0].attendees,undefined);
  }
});
test('multiple calendars are paginated independently with at most three concurrent reads',async()=>{
 let active=0,peak=0;const calls=[];
 const events=await api.listEvents({accessToken:'test',core,settings:{calendarIds:['a','b','c','d','a'],timeZone:'UTC'},dates:['2026-10-19'],fetcher:async url=>{
  active++;peak=Math.max(peak,active);const u=new URL(url),id=u.pathname.split('/').at(-2);calls.push([id,u.searchParams.get('pageToken')]);
  await new Promise(r=>setTimeout(r,5));active--;
  return {ok:true,json:async()=>({items:[{summary:id}],...(id==='a'&&!u.searchParams.has('pageToken')?{nextPageToken:'a2'}:{})})};
 }});
 assert.equal(peak,3);assert.equal(calls.length,5);assert.deepEqual(calls.filter(x=>x[0]==='a'),[['a',null],['a','a2']]);assert.deepEqual(events.map(e=>e.summary),['a','a','b','c','d']);
});
test('one missing meal calendar aborts the complete multi-calendar read',async()=>{
 await assert.rejects(api.listEvents({accessToken:'test',core,settings:{calendarIds:['work','meals'],timeZone:'UTC'},dates:['2026-10-19'],fetcher:async url=>
  url.includes('/meals/')?{ok:false,status:404}:{ok:true,json:async()=>({items:[{summary:'Work block'}]})}}),e=>e.needsSetup===true);
});
