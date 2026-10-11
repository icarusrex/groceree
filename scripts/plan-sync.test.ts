import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlanSync, mondayOf, readLegacyPlan } from '../src/lib/planSync.ts';

const week = '2026-10-05';
const item = { day_of_week: 1, slot: 'dinner' as const, recipe_id: 'chicken', is_leftover: false, leftover_of: null, servings: 2 };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: any) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function cloud() {
  const plans = new Map<string, any>();
  let fail = false;
  return { plans, setFail: (value: boolean) => { fail = value; },
    load: async () => { if (fail) throw new Error('offline'); return structuredClone([...plans.values()].at(-1) ?? null); },
    save: async (body: any) => {
      if (fail) throw new Error('offline');
      const current = [...plans.values()].at(-1);
      if ((current?.revision ?? null) !== body.expected_revision) throw Object.assign(new Error('conflict'), { status: 409 });
      const revision = (current?.revision ?? 0) + 1;
      plans.delete(body.week_start); plans.set(body.week_start, { items: structuredClone(body.items), revision, week_start:body.week_start, start_date:body.start_date, plan_days:body.plan_days }); return { revision };
    },
  };
}
const session = (api: any, extra: any = {}) => new PlanSync({ ...api, week: () => week,
  readLegacy: () => [], clearLegacy: () => {}, changed: () => {}, ...extra });

