// main.ts — harness driver for markdown-render-speed-02.
// Reads every case from MAKEFUN_INPUT_DIR ?? /input (cases.json: [{id, markdown}]),
// renders each one alone with parse() from ./parse.js, and writes the HTML array
// to MAKEFUN_OUTPUT_DIR ?? /output as html.json, in the cases' order.
// Node 22 strips the type annotations natively (erasable syntax only).

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from './parse.js';

type Case = { id: string; markdown: string };

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases: Case[] = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8'));
const html: string[] = new Array(cases.length);
for (let i = 0; i < cases.length; i++) {
  html[i] = parse(cases[i].markdown);
}
writeFileSync(join(outputDir, 'html.json'), JSON.stringify(html));
