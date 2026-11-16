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

Same practice set, CPU time (user + sys) of one `node main.ts` run, 5 runs
each, kit baseline (marked behind the same driver) vs. this entry:

| program | runs (s) | best | median |
| --- | --- | --- | --- |
| house baseline (marked 18.1.3) | 1.85 1.84 1.85 1.85 1.75 | 1.75 | 1.85 |
| **this entry** | 1.55 1.60 1.73 1.72 1.58 | 1.55 | 1.60 |
| house baseline (second session) | 1.80 1.85 1.84 1.86 1.82 | 1.80 | 1.84 |
| **this entry (second session)** | 1.58 1.56 1.60 1.56 1.55 | 1.55 | 1.56 |

**≈ 1.17× faster than the baseline** (median CPU, 720-case set, measured
twice: 1.85 → 1.60 s and 1.84 → 1.56 s).

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