test('a second device without local storage loads the autosaved plan', async () => {
  const api = cloud(), laptop = session(api);
  await laptop.refresh(); laptop.change([item]); await laptop.save();
  const tablet = session(api); await tablet.refresh();
  assert.deepEqual(tablet.snapshot.items, [item]);
  assert.equal(tablet.snapshot.phase, 'saved');
});
test('cloud takes precedence over an old local plan, including an intentionally empty week', async () => {
  const api = cloud(); api.plans.set(week, { items: [], revision: 2 });
  const sync = session(api, { readLegacy: () => [item] }); await sync.refresh();
  assert.deepEqual(sync.snapshot.items, []); assert.equal(api.plans.get(week).revision, 2);
});
test('legacy local plan imports once, only into an absent week', async () => {
  const api = cloud(); let legacy = [item];
  const sync = session(api, { readLegacy: () => legacy, clearLegacy: () => { legacy = []; } });
  await sync.refresh(); assert.deepEqual(api.plans.get(week).items, [item]);
  assert.deepEqual(legacy, []);
});
test('a competing first save wins over a late local import', async () => {
  const api = cloud(); let initial = true;
  const sync = session(api, { readLegacy: () => [{ ...item, recipe_id: 'old-local' }], load: async (w: string) => {
    if (initial) { initial = false; api.plans.set(week, { items: [item], revision: 1 }); return null; }
    return api.load(w);
  } });
  await sync.refresh(); assert.deepEqual(sync.snapshot.items, [item]);
  assert.equal(sync.snapshot.phase, 'saved');
});
test('rapid edits are saved in order while an earlier request is pending', async () => {
  const api = cloud(), first = deferred<void>(); let calls = 0;
  const sync = session(api, { save: async (body: any) => {
    if (++calls === 1) await first.promise; return api.save(body);
  } });
  await sync.refresh(); sync.change([item]);
  sync.change([{ ...item, recipe_id: 'fish' }]);
  first.resolve(); await sync.save();
  assert.equal(api.plans.get(week).items[0].recipe_id, 'fish');
  assert.equal(sync.snapshot.phase, 'saved');
});
test('failed autosave keeps edits and retry saves them', async () => {
  const api = cloud(), sync = session(api); await sync.refresh();
  api.setFail(true); sync.change([item]); await assert.rejects(sync.save());
  assert.equal(sync.snapshot.phase, 'error'); assert.deepEqual(sync.snapshot.items, [item]);
  api.setFail(false); await sync.save(); assert.deepEqual(api.plans.get(week).items, [item]);
});
test('failed initial load blocks editing and cannot overwrite an unknown cloud plan', async () => {
  const api = cloud(); api.plans.set(week, { items: [item], revision: 1 }); api.setFail(true);
  const sync = session(api); await sync.refresh(); sync.change([]);
  assert.equal(sync.snapshot.ready, false); assert.deepEqual(api.plans.get(week).items, [item]);
  api.setFail(false); await sync.refresh(); assert.deepEqual(sync.snapshot.items, [item]);
});
test('stale-device edits stay visible until explicitly loading the cloud plan', async () => {
  const api = cloud(), a = session(api), b = session(api);
  await a.refresh(); await b.refresh(); a.change([item]); await a.save();
  b.change([{ ...item, recipe_id: 'tablet' }]); await assert.rejects(b.save());
  assert.equal(b.snapshot.phase, 'conflict'); await b.refresh();
  assert.equal(b.snapshot.items[0].recipe_id, 'tablet');
  await b.refresh(true); assert.deepEqual(b.snapshot.items, [item]);
});
test('a returning device refreshes an unchanged local view', async () => {
  const api = cloud(), a = session(api), b = session(api);
  await a.refresh(); await b.refresh(); a.change([item]); await a.save();
  await b.refresh(); assert.deepEqual(b.snapshot.items, [item]);
});
test('late background loads cannot erase edits made while loading', async () => {
  const api = cloud(), wait = deferred<any>(); let delay = false;
  const sync = session(api, { load: (w: string) => delay ? wait.promise : api.load(w) });
  await sync.refresh(); delay = true; const refresh = sync.refresh();
  sync.change([item]); await sync.save(); wait.resolve(null); await refresh;
  assert.deepEqual(sync.snapshot.items, [item]);
});
test('Monday rollover keeps the saved Sunday plan', async () => {
  const api=cloud();let activeWeek=week;const sync=session(api,{week:()=>activeWeek});
  await sync.refresh();sync.change([{...item,day_of_week:7}],{start_date:'2026-10-11',plan_days:4});await sync.save();
  activeWeek='2026-10-12';await sync.refresh();
  assert.equal(sync.snapshot.start_date,'2026-10-11');assert.equal(sync.snapshot.week,week);
  assert.equal(sync.snapshot.items[0].day_of_week,7);
});
test('all devices use the Lisbon calendar at the Sunday/Monday boundary', () => {
  assert.equal(mondayOf(new Date('2026-10-11T23:30:00Z')), '2026-10-12');
  assert.equal(mondayOf(new Date('2026-10-11T22:30:00Z')), '2026-10-05');
  assert.equal(mondayOf(new Date('2026-12-31T23:30:00Z')), '2026-12-28');
});
test('corrupt or unavailable legacy storage cannot crash the app', () => {
  for (const raw of ['broken', '{}', '[{"day_of_week":99}]'])
    assert.deepEqual(readLegacyPlan({ getItem: () => raw }), []);
  assert.deepEqual(readLegacyPlan({ getItem: () => { throw new Error('blocked'); } }), []);
  assert.deepEqual(readLegacyPlan({ getItem: () => JSON.stringify([item]) }), [item]);
});

test('queued replacement carries its own metadata with its items',async()=>{
 const api=cloud(),wait=deferred<void>();let calls=0;
 const sync=session(api,{save:async(b:any)=>{if(++calls===1)await wait.promise;return api.save(b);}});
 await sync.refresh();sync.change([{...item,day_of_week:7}],{start_date:'2026-10-11',plan_days:4});
 sync.change([{...item,day_of_week:4,recipe_id:'fish'}],{start_date:'2026-10-15',plan_days:4});
 wait.resolve();await sync.save();const tablet=session(api);await tablet.refresh();
 assert.equal(tablet.snapshot.start_date,'2026-10-15');assert.equal(tablet.snapshot.items[0].recipe_id,'fish');
});
test('a failed explicit cloud load resumes after conflict across different weeks',async()=>{
 const api=cloud(),a=session(api),b=session(api);await a.refresh();await b.refresh();
 a.change([{...item,day_of_week:4}],{start_date:'2026-10-15',plan_days:4});await a.save();
 b.change([item]);await assert.rejects(b.save());api.setFail(true);await b.refresh(true);
 assert.equal(b.snapshot.ready,false);api.setFail(false);await b.retry();
 assert.equal(b.snapshot.start_date,'2026-10-15');assert.equal(b.snapshot.ready,true);
});
