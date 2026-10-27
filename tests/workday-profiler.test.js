const test=require('node:test'),assert=require('node:assert/strict');
const profiler=require('../experiments/workday-request-profiler.js');
test('profiler records timing and size without retaining paths, credentials or response data',async()=>{
 let clock=0;
 const p=profiler.create({timing:{now:()=>++clock,getEntriesByName:()=>[]},fetcher:async()=>({ok:true,status:200,text:async()=>'{"private":"employee data"}'})});
 const response=await p.fetcher('https://example.test/secret-path',{method:'POST',body:new URLSearchParams({_eventId_validate:'private-field',sessionSecureToken:'secret-token'})});
 assert.deepEqual(await response.json(),{private:'employee data'});
 assert.equal(p.measurements[0].kind,'validate');assert.equal(p.measurements[0].total,3);
 assert.equal(p.measurements[0].parse,1);assert.ok(p.measurements[0].decodedBytes>0);
 assert.doesNotMatch(JSON.stringify(p.measurements),/secret|employee|private/);
});
