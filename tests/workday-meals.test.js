const test=require('node:test'),assert=require('node:assert/strict');
const wd=require('../extension/workday-core'),core=require('../extension/core');
const settings={enabled:true,calendarId:'work',keyword:'SCU Block',timeZone:'America/Los_Angeles',calendarMeals:true};
const date='2026-10-19';
const event=(a,b,summary='SCU Block')=>({summary,start:{dateTime:`${date}T${a}:00-07:00`},end:{dateTime:`${date}T${b}:00-07:00`}});
const plan=(events,changes={},existing=[])=>wd.plan({events,settings:{...settings,...changes},dates:[date],core,existing,now:Infinity});
const times=r=>r.add.map(b=>[b.start,b.end,b.outReason]);
const draft=(start,end,extra={})=>({date,start,end,type:'Hours',status:'Not Submitted',eventId:'draft',...extra});
test('meal settings default off; defaults and legacy calendar migration are stable',()=>{
 const s=wd.settingsFrom({calendarId:'work'});
 assert.equal(s.calendarMeals,false);assert.equal(s.autoMeal,false);assert.equal(s.mealAfterHours,5);assert.equal(s.mealDurationMinutes,30);
 assert.deepEqual(s.mealWords,['Breakfast','Lunch','Dinner','Meal Break']);assert.deepEqual(s.calendarIds,['work']);
 assert.deepEqual(wd.settingsFrom({calendarId:'old',calendarIds:['a','a','b']}).calendarIds,['a','b']);
 assert.equal(wd.configured({...settings,calendarIds:[]}),false);
 assert.equal(wd.settingsFrom({mealAfterHours:-1,mealDurationMinutes:Infinity}).mealAfterHours,5);
});
test('disabled meal features leave work entries unchanged',()=>{
 assert.deepEqual(times(plan([event('09:00','17:00'),event('12:00','12:30','Lunch')],{calendarMeals:false})),[[540,1020,'Out']]);
});
test('independent default phrases match case-insensitively and create separate meal rows',()=>{
 for(const phrase of ['BREAKFAST','lunch with coworkers','Dinner','meal BREAK']) {
  assert.deepEqual(times(plan([event('09:00','17:00'),event('12:00','12:30',phrase)])),[[540,720,'Out'],[720,750,'Meal'],[750,1020,'Out']]);
 }
 assert.deepEqual(times(plan([event('09:00','17:00'),event('12:00','12:30','Luncheon')])),[[540,1020,'Out']]);
});
test('custom meal words are independent; a title matching work and meal is a meal row',()=>{
 assert.deepEqual(times(plan([event('09:00','17:00'),event('12:00','13:00','SCU Block - Pause')],{mealWords:['Pause']})),[[540,720,'Out'],[720,780,'Meal'],[780,1020,'Out']]);
 assert.deepEqual(times(plan([event('12:00','13:00','Lunch')])),[]);
});
test('meal in an existing calendar gap creates a meal row without moving surrounding work',()=>{
 assert.deepEqual(times(plan([event('09:00','12:00'),event('13:00','17:00'),event('12:00','13:00','Lunch')])),[[540,720,'Out'],[720,780,'Meal'],[780,1020,'Out']]);
});
test('duplicate/overlapping meals across calendars form one meal interval',()=>{
 const r=plan([event('09:00','17:00'),event('09:00','17:00'),event('12:00','12:30','Lunch'),event('12:15','13:00','Meal Break')]);
 assert.deepEqual(times(r),[[540,720,'Out'],[720,780,'Meal'],[780,1020,'Out']]);
});
test('edge meals retain their event times without overlapping work',()=>{
 assert.deepEqual(times(plan([event('09:00','17:00'),event('08:30','09:30','Breakfast'),event('16:30','17:30','Dinner')])),[[510,570,'Meal'],[570,990,'Out'],[990,1050,'Meal']]);
 const full=plan([event('09:00','10:00'),event('08:00','11:00','Breakfast')]);assert.deepEqual(times(full),[[480,660,'Meal']]);
});
test('automatic default meal occurs after five hours, for thirty minutes',()=>{
 assert.deepEqual(times(plan([event('09:00','17:00')],{calendarMeals:false,autoMeal:true})),[[540,840,'Out'],[840,870,'Meal'],[870,1020,'Out']]);
 assert.deepEqual(times(plan([event('09:00','12:00'),event('13:00','17:00')],{autoMeal:true,mealAfterHours:4,mealDurationMinutes:60})),[[540,720,'Out'],[780,840,'Out'],[840,900,'Meal'],[900,1020,'Out']]);
});
test('automatic meal at a natural gap fills that gap with a meal row',()=>{
 assert.deepEqual(times(plan([event('09:00','14:00'),event('14:30','17:00')],{autoMeal:true})),[[540,840,'Out'],[840,870,'Meal'],[870,1020,'Out']]);
});
test('explicit meals take precedence over automatic fallback for that day',()=>{
 assert.deepEqual(times(plan([event('09:00','17:00'),event('12:00','13:00','Lunch')],{autoMeal:true})),[[540,720,'Out'],[720,780,'Meal'],[780,1020,'Out']]);
 // An unrelated breakfast before work does not suppress the automatic meal.
 assert.deepEqual(times(plan([event('09:00','17:00'),event('07:00','07:30','Breakfast')],{autoMeal:true})),[[540,840,'Out'],[840,870,'Meal'],[870,1020,'Out']]);
});
test('short days and shifts ending at the threshold do not get automatic meals',()=>{
 for(const end of ['13:00','14:00','14:15','14:30']) assert.equal(plan([event('09:00',end)],{autoMeal:true}).add.length,1);
});
test('one automatic meal per Workday day, independent of source/calendar timezone',()=>{
 const r=wd.plan({events:[event('09:00','23:00'),{summary:'SCU Block',start:{dateTime:'2026-10-20T16:00:00Z'},end:{dateTime:'2026-10-21T00:00:00Z'}}],
 settings:{...settings,autoMeal:true},dates:Array.from({length:7},(_,i)=>wd.addDays(date,i)),core,now:Infinity});
 assert.equal(r.add.filter(b=>b.outReason==='Meal').length,2);
});
test('exact existing draft is split by updating it first and then adding the remainder',()=>{
 const r=plan([event('09:00','17:00'),event('12:00','12:30','Lunch')],{},[draft(540,1020)]);
 assert.deepEqual(r.update.map(b=>[b.start,b.end,b.outReason,b.previous.eventId]),[[540,720,'Out','draft']]);
 assert.deepEqual(times(r),[[720,750,'Meal'],[750,1020,'Out']]);assert.equal(r.conflicts.length,0);
});
test('splitting refuses submitted, wrong type, duplicate and inexact original drafts',()=>{
 for(const entries of [[draft(540,1020,{status:'Submitted'})],[draft(540,1020,{type:'Vacation'})],[draft(540,1020),draft(600,700,{eventId:'other'})],[draft(540,1000)]]) {
  const r=plan([event('09:00','17:00'),event('12:00','12:30','Lunch')],{},entries);assert.equal(r.update.length,0);assert.equal(r.add.length,0);assert.equal(r.conflicts.length,3);
 }
 const r=plan([event('09:00','17:00'),event('12:00','12:30','Lunch')],{updateOverlaps:false},[draft(540,1020)]);assert.equal(r.update.length,0);
});
test('exact entries with unknown or changed Out Reason must be inspected, not silently skipped',()=>{
 const events=[event('09:00','12:00'),event('12:00','13:00','Lunch')];
 assert.equal(plan(events,{},[draft(540,720)]).update.length,1);
 assert.equal(plan(events,{},[draft(540,720,{outReason:'Meal'})]).update.length,1);
 assert.equal(plan(events,{},[draft(540,720,{outReason:'Out'})]).skipped[0].reason,'already-entered');
 assert.equal(plan(events,{},[draft(540,720,{status:'Submitted'})]).conflicts.length,1);
});
test('invalid/ambiguous timed meals fail before any entries are planned',()=>{
 for(const meal of [{...event('12:00','13:00','Lunch'),end:{dateTime:'invalid'}},{...event('23:00','23:30','Dinner'),end:{dateTime:'2026-10-20T00:30:00-07:00'}}]) assert.throws(()=>plan([event('09:00','17:00'),meal]),/meal|Meal/i);
 const r=plan([event('09:00','17:00'),{...event('12:00','13:00','Lunch'),status:'cancelled'}]);assert.deepEqual(times(r),[[540,1020,'Out']]);
});

