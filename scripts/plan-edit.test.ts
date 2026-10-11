import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/edit-plan.ts';
test('AI receives actual Sunday dates and only returns safe slots inside the range', async()=>{
 const original=globalThis.fetch;let prompt='';
 const safe={id:'fish',name:'Fish',ingredients:'[]',primary_protein:'fish',total_time:20};
 const db:any={prepare:()=>({bind(){return this;},first:async()=>({diet:'[]'}),all:async()=>({results:[safe]})})};
 globalThis.fetch=async (_url,options)=>{
  prompt=JSON.parse(options!.body as string).contents[0].parts[0].text;
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify([
   {day_of_week:7,slot:'dinner',recipe_id:'fish'},
   {day_of_week:1,slot:'lunch',recipe_id:'fish'},
   {day_of_week:4,slot:'dinner',recipe_id:'fish'},
   {day_of_week:2,slot:'lunch',recipe_id:'invented'},
   {day_of_week:2.5,slot:'dinner',recipe_id:'fish'}])}]}}]});
 };
 try{
  const response=await onRequestPost({env:{DB:db,GEMINI_API_KEY:'test'},request:new Request('https://groceree.test/api/edit-plan',{method:'POST',body:JSON.stringify({plan:[],instruction:'more fish',start_date:'2026-10-11',plan_days:4})})} as any);
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.changes.length,2);
  assert.match(prompt,/2026-10-11 to 2026-10-14/);assert.match(prompt,/2026-10-12: weekday 1/);
 }finally{globalThis.fetch=original;}
});
