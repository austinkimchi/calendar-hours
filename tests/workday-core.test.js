const test = require('node:test');
const assert = require('node:assert/strict');
const wd = require('../extension/workday-core.js');
const core = require('../extension/core.js');
const settings = {enabled:true,calendarId:'work@example.test',keyword:'Work block',timeZone:'America/Los_Angeles'};
const dates = ['2026-10-19'];
const event = (start,end,summary='Work block (hours)') => ({summary,start:{dateTime:`2026-10-19T${start}:00-07:00`},end:{dateTime:`2026-10-19T${end}:00-07:00`}});
const plan = (events,more={}) => wd.plan({events,dates,settings,core,now:Date.parse('2026-10-27T00:00:00Z'),...more});

test('import uses existing whole-phrase matching and exact intervals, preserving breaks',()=>{
  const r=plan([event('09:07','12:45'),event('13:45','16:02','WORK BLOCK (2.28 hours)'),event('16:10','17:00','NotWork block'),event('17:00','18:00','Work blocker')]);
  assert.deepEqual(r.add.map(b=>[b.start,b.end]),[[547,765],[825,962]]);
});
test('existing equal entries are skipped; edits and partial overlaps require correction',()=>{
  const r=plan([event('09:00','12:00'),event('13:00','15:00'),event('16:00','17:00')],{existing:[{date:dates[0],start:540,end:720,type:'Hours'},{date:dates[0],start:780,end:840,type:'Hours'}]});
  assert.equal(r.skipped[0].reason,'already-entered');assert.equal(r.conflicts.length,1);assert.equal(r.add.length,1);
});
test('overlap updates default on, respect an explicit off choice, and replace one unsubmitted entry',()=>{
  const existing=[{date:dates[0],start:780,end:900,type:'Hours',status:'Not Submitted',eventId:'draft-1'}];
  const events=[event('12:30','15:00')];
  assert.equal(wd.settingsFrom().updateOverlaps,true);
  assert.equal(wd.settingsFrom({updateOverlaps:false}).updateOverlaps,false);
  assert.equal(plan(events,{existing,settings:{...settings,updateOverlaps:false}}).update.length,0);
  const r=plan(events,{existing});
  assert.equal(r.add.length,0);assert.equal(r.conflicts.length,0);
  assert.deepEqual(r.update.map(b=>[b.start,b.end,b.previous.start,b.previous.eventId]),[[750,900,780,'draft-1']]);
  const rerun=plan(events,{existing:[{...existing[0],start:750}],settings:{...settings,updateOverlaps:true}});
  assert.equal(rerun.update.length,0);assert.equal(rerun.skipped[0].reason,'already-entered');
});
test('overlap updates refuse submitted, unknown, different-type and ambiguous entries',()=>{
  const entry={date:dates[0],start:780,end:900,type:'Hours',status:'Not Submitted',eventId:'draft-1'};
  const enabled={...settings,updateOverlaps:true};
  for(const patch of [{status:'Submitted'},{status:'Approved'},{status:''},{type:'Vacation'},{eventId:''}]) {
    const r=plan([event('12:30','15:00')],{existing:[{...entry,...patch}],settings:enabled});
    assert.equal(r.update.length,0);assert.equal(r.conflicts.length,1);
  }
  const split=plan([event('13:00','14:00'),event('14:00','15:00')],{existing:[entry],settings:enabled});
  assert.equal(split.update.length,0);assert.equal(split.conflicts.length,2);
  const merge=plan([event('12:30','15:00')],{existing:[{...entry,end:840},{...entry,eventId:'draft-2',start:840}],settings:enabled});
  assert.equal(merge.update.length,0);assert.equal(merge.conflicts.length,1);
  const exactAndOverlap=plan([event('13:00','15:00')],{existing:[entry,{...entry,eventId:'draft-2',start:840}],settings:enabled});
  assert.equal(exactAndOverlap.skipped.length,0);assert.equal(exactAndOverlap.conflicts.length,1);
});
test('descriptions are optional and overlapping source blocks combine unique notes',()=>{
  const events=[{...event('09:00','11:00'),description:'First note'},{...event('10:00','12:00'),description:'Second note'},{...event('10:30','11:30'),description:'First note'}];
  assert.equal(wd.settingsFrom().importComments,false);
  assert.deepEqual(plan(events).add[0].descriptions,[]);
  assert.deepEqual(plan(events,{settings:{...settings,importComments:true}}).add[0].descriptions,['First note','Second note']);
});
test('overlapping source blocks form a union, adjacent blocks remain separate',()=>{
  assert.deepEqual(plan([event('09:00','11:00'),event('10:00','12:00'),event('12:00','13:00')]).add.map(b=>[b.start,b.end]),[[540,720],[720,780]]);
});
test('cancelled, all-day and unfinished shifts are excluded by default',()=>{
  const r=plan([{...event('09:00','10:00'),status:'cancelled'},{summary:'Work block',start:{date:dates[0]},end:{date:'2026-10-20'}},event('12:00','13:00')],{now:Date.parse('2026-10-19T12:30:00-07:00')});
  assert.equal(r.add.length,0);assert.equal(r.skipped.length,1);
  assert.equal(plan([event('12:00','13:00')],{settings:{...settings,includeFuture:true},now:0}).add.length,1);
});
test('overnight and daylight-saving transition blocks are reported without guessed times',()=>{
  assert.equal(plan([{summary:'Work block',start:{dateTime:'2026-10-19T23:00:00-07:00'},end:{dateTime:'2026-10-20T01:00:00-07:00'}}]).warnings.length,1);
  const r=plan([{summary:'Work block',start:{dateTime:'2026-11-01T01:15:00-07:00'},end:{dateTime:'2026-11-01T01:45:00-08:00'}}],{dates:['2026-11-01'],now:Infinity});
  assert.equal(r.add.length,0);assert.equal(r.warnings.length,1);
});
test('displayed week, previous week and single day use their actual dates including year boundaries',()=>{
  const labels=['Sun, 12/27','Mon, 12/28','Tue, 12/29','Wed, 12/30','Thu, 12/31','Fri, 1/1','Sat, 1/2'];
  assert.deepEqual(wd.datesFromLabels('Dec 27, 2026 – Jan 2, 2027',labels),['2026-12-27','2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02']);
  assert.deepEqual(wd.datesFromLabels('Monday, October 19, 2026',['Mon, 10/19']),['2026-10-19']);
  assert.throws(()=>wd.validateDates(['2026-02-30']));assert.throws(()=>wd.validateDates(['2026-10-19','2026-10-20']));
});
test('query midnights follow DST rather than fixed 24-hour arithmetic',()=>{
  assert.equal(wd.midnight('2026-11-02',settings.timeZone)-wd.midnight('2026-11-01',settings.timeZone),25*3600000);
  assert.equal(wd.midnight('2026-03-09',settings.timeZone)-wd.midnight('2026-03-08',settings.timeZone),23*3600000);
  assert.equal(wd.clock(825),'1:45 PM');assert.equal(wd.configured({...settings,timeZone:'bad'}),false);
});

