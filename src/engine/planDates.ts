// Calendar dates use UTC arithmetic; the chosen date comes from Lisbon.
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export function todayInLisbon(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const part = (name:string) => parts.find(p=>p.type===name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function weekOf(iso:string): string {
  if (!validDate(iso)) throw new Error('Invalid start date.');
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
  return date.toISOString().slice(0,10);
}
export function planDates(start:string,days:number): {date:string;day_of_week:number}[] {
  if (!validDate(start) || !Number.isInteger(days) || days < 1 || days > 7) throw new Error('Invalid plan range.');
  return Array.from({length:days},(_,i)=>{
    const date=new Date(`${start}T00:00:00Z`); date.setUTCDate(date.getUTCDate()+i);
    return {date:date.toISOString().slice(0,10),day_of_week:date.getUTCDay()||7};
  });
}