test('unfinished meal rows follow includeFuture without extending completed work',()=>{
 const args={events:[event('10:00','12:00'),event('12:00','12:30','Lunch'),event('12:30','17:00')],dates:[date],settings,core,now:Date.parse(`${date}T12:15:00-07:00`)};
 const result=wd.plan(args);assert.deepEqual(times(result),[[600,720,'Out']]);assert.equal(result.skipped.filter(b=>b.reason==='future').length,2);
 assert.deepEqual(times(wd.plan({...args,settings:{...settings,includeFuture:true}})),[[600,720,'Out'],[720,750,'Meal'],[750,1020,'Out']]);
});
test('meal descriptions belong to meal rows and default comments stay empty',()=>{
 const events=[{...event('09:00','17:00'),description:'Work note'},{...event('12:00','12:30','Lunch'),description:'Meal note'}];
 assert.deepEqual(plan(events,{importComments:true}).add.map(b=>b.descriptions),[['Work note'],['Meal note'],['Work note']]);
 assert.ok(plan(events).add.every(b=>b.descriptions.length===0));
});
test('a meal wholly inside a work gap is imported and suppresses automatic fallback',()=>{
 assert.deepEqual(times(plan([event('09:00','12:00'),event('13:00','17:00'),event('12:15','12:45','Lunch')],{autoMeal:true})),[[540,720,'Out'],[735,765,'Meal'],[780,1020,'Out']]);
});
test('completed meal in a gap is associated before unfinished work is excluded',()=>{
 const args={events:[event('09:00','12:00'),event('12:15','12:45','Lunch'),event('13:00','17:00')],dates:[date],settings,core,now:Date.parse(`${date}T12:45:00-07:00`)};
 const result=wd.plan(args);
 assert.deepEqual(times(result),[[540,720,'Out'],[735,765,'Meal']]);
 assert.equal(result.skipped.filter(b=>b.reason==='future').length,1);
});
