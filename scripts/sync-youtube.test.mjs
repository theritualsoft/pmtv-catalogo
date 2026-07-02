import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDuration, toContentItem, ytDlpEntryToContentItem } from './sync-youtube.mjs';

test('convierte duraciones ISO 8601 a segundos', () => {
  assert.equal(parseDuration('PT1H2M3S'), 3723);
  assert.equal(parseDuration('PT15M33S'), 933);
  assert.equal(parseDuration('invalida'), null);
});

test('normaliza metadata plana obtenida por yt-dlp', () => {
  const item = ytDlpEntryToContentItem({
    id: 'abc123',
    title: 'Capitulo nuevo',
    timestamp: 1782864000,
    duration: 125.4,
    thumbnail: 'https://example.com/thumb.jpg'
  }, {
    id: 'programa',
    title: 'Programa PMTV',
    playlist_id: 'playlist',
    presentation: 'landscape'
  });
  assert.equal(item.id, 'PMTV-YT-abc123');
  assert.equal(item.duration_seconds, 125);
  assert.equal(item.premium, false);
  assert.equal(item.program_id, 'programa');
});

test('normaliza un video de YouTube al schema PMTV', () => {
  const item = toContentItem({
    id: 'PKquNJVB2jE',
    snippet: {
      title: 'Capitulo 27',
      description: 'Descripcion',
      publishedAt: '2026-06-01T10:00:00Z',
      thumbnails: { high: { url: 'https://example.com/thumb.jpg' } },
      tags: ['Podcast']
    },
    contentDetails: { duration: 'PT1H2M3S' }
  }, {
    id: 'con-canas-y-sin-ganas',
    title: 'Con Canas y Sin Ganas',
    playlist_id: 'playlist',
    presentation: 'landscape'
  });
  assert.equal(item.source, 'youtube');
  assert.equal(item.premium, false);
  assert.equal(item.duration_seconds, 3723);
  assert.equal(item.year, 2026);
  assert.equal(item.program_id, 'con-canas-y-sin-ganas');
});
