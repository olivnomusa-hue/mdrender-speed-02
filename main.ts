// Driver for markdown-render-speed-02: render every practice case with the
// drop-in parse() from parse.js and write the HTML array for the scorer.
// Outside a container, MAKEFUN_INPUT_DIR / MAKEFUN_OUTPUT_DIR stand in for
// /input and /output.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from './parse.js';

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

type Case = { id: string; markdown: string };

// JSON string literal for HTML: only ", \, control characters and surrogates
// need escaping, and a scan for them beats JSON.stringify over 4 MB of output.
function quote(s: string): string {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c === 0x22 || c === 0x5c || (c >= 0xd800 && c <= 0xdfff)) return JSON.stringify(s);
  }
  return '"' + s + '"';
}

const cases: Case[] = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8'));
const out: string[] = new Array(cases.length);
for (let i = 0; i < cases.length; i++) {
  out[i] = parse(cases[i].markdown);
}
let json = '[';
for (let i = 0; i < out.length; i++) json += (i === 0 ? '' : ',') + quote(out[i]);
json += ']';
writeFileSync(join(outputDir, 'html.json'), json);
