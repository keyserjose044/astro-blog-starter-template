import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync(new URL('../public/scripts/classical-polish-v2.js', import.meta.url), 'utf8');
const guardrails = fs.readFileSync(new URL('../public/scripts/classical-polish-v2-guardrails.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/styles/classical-polish-v2.css', import.meta.url), 'utf8');
const guardrailCss = fs.readFileSync(new URL('../public/styles/classical-polish-v2-guardrails.css', import.meta.url), 'utf8');

assert.match(script, /classical-work-thumbnail/, 'Works thumbnail enhancement should be present');
assert.match(script, /Current Obsessions/, 'Overview current-obsessions enhancement should be present');
assert.match(script, /classical-performance-strip/, 'Work performance strip should be present');
assert.match(script, /classical-calendar-agenda/, 'Mobile calendar agenda should be present');
assert.match(script, /classical-mobile-filters-panel/, 'Mobile Works filter panel should be present');
assert.match(guardrails, /max-width: 700px/, 'Viewport guardrail should track the mobile breakpoint');
assert.match(guardrails, /syncRepeatPlacement/, 'Late repeat dropdown should be moved into the mobile filter panel');
assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\).*important/s, 'Mobile composer library should use two columns');
assert.match(guardrailCss, /top: 56px !important/, 'Sticky view navigation should clear the sticky site header');

console.log('Classical polish v2 static checks passed.');
