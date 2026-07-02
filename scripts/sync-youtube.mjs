import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const API_ROOT = 'https://www.googleapis.com/youtube/v3';
const OUTPUT_DIR = new URL('../public/', import.meta.url);
const execFileAsync = promisify(execFile);

export function parseDuration(value = '') {
  const match = value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const [, days = '0', hours = '0', minutes = '0', seconds = '0'] = match;
  return Number(days) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

export function toContentItem(video, program) {
  const publishedAt = video.snippet?.publishedAt ?? null;
  const year = publishedAt ? new Date(publishedAt).getUTCFullYear() : null;
  const tags = [...new Set([program.title, ...(video.snippet?.tags ?? []), 'PMTV'])];
  return {
    id: `PMTV-YT-${video.id}`,
    title: video.snippet?.title ?? 'Video PMTV',
    description: video.snippet?.description ?? '',
    content_type: 'video',
    source: 'youtube',
    url: `https://youtu.be/${video.id}`,
    thumbnail_url:
      video.snippet?.thumbnails?.maxres?.url ??
      video.snippet?.thumbnails?.standard?.url ??
      video.snippet?.thumbnails?.high?.url ??
      `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`,
    published_at: publishedAt,
    year,
    duration_seconds: parseDuration(video.contentDetails?.duration),
    premium: false,
    featured: false,
    requires_auth: false,
    access_level: 'public',
    program_id: program.id,
    playlist_id: program.playlist_id,
    presentation: program.presentation ?? 'landscape',
    tags,
    status: 'published'
  };
}

function ytDlpDate(entry) {
  if (Number.isFinite(entry.timestamp)) {
    return new Date(entry.timestamp * 1000).toISOString();
  }
  if (/^\d{8}$/.test(entry.upload_date ?? '')) {
    const value = entry.upload_date;
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`;
  }
  return null;
}

export function ytDlpEntryToContentItem(entry, program) {
  const publishedAt = ytDlpDate(entry);
  const thumbnails = Array.isArray(entry.thumbnails) ? entry.thumbnails : [];
  const thumbnail = entry.thumbnail ?? thumbnails.at(-1)?.url ??
    `https://img.youtube.com/vi/${entry.id}/hqdefault.jpg`;
  return {
    id: `PMTV-YT-${entry.id}`,
    title: entry.title ?? 'Video PMTV',
    description: entry.description ?? '',
    content_type: 'video',
    source: 'youtube',
    url: `https://youtu.be/${entry.id}`,
    thumbnail_url: thumbnail,
    published_at: publishedAt,
    year: publishedAt ? new Date(publishedAt).getUTCFullYear() : null,
    duration_seconds: Number.isFinite(entry.duration) ? Math.round(entry.duration) : null,
    premium: false,
    featured: false,
    requires_auth: false,
    access_level: 'public',
    program_id: program.id,
    playlist_id: program.playlist_id,
    presentation: program.presentation ?? 'landscape',
    tags: [program.title, 'PMTV'],
    status: 'published'
  };
}

async function youtube(path, params, apiKey) {
  const url = new URL(`${API_ROOT}/${path}`);
  for (const [key, value] of Object.entries({ ...params, key: apiKey })) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`YouTube ${response.status}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

async function playlistVideoIds(playlistId, apiKey) {
  const ids = [];
  let pageToken;
  do {
    const page = await youtube('playlistItems', {
      part: 'contentDetails,status',
      playlistId,
      maxResults: 50,
      pageToken
    }, apiKey);
    for (const item of page.items ?? []) {
      if (item.contentDetails?.videoId) ids.push(item.contentDetails.videoId);
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return [...new Set(ids)];
}

async function videoDetails(ids, apiKey) {
  const videos = [];
  for (let index = 0; index < ids.length; index += 50) {
    const page = await youtube('videos', {
      part: 'snippet,contentDetails,status',
      id: ids.slice(index, index + 50).join(','),
      maxResults: 50
    }, apiKey);
    videos.push(...(page.items ?? []));
  }
  return videos.filter(
    (video) => video.status?.privacyStatus === 'public' && video.status?.embeddable !== false
  );
}

export async function buildCatalog(programs, apiKey) {
  const items = [];
  const errors = [];
  for (const program of programs) {
    if (!program.playlist_id) continue;
    try {
      const ids = await playlistVideoIds(program.playlist_id, apiKey);
      const videos = await videoDetails(ids, apiKey);
      items.push(...videos.map((video) => toContentItem(video, program)));
    } catch (error) {
      errors.push({ program_id: program.id, message: String(error.message ?? error) });
      console.error(`[${program.id}]`, error.message ?? error);
    }
  }
  items.sort((a, b) => (Date.parse(b.published_at ?? '') || 0) - (Date.parse(a.published_at ?? '') || 0));
  if (items.length === 0) throw new Error('No se obtuvo ningun video valido; se conserva el catalogo anterior.');
  items[0].featured = true;
  return { items, errors };
}

export async function buildCatalogWithYtDlp(programs) {
  const items = [];
  const errors = [];
  for (const program of programs) {
    if (!program.playlist_id) continue;
    try {
      const url = `https://www.youtube.com/playlist?list=${program.playlist_id}`;
      const { stdout } = await execFileAsync('yt-dlp', [
        '--flat-playlist',
        '--dump-single-json',
        '--ignore-errors',
        '--no-warnings',
        url
      ], { maxBuffer: 50 * 1024 * 1024 });
      const playlist = JSON.parse(stdout);
      const entries = (playlist.entries ?? []).filter((entry) => entry?.id);
      items.push(...entries.map((entry) => ytDlpEntryToContentItem(entry, program)));
    } catch (error) {
      errors.push({ program_id: program.id, message: String(error.message ?? error) });
      console.error(`[${program.id}]`, error.message ?? error);
    }
  }
  items.sort((a, b) => (Date.parse(b.published_at ?? '') || 0) - (Date.parse(a.published_at ?? '') || 0));
  if (items.length === 0) throw new Error('No se obtuvo ningun video valido; se conserva el catalogo anterior.');
  items[0].featured = true;
  return { items, errors };
}

export async function main() {
  const config = JSON.parse(await readFile(new URL('../programs.json', import.meta.url), 'utf8'));
  const startedAt = new Date().toISOString();
  const apiKey = process.env.YOUTUBE_API_KEY;
  const { items, errors } = apiKey
    ? await buildCatalog(config.programs ?? [], apiKey)
    : await buildCatalogWithYtDlp(config.programs ?? []);
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(new URL('catalog.json', OUTPUT_DIR), `${JSON.stringify({ generated_at: new Date().toISOString(), items }, null, 2)}\n`);
  await writeFile(new URL('status.json', OUTPUT_DIR), `${JSON.stringify({ started_at: startedAt, completed_at: new Date().toISOString(), item_count: items.length, errors }, null, 2)}\n`);
  console.log(`Catalogo generado: ${items.length} videos, ${errors.length} errores.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
