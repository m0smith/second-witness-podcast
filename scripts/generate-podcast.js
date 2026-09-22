#!/usr/bin/env node
/**
 * Generate a podcast RSS feed for a Come, Follow Me scripture reading.
 *
 * Uses the Church study content API and official Church-hosted audio URLs.
 * Defaults to the week containing today; pass --date YYYY-MM-DD to generate
 * another week.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCHEDULE = require(path.join(ROOT, 'src/data/cfm-2026-old-testament.json'));
const API = 'https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content';
const SITE = 'https://www.churchofjesuschrist.org';

const BOOKS = {
  Genesis: ['gen', 'ot'], Exodus: ['ex', 'ot'], Leviticus: ['lev', 'ot'],
  Numbers: ['num', 'ot'], Deuteronomy: ['deut', 'ot'], Joshua: ['josh', 'ot'],
  Judges: ['judg', 'ot'], Ruth: ['ruth', 'ot'], '1 Samuel': ['1-sam', 'ot'],
  '2 Samuel': ['2-sam', 'ot'], '1 Kings': ['1-kgs', 'ot'], '2 Kings': ['2-kgs', 'ot'],
  '1 Chronicles': ['1-chr', 'ot'], '2 Chronicles': ['2-chr', 'ot'], Ezra: ['ezra', 'ot'],
  Nehemiah: ['neh', 'ot'], Esther: ['esth', 'ot'], Job: ['job', 'ot'],
  Psalms: ['ps', 'ot'], Proverbs: ['prov', 'ot'], Ecclesiastes: ['eccl', 'ot'],
  Isaiah: ['isa', 'ot'], Jeremiah: ['jer', 'ot'], Lamentations: ['lam', 'ot'],
  Ezekiel: ['ezek', 'ot'], Daniel: ['dan', 'ot'], Hosea: ['hosea', 'ot'],
  Joel: ['joel', 'ot'], Amos: ['amos', 'ot'], Obadiah: ['obad', 'ot'],
  Jonah: ['jonah', 'ot'], Micah: ['micah', 'ot'], Nahum: ['nahum', 'ot'],
  Habakkuk: ['hab', 'ot'], Zephaniah: ['zeph', 'ot'], Haggai: ['hag', 'ot'],
  Zechariah: ['zech', 'ot'], Malachi: ['mal', 'ot'],
};

function parseDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function weekForDate(date) {
  const t = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return SCHEDULE.weeks.find(w => t >= parseDate(w.start).getTime() && t <= parseDate(w.end).getTime());
}

function expandReading(reading) {
  const result = [];
  let currentBook = null;
  for (const raw of reading.split(';')) {
    const part = raw.trim();
    const match = part.match(/^((?:[1-2] )?[A-Za-z]+(?: [A-Za-z]+)*)\s+(\d+(?:[–-]\d+)?)$/);
    const continuation = part.match(/^(\d+(?:[–-]\d+)?)$/);
    let spec;
    if (match) {
      currentBook = match[1];
      spec = match[2];
    } else if (continuation && currentBook) {
      spec = continuation[1];
    } else {
      throw new Error(`Unsupported reading segment: ${part}`);
    }
    if (!BOOKS[currentBook]) throw new Error(`Unknown book: ${currentBook}`);
    const [start, end = start] = spec.split(/[–-]/).map(Number);
    for (let chapter = start; chapter <= end; chapter++) result.push({ book: currentBook, chapter });
  }
  return result;
}

async function resolveAudio({ book, chapter }) {
  const [slug, volume] = BOOKS[book];
  const uri = `/scriptures/${volume}/${slug}/${chapter}`;
  const url = new URL(API);
  url.searchParams.set('lang', 'eng');
  url.searchParams.set('uri', uri);
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} resolving ${book} ${chapter}`);
  const data = await response.json();
  const audio = data?.meta?.audio || [];
  const mediaUrl = audio.map(a => a.mediaUrl).find(Boolean);
  if (!mediaUrl) throw new Error(`No audio URL for ${book} ${chapter}`);
  return { mediaUrl, pageUrl: `${SITE}/study${uri}?lang=eng` };
}

function xml(s) {
  return String(s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
}


async function fetchContent(uri) {
  const url = new URL(API);
  url.searchParams.set('lang', 'eng');
  url.searchParams.set('uri', uri);
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} resolving ${uri}`);
  return response.json();
}

function studyLinks(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const found = new Set();
  for (const m of text.matchAll(/(?:https:\/\/www\.churchofjesuschrist\.org)?\/study\/([^"'?\\\s<>]+)(?:\?[^"'\\\s<>]*)?/g)) {
    found.add('/' + m[1]);
  }
  return [...found];
}

async function linkedAudioForLesson(week) {
  const lessonUri = `/manual/come-follow-me-for-home-and-church-old-testament-2026/${week.week}`;
  const lesson = await fetchContent(lessonUri);
  const links = studyLinks(lesson);
  const assets = [];
  for (const uri of links) {
    if (uri.startsWith('/scriptures/')) continue;
    try {
      const data = await fetchContent(uri);
      const mediaUrl = (data?.meta?.audio || []).map(a => a.mediaUrl).find(Boolean);
      if (!mediaUrl) continue;
      const title = data?.meta?.title || data?.title || uri.split('/').pop().replaceAll('-', ' ');
      assets.push({
        title,
        mediaUrl,
        pageUrl: `${SITE}/study${uri}?lang=eng`,
        uri,
        liahona: uri.startsWith('/general-conference/')
      });
    } catch (error) {
      console.warn('Skipping linked asset', uri, error.message);
    }
  }
  return assets;
}

function dayNumber(week, now) {
  const start = parseDate(week.start);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(1, Math.min(7, Math.floor((today - start) / 86400000) + 1));
}

function itemsThroughToday(items, week, now) {
  if (!items.length) return [];
  const day = dayNumber(week, now);
  const count = Math.max(1, Math.ceil(items.length * day / 7));
  return items.slice(0, count);
}

function writeFeed(filename, title, description, week, items) {
  const rssItems = items.map(item => `    <item>
      <title>${xml(item.title)}</title>
      <description>${xml(week.label)} — ${xml(week.reading)}</description>
      <link>${xml(item.pageUrl)}</link>
      <guid isPermaLink="false">${xml(item.mediaUrl)}</guid>
      <enclosure url="${xml(item.mediaUrl)}" length="0" type="audio/mpeg"/>
    </item>`).join('\n');
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
    <title>${xml(title)}</title>
    <link>${xml(SCHEDULE.source)}</link>
    <description>${xml(description)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${rssItems}
  </channel></rss>\n`;
  const outDir = path.join(ROOT, 'docs');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, filename), rss);
}

async function main() {
  const dateArg = process.argv.indexOf('--date');
  const date = dateArg >= 0 ? parseDate(process.argv[dateArg + 1]) : new Date();
  const week = weekForDate(date);
  if (!week) throw new Error('No 2026 Come, Follow Me week found for that date.');
  if (week.topic) throw new Error(`"${week.reading}" is a topical week without a chapter reading.`);

  const chapters = expandReading(week.reading);
  const scriptureItems = [];
  for (const chapter of chapters) {
    const media = await resolveAudio(chapter);
    scriptureItems.push({
      title: `${chapter.book} ${chapter.chapter}`,
      ...media
    });
    process.stdout.write(`Resolved ${chapter.book} ${chapter.chapter}\n`);
  }

  const linked = await linkedAudioForLesson(week);
  const allItems = [...scriptureItems, ...linked];
  const liahonaItems = linked.filter(item => item.liahona);
  const visibleAllItems = itemsThroughToday(allItems, week, date);
  const visibleLiahonaItems = itemsThroughToday(liahonaItems, week, date);

  writeFeed(
    'podcast.xml',
    'Come, Follow Me — Complete Audio',
    'Weekly scriptures plus audio-capable resources referenced by the Come, Follow Me lesson.',
    week,
    visibleAllItems
  );
  writeFeed(
    'liahona.xml',
    'Come, Follow Me — Referenced Liahona',
    'Audio editions of Liahona/general conference messages referenced by the weekly Come, Follow Me lesson.',
    week,
    visibleLiahonaItems
  );

  console.log(`Wrote docs/podcast.xml: ${visibleAllItems.length}/${allItems.length} episodes released through day ${dayNumber(week, date)}`);
  console.log(`Wrote docs/liahona.xml: ${visibleLiahonaItems.length}/${liahonaItems.length} referenced Liahona/general conference messages released`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
