import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDates, validDate, weekOf, todayInLisbon } from '../src/engine/planDates.ts';
test('four days starting Sunday cross Monday chronologically', () => {
  assert.deepEqual(planDates('2026-10-11',4), [
    {date:'2026-10-11',day_of_week:7},{date:'2026-10-12',day_of_week:1},
    {date:'2026-10-13',day_of_week:2},{date:'2026-10-14',day_of_week:3}]);
});
test('all start weekdays and year/month/leap/DST boundaries retain exact duration', () => {
  for (const start of ['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-10-11','2026-12-30','2028-02-28','2026-03-28','2026-10-24']) {
    for (const days of [4,7]) {
      const dates=planDates(start,days); assert.equal(dates.length,days);
      assert.equal(new Set(dates.map(d=>d.day_of_week)).size,days);
      assert.equal(Date.parse(dates.at(-1)!.date)-Date.parse(start),(days-1)*86400000);
    }
  }
  assert.equal(weekOf('2026-10-11'),'2026-10-05');
  assert.equal(todayInLisbon(new Date('2026-10-11T23:30Z')),'2026-10-12');
  for(const date of ['2026-02-30','2026-13-01','bad','2026-1-1']) assert.equal(validDate(date),false);
});
