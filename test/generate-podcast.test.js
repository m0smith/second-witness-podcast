// Pin a DST-observing zone so date arithmetic is exercised across a DST change (local midnights
// can be 23h apart) on UTC CI runners as well as developer machines. Set before any Date exists.
process.env.TZ = 'America/Denver';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseDate, weekForDate, expandReading, dayNumber, itemsThroughToday, xml, linksFromHtml,
} = require('../scripts/generate-podcast.js');
const schedule = require('../data/cfm-2026-old-testament.json');

test('expandReading expands ranges and carries the book across segments', () => {
  assert.deepEqual(expandReading('Genesis 1–2'), [
    { book: 'Genesis', chapter: 1 }, { book: 'Genesis', chapter: 2 },
  ]);
  assert.deepEqual(expandReading('Exodus 19–20; 24'), [
    { book: 'Exodus', chapter: 19 }, { book: 'Exodus', chapter: 20 }, { book: 'Exodus', chapter: 24 },
  ]);
});

test('expandReading handles numbered books and whole-book readings', () => {
  assert.deepEqual(expandReading('1 Samuel 3'), [{ book: '1 Samuel', chapter: 3 }]);
  assert.equal(expandReading('Jonah').length, 4);
});

test('expandReading rejects unsupported segments and unknown books', () => {
  assert.throws(() => expandReading('Introduction to the Old Testament'));
  assert.throws(() => expandReading('Hezekiah 3'), /Unknown book/);
});

test('weekForDate treats start and end as inclusive local dates', () => {
  const week = schedule.weeks[1];
  assert.equal(weekForDate(parseDate(week.start)), week);
  assert.equal(weekForDate(parseDate(week.end)), week);
  assert.equal(weekForDate(parseDate('2000-01-01')), undefined);
});

test('dayNumber is clamped to 1..7', () => {
  const week = { start: '2026-10-12', end: '2026-10-18' };
  assert.equal(dayNumber(week, parseDate('2026-10-12')), 1);
  assert.equal(dayNumber(week, parseDate('2026-10-18')), 7);
  assert.equal(dayNumber(week, parseDate('2026-10-30')), 7);
});

test('itemsThroughToday releases items progressively and never returns none', () => {
  const week = { start: '2026-10-12' };
  const items = [1, 2, 3, 4, 5, 6, 7];
  assert.deepEqual(itemsThroughToday(items, week, parseDate('2026-10-12')), [1]);
  assert.equal(itemsThroughToday(items, week, parseDate('2026-10-18')).length, 7);
  assert.deepEqual(itemsThroughToday([], week, parseDate('2026-10-12')), []);
});

test('xml escapes markup characters', () => {
  assert.equal(xml(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;');
});

test('linksFromHtml resolves relative links against the base', () => {
  const links = linksFromHtml('<a href="a/b.mp3">Ch &amp; 1</a>', 'https://example.org/x/');
  assert.deepEqual(links, [{ href: 'https://example.org/x/a/b.mp3', text: 'Ch & 1' }]);
});

test('schedule weeks are Monday-to-Sunday, 7 days long, and contiguous', () => {
  let previousEnd;
  for (const w of schedule.weeks) {
    const start = parseDate(w.start);
    const end = parseDate(w.end);
    assert.equal(start.getDay(), 1, `week ${w.week} should start on Monday`);
    assert.equal(Math.round((end - start) / 86400000), 6, `week ${w.week} should span 7 days`);
    if (previousEnd) {
      assert.equal(Math.round((start - previousEnd) / 86400000), 1, `gap or overlap before week ${w.week}`);
    }
    previousEnd = end;
  }
});

// The workflow validates a hard-coded list of week starts. Keep it in lockstep with the
// schedule so a schedule edit cannot silently leave weeks unvalidated.
const workflow = fs.readFileSync(
  path.join(__dirname, '../.github/workflows/update-podcast-feeds.yml'), 'utf8');
const validated = workflow.match(/for d in ([0-9 -]+); do/)[1].trim().split(/\s+/);

test('workflow validation list covers every schedule week from its first date onward', () => {
  const expected = schedule.weeks.filter(w => w.start >= validated[0]).map(w => w.start);
  assert.deepEqual(validated, expected);
});

test('validated weeks have readings the generator supports', () => {
  // Earlier weeks cite Pearl of Great Price books (Moses, Abraham), which are unsupported.
  for (const w of schedule.weeks.filter(w => w.start >= validated[0])) {
    if (w.topic) {
      assert.equal(w.topic, 'christmas', `week ${w.week}: unsupported topic "${w.topic}"`);
    } else {
      assert.doesNotThrow(() => expandReading(w.reading), `week ${w.week}: ${w.reading}`);
    }
  }
});
