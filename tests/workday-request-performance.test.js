const test = require('node:test');
const assert = require('node:assert/strict');
const experiment = require('../experiments/workday-request-performance.js');
const target = {date:'2026-10-27',start:600,end:720,type:'Hours'};
const calendarUrl='https://www.myworkday.com/example/inst/example/rel-task/example.htmld';
const date={Y:'2026',M:'10',D:'27'};
const clock=end=>({H:String(Math.floor(end/60)),m:String(end%60),s:'00'});
const copy=x=>structuredClone(x);
function calendar(end=720){return {widget:'root',sessionSecureToken:'synthetic-calendar-token',body:{widget:'calendar',consolidatedList:{children:[{
 timedEvent:true,startMoment:{value:{...date,...clock(600)}},endMoment:{value:{...date,...clock(end)}},title:{value:'Hours'},style:{value:'saved'},quantity:{value:(end-600)/60},
 editButton:{children:[{label:'Edit',httpMethod:'POST',uri:'/example/button/c10/20/30'}]}
}]}}};}
function form(){return {widget:'root',mode:'EDIT',title:{text:'Enter Time'},flowExecutionKey:'fresh-flow',sessionSecureToken:'synthetic-form-token',requestUri:'/example/flowController',body:{id:'100',children:[
 {id:'date',label:'Date',value:date},{id:'status',label:'Status',instances:[{text:'Not Submitted'}]},
 {id:'type',label:'Time Type',instances:[{text:'Hours'}]},
 {id:'101/wd:In_Time',label:'In',value:clock(600)},
 {id:'101/wd:Out_Time',label:'Out',widget:'timeInput',value:clock(720),remoteValidate:true},
 {id:'101/wd:Quantity',label:'Hours',value:2},
 {id:'102/wd:OK',label:'OK',propertyName:'wd:OK'},{id:'102/wd:Delete',label:'Delete'},
 {id:'103/wd:Comment',label:'Comment',value:'Keep this comment'}
]}};}
function validation(end){return {widget:'changeSummary',flowKey:`validated-${end}`,changes:[
 {widget:'update',nodeId:'101/wd:Out_Time',node:{value:clock(end)}},
 {widget:'update',nodeId:'101/wd:Quantity',node:{value:(end-600)/60}}
]};}
function fixture(overrides={}){
 const requests=[];let reads=0;
 const fetcher=async(url,options)=>{
  const params=options.body?Object.fromEntries(options.body):{};
  requests.push({url,options,params});
  let body;
  if(!options.method){reads++;body=reads===1?overrides.calendar||calendar():overrides.after||calendar()}
  else if(url.includes('/button/'))body=overrides.form||form();
  else if(params._eventId_validate){const end=Number(params['101/wd:Out_Time_H'])*60+Number(params['101/wd:Out_Time_m']);body=overrides.validation?.(end)||validation(end)}
  else if(params._eventId_submit){if(overrides.saveError)throw new Error('Network disconnected');body=overrides.saved||{mode:'CONFIRM',microConclusion:true,title:{text:'Time Block In/Out Saved'}}}
  else if(params._eventId_cancel)body={mode:'CONFIRM'};
  else assert.fail('Unexpected request');
  return {ok:true,json:async()=>copy(body)};
 };
 let tick=0;
 return {requests,probe:experiment.create({calendarUrl,origin:'https://www.myworkday.com',clientVersion:'test',fetcher,now:()=>++tick,uuid:()=>`request-${tick}`})};
}
test('request probe uses fresh identifiers, verifies both validations, saves only original values and rereads calendar',async()=>{
 const f=fixture(),result=await f.probe.run(target);
 assert.equal(result.savedOriginalValues,true);assert.equal(result.entriesVerified,1);
 assert.equal(f.requests.length,6);
 const [read,open,change,restore,save,verify]=f.requests;
 assert.equal(open.params.sessionSecureToken,'synthetic-calendar-token');
 assert.equal(change.params._flowExecutionKey,'fresh-flow');
 assert.equal(restore.params._flowExecutionKey,'validated-721');
 assert.equal(save.params._flowExecutionKey,'validated-720');
 assert.equal(save.params.sessionSecureToken,'synthetic-form-token');
 assert.equal(save.params._eventId_submit,'100');
 assert.match(save.params['change-summary'],/<wd:OK Ref="102\/wd:OK"/);
 assert.doesNotMatch(save.params['change-summary'],/Out_Time|Comment|Delete|Review/);
 assert.equal(read.url,verify.url);assert.equal(read.options.redirect,'error');
 assert.ok(f.requests.every(r=>r.options.credentials==='same-origin'));
});
test('wrong date, original time, type, status, new-entry form, and duplicate controls fail closed and cancel before saving',async()=>{
 const mutations=[
  f=>experiment.field(f,'Date').value={...date,D:'28'},
  f=>experiment.field(f,'Out').value=clock(725),
  f=>experiment.field(f,'Time Type').instances=[{text:'Other'}],
  f=>experiment.field(f,'Status').instances=[{text:'Submitted'}],
  f=>f.body.children=f.body.children.filter(n=>n.label!=='Delete'),
  f=>f.body.children.push(copy(experiment.field(f,'OK')))
 ];
 for(const mutate of mutations){const model=form();mutate(model);const f=fixture({form:model});await assert.rejects(f.probe.run(target));assert.equal(f.requests.at(-1).params._eventId_cancel,'Cancel');assert.equal(f.requests.some(r=>r.params._eventId_submit),false)}
});
test('validation errors, altered times, wrong hours, unexpected response changes and missing flow key never save',async()=>{
 for(const mutate of [
  r=>r.changes[0].node.error='Invalid time',
  r=>r.validationErrors=['Invalid time'],
  r=>r.changes[0].node.value=clock(730),
  r=>r.changes[1].node.value=20,
  r=>r.changes.push({widget:'dialog',node:{}}),
  r=>delete r.flowKey
 ]){
  const f=fixture({validation:end=>{const r=validation(end);mutate(r);return r}});
  await assert.rejects(f.probe.run(target));assert.equal(f.requests.some(r=>r.params._eventId_submit),false);assert.equal(f.requests.at(-1).params._eventId_cancel,'Cancel');
 }
});
test('ambiguous save is never retried, cancelled or followed by a second save',async()=>{
 for(const overrides of [{saveError:true},{saved:{mode:'EDIT'}},{saved:{mode:'CONFIRM',microConclusion:true,title:{text:'Unexpected confirmation'}}}]){
  const f=fixture(overrides);await assert.rejects(f.probe.run(target));
  assert.equal(f.requests.filter(r=>r.params._eventId_submit).length,1);
  assert.equal(f.requests.at(-1).params._eventId_submit,'100');
  assert.equal(f.requests.some(r=>r.params._eventId_cancel),false);
 }
});
test('a changed calendar after a successful save is reported as uncertain without retry',async()=>{
 const f=fixture({after:calendar(721)});await assert.rejects(f.probe.run(target),/Calendar changed/);
 assert.equal(f.requests.filter(r=>r.params._eventId_submit).length,1);
});
test('foreign origin, unrelated endpoint, query parameters and unsafe action routes are rejected',async()=>{
 for(const url of ['https://example.com/example/inst/x/rel-task/y.htmld','https://www.myworkday.com/example/flowController.htmld',calendarUrl+'?token=secret'])assert.throws(()=>experiment.create({calendarUrl:url,origin:'https://www.myworkday.com'}));
 for(const uri of ['https://example.com/steal','/example/delete/20','/another/button/c1/2/3']){
  const model=calendar();model.body.consolidatedList.children[0].editButton.children[0].uri=uri;
  const f=fixture({calendar:model});await assert.rejects(f.probe.run(target),/endpoint/);assert.equal(f.requests.length,1);
 }
});
test('overlap, ambiguous target and unsafe one-minute probe are rejected before opening any form',async()=>{
 const model=calendar();model.body.consolidatedList.children.push(copy(model.body.consolidatedList.children[0]));
 const f=fixture({calendar:model});await assert.rejects(f.probe.run(target));assert.equal(f.requests.length,1);
 for(const end of [600,1439,1440,720.5]){const g=fixture();await assert.rejects(g.probe.run({...target,end}));assert.equal(g.requests.length,0)}
});
test('one probe instance rejects concurrent runs',async()=>{
 const f=fixture();const first=f.probe.run(target);await assert.rejects(f.probe.run(target),/already running/);await first;
});
