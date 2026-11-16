# Fast drop-in `parse()` for marked 18.1.3

A dependency-free Markdown renderer that returns byte-identical HTML to
`marked.parse(markdown)` from **marked 18.1.3** with marked's default options
(`gfm: true`, `breaks: false`, `pedantic: false`, `async: false`), but faster.
Built for the make.fun competition *markdown-render-speed-02*.

* `parse.js` — the renderer: a single ES module, no imports, no dependencies.
  It is a port of marked's own algorithm (see `NOTICE`) with measured hot-path
  work on top. Correctness comes first: an optimisation that changes a single
  byte is reverted.
* `main.ts` — the driver the harness runs. It reads `cases.json` (an array of
  `{id, markdown}`) from `MAKEFUN_INPUT_DIR ?? /input`, pushes `parse()` of each
  case's Markdown, and writes the HTML array to
  `MAKEFUN_OUTPUT_DIR ?? /output` `/html.json`.

## How to run

```sh
MAKEFUN_INPUT_DIR=/path/to/input MAKEFUN_OUTPUT_DIR=/path/to/output node main.ts
```

Outside a container those two variables stand in for `/input` and `/output`;
with neither set it reads `/input/cases.json` and writes `/output/html.json`.
Node 22 or later (the harness runs `node /bot/main.ts` on Node 22.23.4, which
strips TypeScript types natively). Nothing is installed: `parse.js` imports
nothing at all.

## Correctness

The gate is strict equality, code unit for code unit, against marked's own
rendering of every case.

| check | result |
| --- | --- |
| 720-case practice set, strict `===` per case | **PASS 720/720** |
| `/output/html.json` vs. marked + `JSON.stringify`, byte for byte | **identical** (4,042,837 bytes) |
| two consecutive runs | **byte-identical** (deterministic) |
| spec examples (680) vs. generated documents (40) | both pass |

Whitespace, line ends, entities and attribute order are compared exactly as the
scorer compares them; nothing is normalised anywhere in the pipeline.

## How it was measured

All numbers are CPU time (`user + system`, `process.cpuUsage()`), not wall
time, on the same host with Node v26. Two harnesses, both interleaving the
house baseline and this entry in one process (baseline first, then alternating)
so neither is favoured by JIT or machine-load drift:

1. **parse-only, fresh process per timing, best of 7 interleaved runs** — the
   harness imports `baselines/parse.js` (vendored marked 18.1.3) and
   `repo/parse.js`, and times only the render loop over the given cases.
2. **end-to-end, fresh process per timing, median of 5** — runs
   `baselines/main.ts` and `main.ts` over the whole practice set with
   `MAKEFUN_INPUT_DIR` set, i.e. JSON read + parse + JSON write, exactly as the
   harness does.

### Benchmark log (practice set, round 33735412)

| workload | baseline (marked 18.1.3) | this entry | speedup |
| --- | --- | --- | --- |
| all 720 cases, parse only, best of 7 | 814–849 ms | 635–642 ms | **1.27–1.34x** |
| the 40 generated documents (2,846,479 chars), parse only, best of 7 | 791–814 ms | 613–626 ms | **1.27–1.31x** |
| the 680 spec examples (16,334 chars), parse only, best of 7 | 17–19 ms | 12–13 ms | **1.3–1.5x** |
| end-to-end (read + parse + write), median of 5 | 1.87–1.96 s | 1.54–1.59 s | **1.21–1.24x** |
| end-to-end, best of 5 | 1.80–1.88 s | 1.52–1.56 s | **1.24x** |

The documents are 99.4 % of the input, so they are what the score turns on;
they run **~1.3x** faster than marked. The end-to-end ratio is lower because
about 0.3 s of every run is fixed cost that neither renderer controls: reading
and `JSON.parse`-ing a 3 MB `cases.json`, `JSON.stringify`-ing a 4 MB output,
and starting Node. Of that driver cost only the output serialisation was
touched — `main.ts` builds the JSON itself with a character scan that falls
back to `JSON.stringify` for any string that actually needs escaping, which
performs byte-for-byte the same JSON.

The scored set is the same kind of data (the same 680 spec examples plus 40
generated READMEs of 20,000–100,000 characters), so the document row is the
relevant one.

## What was measured, and what it changed

Profiles were taken with `node --cpu-prof` over the whole practice set, plus a
per-tokenizer wall-clock harness (wrapping every tokenizer method with
`process.hrtime.bigint()`), and every change below was re-checked against the
720/720 gate before it was kept. In profile order the wins came from:

1. **List tokenizer (~10 % of runtime).** Every line of every list item ran six
   block regexes, two `String.split('\n', 1)[0]`, two `trim()`, two
   `search(/[^ ]/)` and a leading-whitespace `replace` with a callback. Now:
   a first-character table decides that six regexes cannot match and skips
   them, `indexOf('\n')` replaces `split(..., 1)[0]`, one `trim()` per line
   instead of two, a hand-rolled scan replaces `search(/[^ ]/)`, and the
   leading-whitespace expansion returns the original string untouched when the
   line holds no tab (the `replace` used to copy the line either way).
2. **The emphasis mask.** marked masks a chunk (links, code spans, escapes)
   before looking for `*`/`_`/`~` closers, with three full-string regex
   replaces, and rescans for closers. Now one `charCodeAt` pass computes which
   of the eight characters the mask cares about; the mask and its closer scan
   are both skipped outright when the flags prove they cannot change anything,
   the three replaces are individually guarded by the flags they need, and the
   reference-link callback is hoisted out of the per-chunk arrow allocation.
3. **First-character dispatch.** The block lexer and the inline lexer each test
   a dozen anchored rules per position; two 128-entry tables (derived from the
   rules' own sources, never guessed) skip every rule whose first character
   cannot match, so a run starting with a letter runs two tokenizers instead of
   eleven.
4. **Escaping.** A `charCodeAt` scan decides `P()` (the escape function) and
   `Ie()` (numeric character references, which need a literal `&`) instead of
   running a character-class regex over every text token.
5. **Small, steady wins.** `String.indexOf('\r')` before the CRLF normalisation
   replace; code-point counting in `em`/`del` without spreading into an array;
   the em/delimiter mask stack as a plain LIFO instead of a `WeakMap`; a single
   pass over each inline chunk instead of up to eight `String.includes` calls.

Anything that could not be shown to be byte-identical on the gate was reverted
— the dispatch tables and the mask short-circuits are the only places where the
port is allowed to skip marked's own work, and both are derived from the rules
marked itself matches against.
