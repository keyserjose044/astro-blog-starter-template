import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/scripts/albums-listening-log-identity.js', import.meta.url), 'utf8');
const start = source.indexOf('const identityClean');
const end = source.indexOf('function parseIdentityDate');

assert.ok(start >= 0 && end > start, 'Could not locate music identity helpers in browser module');

const context = { URL, encodeURIComponent };
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nglobalThis.__musicIdentityTest = { identityNormalize, canonicalSourceIdentity, musicIdentityKey };`, context);

const { identityNormalize, canonicalSourceIdentity, musicIdentityKey } = context.__musicIdentityTest;

assert.equal(identityNormalize('José José'), identityNormalize('Jose Jose'), 'Latin accents should not split one identity');
assert.equal(identityNormalize('  AC/DC  '), 'ac dc', 'Punctuation and spacing should normalize consistently');

const lyubeA = musicIdentityKey({ artist: 'Lyube', title: 'Давай за...' });
const lyubeB = musicIdentityKey({ artist: 'Lyube', title: 'Комбат' });
assert.notEqual(lyubeA, lyubeB, 'Different Cyrillic titles by one artist must not collapse together');
assert.match(lyubeA, /даваи|давай/u, 'Cyrillic title content should survive normalization');

const cyrillicArtistA = musicIdentityKey({ artist: 'Любэ', title: 'Давай за...' });
const cyrillicArtistB = musicIdentityKey({ artist: 'Кино', title: 'Группа крови' });
assert.notEqual(cyrillicArtistA, cyrillicArtistB, 'Fully non-Latin artist/title identities must remain distinct');
assert.notEqual(cyrillicArtistA, '|title:', 'Non-Latin identities must not normalize to an empty key');

const youtubeWatch = canonicalSourceIdentity('https://www.youtube.com/watch?v=AbCdEf12345&si=tracker');
const youtubeShort = canonicalSourceIdentity('https://youtu.be/AbCdEf12345?si=other');
assert.equal(youtubeWatch, youtubeShort, 'Equivalent YouTube links should resolve to one source identity');

const untitledSameA = musicIdentityKey({ artist: 'Artist', title: 'Untitled entry', sourceUrl: 'https://youtu.be/AbCdEf12345?si=one', rowNumber: 10 });
const untitledSameB = musicIdentityKey({ artist: 'Artist', title: 'Linked music entry', sourceUrl: 'https://www.youtube.com/watch?v=AbCdEf12345&feature=share', rowNumber: 11 });
assert.equal(untitledSameA, untitledSameB, 'Same source video should count as the same untitled music identity');

const untitledDifferent = musicIdentityKey({ artist: 'Artist', title: 'Untitled entry', sourceUrl: 'https://youtu.be/ZyXwVu98765', rowNumber: 12 });
assert.notEqual(untitledSameA, untitledDifferent, 'Different source videos must not become false repeats');

const missingSourceA = musicIdentityKey({ artist: 'Artist', title: 'Untitled entry', rowNumber: 20 });
const missingSourceB = musicIdentityKey({ artist: 'Artist', title: 'Untitled entry', rowNumber: 21 });
assert.notEqual(missingSourceA, missingSourceB, 'Untitled rows without a source should stay separate rather than form false repeats');

console.log('Music identity regression tests passed.');
