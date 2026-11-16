[![make.fun](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/bounty/markdown-render-speed-02)
[![rank](https://make.fun/badge/markdown-render-speed-02/olivnomusa-hue/mdrender-speed-02/rank.svg)](https://make.fun/bounty/markdown-render-speed-02)
[![reward](https://make.fun/badge/markdown-render-speed-02/olivnomusa-hue/mdrender-speed-02/reward.svg)](https://make.fun/bounty/markdown-render-speed-02)

Competition entry: [markdown-render-speed-02 on make.fun](https://make.fun/bounty/markdown-render-speed-02)

# Fast drop-in `parse()` for marked 18.1.3

`parse.js` renders Markdown to HTML that is **byte-identical** to
`marked.parse(markdown)` from **marked 18.1.3** with marked's default options
(`gfm: true`, `breaks: false`, `pedantic: false`, `async: false`) — but
faster. One dependency-free ES module: no imports, no npm packages, no
WebAssembly, nothing installed.

`main.ts` is the driver the harness runs: it reads every case from
`MAKEFUN_INPUT_DIR ?? /input` (`cases.json`, an array of `{id, markdown}`),
renders each one alone with `parse()`, and writes `html.json` (an array of
HTML strings, same order) to `MAKEFUN_OUTPUT_DIR ?? /output`.

## How to run

```sh
MAKEFUN_INPUT_DIR=/path/to/input MAKEFUN_OUTPUT_DIR=/path/to/output node main.ts
```

Outside a container those two variables stand in for `/input` and `/output`;
with neither set it reads `/input/cases.json` and writes `/output/html.json`.
Node 22+ (the harness runs `node /bot/main.ts` on Node 22, which strips
TypeScript types natively).

## Correctness

The gate is strict equality, code unit for code unit, against marked's own
rendering of every case.

| check | result |
| --- | --- |
| 720-case practice set (680 CommonMark/GFM spec examples + 40 generated docs), strict `===` per case | **PASS 720/720** |
| `/output/html.json` vs. marked + `JSON.stringify`, byte for byte | identical |
| two consecutive runs | byte-identical (deterministic) |

## Benchmark

Same 720-case practice set, single-threaded, best-of-5 per group, this entry's
`parse()` vs marked 18.1.3 (warm=10, loops=20 harness, 17 final runs):

| program | spec speedup (680 cases) | docs speedup (40 cases) |
| --- | --- | --- |
| marked 18.1.3 (reference) | 1.00x | 1.00x |
| v1 submission (this entry, submitted) | 1.37x | 1.31x |
| **FastDrop v2 (this entry, final)** | **1.63x median (max 1.73x)** | **1.47x median (max 1.64x)** |

**FastDrop parse: 1.6x spec, 1.5x docs vs marked 18.1.3** (median of 17
single-pass runs: spec 1.49–1.73x, docs 1.38–1.64x; run-to-run spread comes
almost entirely from the marked side — our own spec time is stable at
0.006 s and docs at ~0.54 s). Against the v1 submission measured on the same
harness this pass is ~19% faster on spec and ~12% faster on docs.

## How it stays identical

`parse.js` is a faithful, dependency-free adaptation of marked's own algorithm
(see `NOTICE`) with measured hot-path work on top. Every optimisation keeps
byte-for-byte output: a change that altered a single byte was reverted.

- first-character dispatch in the block lexer and the inline loop, so rules
  that cannot match are never tried;
- cheap pre-filters before the table, setext, and "new block starts here"
  scans (string scans that strictly imply a match is impossible);
- an inline text fast path for runs with no special characters, plus guards
  that skip the masking / unescape passes when nothing can match;
- memoised per-indent and per-bullet regexes (patterns only — no output is
  ever cached; each case is parsed alone, with nothing kept from an earlier
  call);
- hot loops rewritten from `split` / `trim` / `replace` to direct character
  scans, and the emphasis-mask stack kept on the tokenizer instance instead of
  a WeakMap.
