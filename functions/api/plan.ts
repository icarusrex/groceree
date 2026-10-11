import { json, uid, type Env } from './_helpers.ts';
import { validDate, weekOf, planDates } from '../../src/engine/planDates.ts';
const validSlot = (slot:any) => slot && Number.isInteger(slot.day_of_week) && slot.day_of_week>=1 && slot.day_of_week<=7 && ['lunch','dinner'].includes(slot.slot);

// The pointer, revision, metadata and items come from one database snapshot.
export const onRequestGet: PagesFunction<Env> = async ctx => {
  const params=new URL(ctx.request.url).searchParams, user=uid(ctx), week=params.get('week');
  const active=params.get('active')==='1';
  if(!active && (!validDate(week) || weekOf(week)!==week)) return json({error:'A valid Monday is required.'},400);
  const target=active ? 'SELECT plan_id FROM active_meal_plans WHERE user_id=?' : 'SELECT id FROM meal_plans WHERE user_id=? AND week_start=?';
  const args=active ? [user] : [user,week];
  const [plans,items]=await ctx.env.DB.batch([
    ctx.env.DB.prepare(active ? `SELECT p.*, a.revision AS revision FROM active_meal_plans a JOIN meal_plans p ON p.id=a.plan_id WHERE a.user_id=?` : `SELECT * FROM meal_plans WHERE user_id=? AND week_start=?`).bind(...args),
    ctx.env.DB.prepare(`SELECT * FROM meal_plan_items WHERE plan_id=(${target}) ORDER BY day_of_week,CASE slot WHEN 'lunch' THEN 0 ELSE 1 END`).bind(...args)
  ]);
  const plan=plans.results[0] as any;
  if(!plan) return json(null);
  const dates=planDates(plan.start_date || plan.week_start,plan.plan_days);
  const order=new Map(dates.map((d,i)=>[d.day_of_week,i]));
  return json({...plan,start_date:plan.start_date || plan.week_start,items:items.results.map((item:any)=>{
    let source=null;try{source=JSON.parse(item.leftover_of);}catch{}
    const previous=item.day_of_week===1?7:item.day_of_week-1;
    if(item.is_leftover && !validSlot(source) && items.results.some((p:any)=>p.day_of_week===previous && p.slot==='dinner' && p.recipe_id===item.recipe_id && !p.is_leftover && (order.get(previous)??99)<(order.get(item.day_of_week)??-1))) source={day_of_week:previous,slot:'dinner'};
    return {day_of_week:item.day_of_week,slot:item.slot,recipe_id:item.recipe_id,is_leftover:!!item.is_leftover,leftover_of:validSlot(source)?source:null,servings:item.servings};
  }).sort((a:any,b:any)=>(order.get(a.day_of_week)??99)-(order.get(b.day_of_week)??99)||(a.slot==='lunch'?-1:1))});
};

export const onRequestPost: PagesFunction<Env> = async ctx => {
  let b:any;try{b=await ctx.request.json();}catch{return json({error:'Invalid JSON.'},400);}
  if(!b || b.active!==true || !Object.hasOwn(b,'expected_revision')) return json({error:'Reload Groceree before saving this plan.'},428);
  if(!validDate(b.start_date) || ![4,7].includes(b.plan_days) || weekOf(b.start_date)!==b.week_start || !Array.isArray(b.items) || b.items.length>b.plan_days*2 || (b.expected_revision!==null && (!Number.isSafeInteger(b.expected_revision)||b.expected_revision<1)) || (b.status!==undefined && !['draft','saved'].includes(b.status))) return json({error:'Invalid plan.'},400);
  const dates=planDates(b.start_date,b.plan_days), order=new Map(dates.map((d,i)=>[d.day_of_week,i])), seen=new Set<string>();
  for(const item of b.items){
    const key=`${item?.day_of_week}:${item?.slot}`;
    if(!validSlot(item) || !order.has(item.day_of_week) || seen.has(key) || typeof item.is_leftover!=='boolean' || (item.recipe_id!==null && (typeof item.recipe_id!=='string'||!item.recipe_id.trim())) || !Number.isSafeInteger(item.servings)||item.servings<1 || (item.leftover_of!=null && (!item.is_leftover||!validSlot(item.leftover_of)))) return json({error:'Invalid meal slot.'},400);
    seen.add(key);
    if(item.leftover_of){
      const source=b.items.find((p:any)=>p.day_of_week===item.leftover_of.day_of_week && p.slot===item.leftover_of.slot);
      if(!source || source.is_leftover || source.recipe_id!==item.recipe_id || (order.get(source.day_of_week)??99)>=(order.get(item.day_of_week)??-1)) return json({error:'Invalid leftover source.'},400);
    }
  }
  const db=ctx.env.DB,user=uid(ctx),revision=b.expected_revision??0;
  const guard='EXISTS(SELECT 1 FROM active_meal_plans WHERE user_id=? AND revision=?)';
  const target='SELECT id FROM meal_plans WHERE user_id=? AND week_start=?';
  const statements:D1PreparedStatement[]=[
    db.prepare('INSERT OR IGNORE INTO active_meal_plans(user_id,revision) VALUES(?,0)').bind(user),
    db.prepare(`INSERT INTO meal_plans(user_id,week_start,start_date,plan_days,status,revision)
      SELECT ?,?,?,?,?,1 WHERE ${guard}
      ON CONFLICT(user_id,week_start) DO UPDATE SET start_date=excluded.start_date,plan_days=excluded.plan_days,status=excluded.status,revision=meal_plans.revision+1`)
      .bind(user,b.week_start,b.start_date,b.plan_days,b.status||'saved',user,revision),
    db.prepare(`DELETE FROM meal_plan_items WHERE plan_id=(${target}) AND ${guard}`).bind(user,b.week_start,user,revision)
  ];
  for(const item of b.items) statements.push(db.prepare(`INSERT INTO meal_plan_items(plan_id,day_of_week,slot,recipe_id,is_leftover,leftover_of,servings)
    SELECT id,?,?,?,?,?,? FROM meal_plans WHERE user_id=? AND week_start=? AND ${guard}`).bind(item.day_of_week,item.slot,item.recipe_id,item.is_leftover?1:0,item.leftover_of?JSON.stringify(item.leftover_of):null,item.servings,user,b.week_start,user,revision));
  statements.push(db.prepare(`UPDATE active_meal_plans SET plan_id=(${target}),revision=revision+1 WHERE user_id=? AND revision=? RETURNING plan_id,revision`).bind(user,b.week_start,user,revision));
  const results=await db.batch(statements), saved=results.at(-1)!.results[0] as any;
  if(!saved) return json({error:'This plan changed on another device. Load the cloud plan first.'},409);
  return json({ok:true,...saved});
};
