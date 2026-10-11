import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequestGet, onRequestPost } from '../functions/api/plan.ts';

function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('schema.sql', 'utf8'));
  const db = {
    prepare(query: string) {
      let args: any[] = [];
      const statement = {
        bind(...values: any[]) { args = values; return statement; },
        async first() { return sql.prepare(query).get(...args) ?? null; },
        async all() { return { results: sql.prepare(query).all(...args) }; },
        async run() {
          const prepared = sql.prepare(query);
          const results = prepared.columns().length ? prepared.all(...args) : [];
          if (!prepared.columns().length) prepared.run(...args);
          return { results, success: true };
        },
      };
      return statement;
    },
    async batch(statements: any[]) {
      sql.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sql.exec('COMMIT');
        return results;
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  return { db, sql };
}
const dinner = { day_of_week: 1, slot: 'dinner', recipe_id: 'chicken', is_leftover: false, leftover_of: null, servings: 4 };
const lunch = { day_of_week: 2, slot: 'lunch', recipe_id: 'chicken', is_leftover: true,
  leftover_of: { day_of_week: 1, slot: 'dinner' }, servings: 2 };
const week = '2026-10-05';
function context(db: any, body?: any, email = 'aron@example.com') {
  return { env: { DB: db }, request: new Request(`https://groceree.test/api/plan?week=${week}`, {
    method: body ? 'POST' : 'GET', headers: { 'Cf-Access-Authenticated-User-Email': email },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }) } as any;
}
const save = (db: any, items: any[], revision: number | null = null, email?: string) =>
  onRequestPost(context(db, { active:true, start_date:week, plan_days:4, week_start: week, expected_revision: revision, items }, email));

test('cloud round trip preserves leftover links, booleans and servings', async () => {
  const { db, sql } = database();
  try {
    assert.equal((await save(db, [dinner, lunch])).status, 200);
    const result = await (await onRequestGet(context(db))).json();
    assert.equal(result.revision, 1);
    assert.deepEqual(result.items.map(({ day_of_week, slot, recipe_id, is_leftover, leftover_of, servings }: any) =>
      ({ day_of_week, slot, recipe_id, is_leftover, leftover_of, servings })), [dinner, lunch]);
  } finally { sql.close(); }
});
test('stale saves cannot replace a newer plan', async () => {
  const { db, sql } = database();
  try {
    await save(db, [dinner]);
    assert.equal((await save(db, [{ ...dinner, recipe_id: 'fish' }], 1)).status, 200);
    assert.equal((await save(db, [{ ...dinner, recipe_id: 'stale-tablet' }], 1)).status, 409);
    const result = await (await onRequestGet(context(db))).json();
    assert.equal(result.items[0].recipe_id, 'fish');
    assert.equal(result.revision, 2);
  } finally { sql.close(); }
});
test('local import cannot overwrite an existing cloud plan', async () => {
  const { db, sql } = database();
  try {
    await save(db, [dinner]);
    assert.equal((await save(db, [{ ...dinner, recipe_id: 'local' }])).status, 409);
    assert.equal((await (await onRequestGet(context(db))).json()).items[0].recipe_id, 'chicken');
  } finally { sql.close(); }
});
test('invalid and duplicate slots leave the saved week intact', async () => {
  const { db, sql } = database();
  try {
    await save(db, [dinner]);
    for (const items of [[{ ...dinner, day_of_week: 8 }], [dinner, dinner], [{ ...lunch, leftover_of: { day_of_week: 9, slot: 'dinner' } }]]) {
      assert.equal((await save(db, items, 1)).status, 400);
      assert.equal((await (await onRequestGet(context(db))).json()).items[0].recipe_id, 'chicken');
    }
  } finally { sql.close(); }
});
test('clearing the week remains an existing empty cloud plan', async () => {
  const { db, sql } = database();
  try {
    await save(db, [dinner]);
    assert.equal((await save(db, [], 1)).status, 200);
    assert.deepEqual((await (await onRequestGet(context(db))).json()).items, []);
  } finally { sql.close(); }
});
test('existing per-user isolation is preserved', async () => {
  const { db, sql } = database();
  try {
    await save(db, [dinner]);
    assert.equal(await (await onRequestGet(context(db, undefined, 'someone@example.com'))).json(), null);
  } finally { sql.close(); }
});

test('a failed replacement rolls back the entire week', async () => {
  const { db, sql } = database();
  try {
    await save(db, [dinner, lunch]);
    sql.exec("CREATE TRIGGER fail_insert BEFORE INSERT ON meal_plan_items WHEN NEW.recipe_id='fail' BEGIN SELECT RAISE(ABORT,'disk error'); END");
    await assert.rejects(save(db, [{ ...dinner, recipe_id: 'fail' }], 1));
    const result = await (await onRequestGet(context(db))).json();
    assert.equal(result.revision, 1); assert.equal(result.items.length, 2);
    assert.equal(result.items[0].recipe_id, 'chicken');
  } finally { sql.close(); }
});
test('the existing database upgrades without losing plans or old leftover portions', async () => {
  const { db, sql } = database();
  try {
    sql.exec('DROP TABLE active_meal_plans; ALTER TABLE meal_plans DROP COLUMN revision; ALTER TABLE meal_plans DROP COLUMN start_date; ALTER TABLE meal_plans DROP COLUMN plan_days');
    sql.exec("INSERT INTO meal_plans(id,user_id,week_start,status) VALUES(1,'aron@example.com','2026-10-05','saved')");
    sql.exec("INSERT INTO meal_plan_items(plan_id,day_of_week,slot,recipe_id,is_leftover,servings) VALUES(1,1,'dinner','chicken',0,4),(1,2,'lunch','chicken',1,2)");
    sql.exec(readFileSync('migrations/0001_plan_revision.sql', 'utf8'));
    sql.exec(readFileSync('migrations/0002_active_plan_dates.sql', 'utf8'));
    const result = await (await onRequestGet(context(db))).json();
    assert.equal(result.revision, 1); assert.equal(result.items[0].servings, 4);
    assert.deepEqual(result.items[1].leftover_of, { day_of_week: 1, slot: 'dinner' });
    assert.equal((await save(db, result.items, 1)).status, 200);
  } finally { sql.close(); }
});
test('a client without a revision must reload before writing', async () => {
  const { db, sql } = database();
  try {
    const response = await onRequestPost(context(db, { week_start: week, items: [dinner] }));
    assert.equal(response.status, 428);
    assert.equal(await (await onRequestGet(context(db))).json(), null);
  } finally { sql.close(); }
});

const activeRead = async (db: any) => (await onRequestGet({ ...context(db), request: new Request('https://groceree.test/api/plan?active=1', {headers:{'Cf-Access-Authenticated-User-Email':'aron@example.com'}}) })).json();
const datedSave = (db:any, start:string, weekStart:string, revision:number|null, items:any[]=[]) => onRequestPost(context(db,{active:true,start_date:start,plan_days:4,week_start:weekStart,expected_revision:revision,items}));
test('active plan preserves Sunday dates and stale cross-week writes change nothing', async()=>{
 const {db,sql}=database();try{
   assert.equal((await datedSave(db,'2026-10-11',week,null,[{...dinner,day_of_week:7}])).status,200);
   const sun=await activeRead(db); assert.equal(sun.start_date,'2026-10-11');assert.equal(sun.plan_days,4);
   assert.equal((await datedSave(db,'2026-10-15','2026-10-12',1)).status,200);
   assert.equal((await datedSave(db,'2026-10-22','2026-10-19',1)).status,409);
   assert.equal(sql.prepare("SELECT count(*) AS n FROM meal_plans WHERE week_start='2026-10-19'").get()!.n,0);
   const active=await activeRead(db);assert.equal(active.start_date,'2026-10-15');assert.equal(active.revision,2);
   assert.equal((await datedSave(db,'2026-10-11',week,1,[{...dinner,day_of_week:7,recipe_id:'stale'}])).status,409);
   assert.equal(sql.prepare('SELECT recipe_id FROM meal_plan_items').get()!.recipe_id,'chicken');
 }finally{sql.close();}
});
test('invalid date, mismatched week and slots outside the four-day range are rejected',async()=>{
 const {db,sql}=database();try{
 for(const [start,w,items] of [['2026-02-30','2026-02-23',[]],['2026-10-11','2026-10-12',[]],['2026-10-11',week,[{...dinner,day_of_week:4}]]] as any[]) {
 assert.equal((await datedSave(db,start,w,null,items)).status,400);
 }assert.equal(await activeRead(db),null);
 }finally{sql.close();}
});
test('migration selects each users latest plan and keeps empty plans with settings duration', async()=>{
 const {db,sql}=database();try{
 sql.exec("DROP TABLE active_meal_plans; ALTER TABLE meal_plans DROP COLUMN start_date; ALTER TABLE meal_plans DROP COLUMN plan_days;");
 sql.exec("INSERT INTO user_settings(user_id,plan_days) VALUES('aron@example.com',7);");
 sql.exec("INSERT INTO meal_plans(id,user_id,week_start) VALUES(1,'aron@example.com','2026-10-05'),(2,'aron@example.com','2026-10-12'),(3,'other','2026-10-05');");
 sql.exec("INSERT INTO meal_plan_items(plan_id,day_of_week,slot,recipe_id,is_leftover,servings) VALUES(1,5,'dinner','fish',0,2),(3,1,'dinner','chicken',0,2);");
 sql.exec(readFileSync('migrations/0002_active_plan_dates.sql','utf8'));
 const active=await activeRead(db);assert.equal(active.id,2);assert.equal(active.plan_days,7);assert.deepEqual(active.items,[]);
 assert.equal(sql.prepare("SELECT plan_days FROM meal_plans WHERE id=3").get()!.plan_days,4);
 assert.equal(sql.prepare('SELECT count(*) n FROM meal_plan_items').get()!.n,2);
 }finally{sql.close();}
});
