const test=require('node:test'),assert=require('node:assert/strict');
const wd=require('../extension/workday-core'),core=require('../extension/core');
const date='2026-10-19';
const settings={enabled:true,calendarId:'work',keyword:'Work block',timeZone:'UTC',calendarMeals:true,autoMeal:true,mealWords:['Lunch','Meal']};
const event=(a,b,summary='Work block',description='')=>({summary,description,start:{dateTime:`${date}T${a}:00Z`},end:{dateTime:`${date}T${b}:00Z`}});
const plan=(events,changes={},existing=[])=>wd.plan({events,settings:{...settings,...changes},dates:[date],core,existing,now:Infinity});
test('saved meal prototype flags cannot enable automation; calendar migration still works',()=>{
 const s=wd.settingsFrom(settings);
 assert.equal(s.calendarMeals,false);assert.equal(s.autoMeal,false);assert.equal(wd.configured(s),true);
 assert.deepEqual(s.calendarIds,['work']);
 assert.deepEqual(wd.settingsFrom({calendarId:'old',calendarIds:['a','a','b']}).calendarIds,['a','b']);
 assert.equal(wd.configured({...settings,calendarIds:[]}),false);
});
test('meal titles, descriptions and prior duration settings cannot shorten work in this release',()=>{
 for(const changes of [{calendarMeals:true,autoMeal:false},{calendarMeals:false,autoMeal:true},{calendarMeals:true,autoMeal:true,mealAfterHours:5,mealDurationMinutes:30}]){
  const r=plan([event('10:00','18:00','Work block','Meal'),event('12:00','12:30','Lunch')],changes);
  assert.deepEqual(r.add.map(b=>[b.start,b.end]),[[600,1080]]);
  assert.equal(r.add[0].mealSource,undefined);assert.equal(r.add[0].outReason,undefined);
 }
});
test('existing calendar gaps remain gaps and exact drafts are not changed for their meal reason',()=>{
 const events=[event('10:00','12:00'),event('12:00','12:30','Lunch'),event('12:30','18:00')];
 const r=plan(events);assert.deepEqual(r.add.map(b=>[b.start,b.end]),[[600,720],[750,1080]]);
 const existing=r.add.map((b,i)=>({...b,type:'Hours',eventId:`draft-${i}`,status:'Not Submitted',outReason:'Meal'}));
 const rerun=plan(events,{},existing);assert.equal(rerun.add.length,0);assert.equal(rerun.update.length,0);assert.equal(rerun.skipped.length,2);
});
test('nonmatching invalid meals are ignored and old split drafts are not merged or deleted',()=>{
 const r=plan([event('10:00','18:00'),{...event('12:00','12:30','Lunch'),end:{dateTime:'invalid'}}]);assert.equal(r.add.length,1);
 const existing=[{date,start:600,end:900},{date,start:930,end:1080}].map((b,i)=>({...b,type:'Hours',eventId:`draft-${i}`,status:'Not Submitted'}));
 const conflict=plan([event('10:00','18:00')],{},existing);assert.equal(conflict.add.length,0);assert.equal(conflict.update.length,0);assert.equal(conflict.conflicts.length,1);
});
