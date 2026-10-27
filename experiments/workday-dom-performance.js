/* Comparison harness: uses the current adapter's field setters and 100 ms
 * polling cadence. Adds the same unsaved +1 minute/restore validation probe
 * as the request experiment. No extension registration or automatic runs. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CalendarHoursDomExperiment = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  async function run({ doc, adapter, core, target, now = () => performance.now() }) {
    const start = now(), phases = {}, base = adapter.readView(doc, core);
    const snapshot = () => JSON.stringify(adapter.readExisting(doc, base.dates).map(({element,...entry}) => entry));
    const before = snapshot();
    const matches = adapter.readExisting(doc, base.dates).filter(e => e.date === target.date && e.start === target.start && e.end === target.end && e.type === target.type && e.status === "Not Submitted");
    if (matches.length !== 1 || doc.querySelector('[role="dialog"][aria-modal="true"]')) throw new Error("Expected one draft and no open form");
    if (adapter.readExisting(doc,base.dates).some(e => e.eventId !== matches[0].eventId && e.date === target.date && e.start < target.end+1 && e.end > target.start)) throw new Error("Probe would overlap another entry");
    const visible = e => e.getClientRects().length > 0;
    async function wait(test) {
      const until = Date.now()+15000;
      while (Date.now()<until) { const value = test(); if(value) return value; await new Promise(r=>setTimeout(r,100)); }
      throw new Error("Workday probe timed out; inspect the open form");
    }
    async function phase(name, fn) { const t=now(); const result=await fn(); phases[name]=now()-t; return result; }
    let dialog;
    const input = name => {
      const found = [...dialog.querySelectorAll("input,textarea")].filter(e=>adapter.label(e)===name&&!e.disabled);
      if(found.length!==1) throw new Error(`Missing ${name}`); return found[0];
    };
    const button = name => {
      const found=[...dialog.querySelectorAll("button")].filter(e=>adapter.label(e)===name&&!e.disabled&&visible(e));
      if(found.length!==1)throw new Error(`Missing ${name}`);return found[0];
    };
    const amount = () => {
      const amounts=[...dialog.querySelectorAll('[data-automation-id="numericText"]')].filter(visible);
      return amounts.length===1 ? Number(amounts[0].textContent) : NaN;
    };
    let saveAttempted=false;
    try {
      await phase("open", async()=>{
        matches[0].element.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"});
        matches[0].element.click();
        dialog=await wait(()=>[...doc.querySelectorAll('[role="dialog"]')].find(e=>visible(e)&&adapter.label(e)==="Enter Time"));
        await wait(()=>{try{return input("In").value&&input("Out").value&&button("OK")&&Math.abs(amount()*60-(target.end-target.start))<0.001}catch{return false}});
        button("Delete"); // Confirms an existing draft. Never invoked.
        if(![...dialog.querySelectorAll('[data-automation-id="promptOption"]')].some(e=>adapter.label(e)==="Not Submitted"))throw new Error("Expected an unsubmitted draft");
        const [y,m,d]=target.date.split("-").map(Number);
        if(!dialog.textContent.includes(`${m}/${d}/${y}`))throw new Error("Unexpected date");
        const normalized=s=>s.toUpperCase().replace(/\s/g,"").replace(/^0(?=\d:)/,"");
        if(normalized(input("In").value)!==normalized(core.clock(target.start))||normalized(input("Out").value)!==normalized(core.clock(target.end)))throw new Error("Unexpected form times");
      });
      async function validate(end){adapter.setInput(input("Out"),core.clock(end));await wait(()=>Math.abs(amount()*60-(end-target.start))<0.001);}
      await phase("validateProbe",()=>validate(target.end+1));
      await phase("validateRestore",()=>validate(target.end));
      if(snapshot()!==before)throw new Error("Calendar changed during probe");
      await phase("saveAndRender",async()=>{
        button("OK").click(); saveAttempted=true;
        await wait(()=>!dialog.isConnected);
        await wait(()=>!matches[0].element.isConnected&&snapshot()===before&&adapter.readExisting(doc,base.dates).length>0);
        // With unchanged values, the old calendar also matches. Require its
        // replacement so this benchmark includes the actual server refresh.
      });
      return {phases,total:now()-start,entriesVerified:adapter.readExisting(doc,base.dates).length,savedOriginalValues:true};
    }catch(error){
      if(!saveAttempted&&dialog?.isConnected){
        try{button("Cancel").click();await wait(()=>!dialog.isConnected)}catch{error.message+="; inspect and cancel the unsaved form"}
      }
      throw error;
    }
  }
  return {run};
});