test('both occurrences of repeated DST clocks require manual entry even within one offset',()=>{
  for(const offset of ['-07:00','-08:00']) {
    const r=plan([{summary:'Work block',start:{dateTime:`2026-11-01T01:15:00${offset}`},end:{dateTime:`2026-11-01T01:45:00${offset}`}}],
      {dates:['2026-11-01'],now:Infinity});
    assert.equal(r.add.length,0);assert.equal(r.update.length,0);assert.equal(r.warnings.length,1);
  }
});

test('traveling device and source-event zones do not change the saved Workday zone or day',()=>{
  const old=process.env.TZ;
  try {
    for(const zone of ['UTC','Asia/Tokyo','America/New_York']) {
      process.env.TZ=zone;
      const r=plan([{summary:'Work block',start:{dateTime:'2026-10-20T01:00:00+09:00',timeZone:'Asia/Tokyo'},end:{dateTime:'2026-10-20T03:00:00+09:00',timeZone:'Asia/Tokyo'}}]);
      assert.deepEqual(r.add.map(b=>[b.date,b.start,b.end]),[['2026-10-19',540,660]]);
      assert.equal(wd.settingsFrom(settings).timeZone,'America/Los_Angeles');
      assert.equal(new Date(wd.midnight('2026-10-19',settings.timeZone)).toISOString(),'2026-10-19T07:00:00.000Z');
    }
  } finally {if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});

test('DST transition days allow ordinary unambiguous hours; spanning blocks are reported',()=>{
  for(const [date,offset] of [['2026-03-08','-07:00'],['2026-11-01','-08:00']]) {
    const r=plan([{summary:'Work block',start:{dateTime:`${date}T09:00:00${offset}`},end:{dateTime:`${date}T10:00:00${offset}`}}],{dates:[date],now:Infinity});
    assert.deepEqual(r.add.map(b=>[b.start,b.end]),[[540,600]]);assert.equal(r.warnings.length,0);
  }
  const r=plan([{summary:'Work block',start:{dateTime:'2026-10-18T23:00:00-07:00'},end:{dateTime:'2026-10-20T01:00:00-07:00'}}]);
  assert.equal(r.add.length,0);assert.equal(r.warnings.length,1);
});
