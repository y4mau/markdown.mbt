# Testing Strategy

This document defines the testing strategy for the markdown.mbt project — a CST-based incremental Markdown parser in MoonBit with a playground UI.

## Baseline Coverage

**Measured on:** 2025-03-09 (feat/test-coverage-and-automation branch, commit `143cfe2`). This is a historical baseline; re-run verification commands to get current numbers.

| Metric | Value |
|--------|-------|
| Entire project | 73.5% (4457/6065) |
| Core parser | 90.9% (2198/2418) |
| Total test blocks | 1285 (591 unit + 671 spec + 23 E2E) |

Core = block_parser + inline_parser + serializer + renderer + incremental + scanner + plugin (excluding bench, crdt_experiment, inline_token, exports). Scanner and plugin are included in the core metric but omitted from the module breakdown table because they have no uncovered lines worth targeting.

### Module Breakdown

| Module | Covered/Total | % | Priority |
|--------|--------------|---|----------|
| block_parser.mbt | 803/860 | 93.4% | Low |
| inline_parser.mbt | 605/728 | 83.1% | Med |
| inline_token.mbt | 481/661 | 72.8% | Low (strict mode) |
| serializer.mbt | 278/302 | 92.1% | Low |
| renderer.mbt | 258/273 | 94.5% | Low |
| incremental.mbt | 100/101 | 99.0% | Done |
| exports.mbt | 3/27 | 11.1% | Low (FFI) |
| bench.mbt | 0/109 | 0% | Skip |
| crdt_experiment.mbt | 26/28 | 92.9% | Skip |
| api/json_ast.mbt | 195/239 | 81.6% | Med |
| api/exports.mbt | 0/40 | 0% | Low (FFI) |
| notebook/ (7 files) | 443/871 | 50.9% | **High** |
| mdx/ (5 files) | 330/532 | 62.0% | **High** |
| purify/ (3 files) | 339/424 | 80.0% | Med |
| tui/ (4 files) | 268/465 | 57.6% | **High** |
| slide/slide.mbt | 37/42 | 88.1% | Low |
| toc/ (2 files) | 40/69 | 58.0% | Med |
| frontmatter.mbt | 25/31 | 80.6% | Low |
| info_string/ | (all covered) | 100% | Done |
| slug/ | (all covered) | 100% | Done |

## Testing Pyramid

```
          /   E2E   \        ~23 tests   (Playwright)
         /------------\      Browser interactions, visual rendering
        / Integration   \     ~671 defined (cmark + gfm + html spec)
       /------------------\   Spec compliance, cross-module roundtrips
      /    Unit Tests       \  ~591 tests  (core + modules + tui)
     /------------------------\ Pure functions, isolated module behavior
```

Test counts are individual `test "..."` blocks in `*.mbt` files. Integration "defined" includes skipped tests (`#skip`); passing subset is smaller (see Per-Feature Summary).

### Layer Definitions

#### Unit Tests

All non-spec MoonBit `test` blocks in `src/` (primarily in `*_test.mbt` files, plus benchmark and in-module tests).

- Test individual functions in isolation
- No I/O, no external dependencies
- Run on all targets: js, native, wasm-gc
- Coverage measured via `--enable-coverage` on js target

#### Integration Tests

Auto-generated spec tests and roundtrip tests.

- **CommonMark spec:** parse -> render -> compare against reference (542 defined, 205 currently passing)
- **GFM spec:** same, for GFM extensions (43 defined, 25 currently passing)
- **HTML output:** parse -> render_html -> compare (86 defined, 86 passing)
- **Roundtrip:** parse -> serialize -> reparse -> assert equality (included in unit test counts, not spec counts)
- Run on js target only (reference output is JS-based)

#### E2E Tests

Playwright tests in `e2e/`.

- Browser-based playground interactions
- Editor loading, reactivity, task toggling, theme switching
- Run via `pnpm exec playwright test`
- Not measured in MoonBit coverage (separate JS/WASM runtime)

### Layer Balance

| Layer | Defined | Passing | Target (passing) |
|-------|---------|---------|------------------|
| Unit | ~591 | ~591 | ~690 |
| Integration (spec) | ~671 | ~316 (205 cmark + 25 gfm + 86 html) | Maintain |
| E2E | ~23 | ~23 | ~30 |

The heavy unit test proportion is correct for a parser library. Integration tests via spec suites provide compliance assurance. E2E tests are supplementary for the playground UI. Reassess this balance if new modules introduce cross-module side effects (e.g., notebook evaluator calling into parser + renderer) or if playground features grow beyond simple rendering.

## Coverage Targets

### Overall

| Metric | Current | Target | Delta |
|--------|---------|--------|-------|
| Entire coverage | 73.5% (4457/6065) | **80%** (4852/6065) | +395 lines |
| Core coverage | 90.9% (2198/2418) | **92%** (2225/2418) | +27 lines |
| Tier 2 weighted avg | 62.1% (1615/2600) | **75%** | Lift notebook/mdx/tui |

### Tier 1 — Core Parser (maintain)

**Target: 92%** (current 90.9%)

| File | Current | Target | Delta | Action |
|------|---------|--------|-------|--------|
| block_parser.mbt | 93.4% | 95% | +14 lines | Paragraph interrupt edge cases |
| inline_parser.mbt | 83.1% | 86% | +21 lines | Link/image EOF edges |
| serializer.mbt | 92.1% | 94% | +6 lines | Frontmatter raw edge, fence >63 |
| renderer.mbt | 94.5% | 96% | +4 lines | RefLink/RefImage render paths |
| incremental.mbt | 99.0% | 99% | 0 | Maintain |

**Test type:** Unit tests only. Pure functions with no I/O.

Note: Per-file deltas sum to +45, which intentionally over-targets the +27 overall core delta to provide a safety margin — not all targets need to be hit simultaneously. Percentage targets are approximate (rounded to nearest whole percent); delta line counts are ceiling-based estimates.

### Tier 2 — Feature Modules (biggest ROI)

**Target: 75%** (current weighted average: 1615/2600 = 62.1% across notebook+mdx+tui+purify+toc+api/json_ast)

| Module | Current | Target | Delta | Est. Tests |
|--------|---------|--------|-------|------------|
| notebook/ | 50.9% | 70% | +166 lines | ~25 unit tests |
| mdx/ | 62.0% | 75% | +69 lines | ~15 unit tests |
| tui/ | 57.6% | 75% | +81 lines | ~15 unit tests |
| purify/ | 80.0% | 85% | +21 lines | ~8 unit tests |
| toc/ | 58.0% | 80% | +15 lines | ~5 unit tests |
| api/json_ast.mbt | 81.6% | 90% | +20 lines | ~8 unit tests |

**Test type:** Mostly unit tests. Notebook evaluator paths may need mock-based integration tests. Delta values are ceiling-based estimates; exact line counts may vary slightly.

### Tier 3 — Excluded / Diminishing Returns

**No target** — accept current coverage:

| Module | Reason |
|--------|--------|
| src/bench.mbt, src/mdx/bench.mbt | Benchmark code, excluded from coverage targets |
| src/inline_token.mbt (72.8%) | Strict mode delimiter stack; tested indirectly via cmark_tests |
| src/exports.mbt, src/api/exports.mbt | FFI bindings; tested via integration from JS side |
| src/crdt_experiment.mbt | Experimental, may be removed |
| src/cmark_tests/, src/gfm_tests/, src/html_tests/ helpers | Test infrastructure, not production code |

Even though these modules have no coverage targets, run a periodic smoke check (e.g., `moon check` and `moon test` on all targets) to catch compilation or type errors from upstream changes.

### Per-Feature Summary

| Feature | Current | Target | Test Type |
|---------|---------|--------|-----------|
| Parsing (block + inline) | 88.5% | 91% | Unit |
| Serialization | 92.1% | 94% | Unit + Roundtrip |
| HTML Rendering | 94.5% | 96% | Unit |
| Incremental Parsing | 99.0% | 99% | Unit |
| MDX Processing | 62.0% | 75% | Unit |
| Notebook Evaluation | 50.9% | 70% | Unit + Integration |
| TUI Rendering | 57.6% | 75% | Unit |
| HTML Sanitization (purify) | 80.0% | 85% | Unit |
| TOC Extraction | 58.0% | 80% | Unit |
| JSON AST | 81.6% | 90% | Unit |
| CommonMark Compliance | 205/542 passing | Maintain | Spec integration |
| GFM Compliance | 25/43 passing | Maintain | Spec integration |
| Playground UI | — | — | E2E (Playwright) |

## Implementation Phases

### Phase 1: notebook/ (biggest gap, +166 lines)

Focus on `src/notebook/analyzer.mbt` (93 uncovered), `src/notebook/api.mbt` (88 uncovered), and `src/notebook/parser.mbt` (7 uncovered).

Skip `src/notebook/evaluator.mbt` and `src/notebook/js_evaluator.mbt` (JS-runtime dependent, 207 lines combined). Consider integration tests or mocks for these later.

### Phase 2: tui/ (+81 lines)

Focus on `src/tui/renderer.mbt` (101 uncovered) and `src/tui/plugin.mbt` (87 uncovered). These are pure render functions — straightforward unit tests.

### Phase 3: mdx/ (+69 lines)

Focus on `src/mdx/transformer.mbt` (51 uncovered) and `src/mdx/types.mbt` (23 uncovered). `src/mdx/block_parser.mbt` (70 uncovered) shares patterns with core block_parser.

### Phase 4: Smaller modules

- src/toc/ (+15 lines)
- src/purify/ (+21 lines)
- src/api/json_ast.mbt (+20 lines)
- src/slide/slide.mbt (+5 lines)
- src/frontmatter/frontmatter.mbt (+6 lines)

### Phase 5: Core polish (+27 lines)

Block parser paragraph interrupts, inline parser EOF edges, serializer/renderer minor paths.

## Verification Commands

Prerequisites: MoonBit CLI installed (`moon` on PATH), pnpm installed, and `pnpm install` completed. For spec tests, regenerate if needed: `node scripts/gen-tests.js` (CommonMark) and `node scripts/gen-gfm-tests.js` (GFM).

Test counts below refer to individual `test "..."` blocks in `*.mbt` files (unit + spec), plus `test(...)` calls in `e2e/*.ts` (E2E). Skipped tests (via `#skip`) are excluded from pass counts but included in totals.

```bash
# CI test commands (test-only subset; CI also runs moon check, etc.)
moon test src --target js,native,wasm-gc
moon test src/cmark_tests --target js
moon test src/gfm_tests --target js
moon test src/html_tests --target js
moon test src/tui --target all

# Coverage measurement (entire project)
moon coverage clean
moon test src --target js --enable-coverage
moon coverage analyze -- -f summary 2>&1 | grep 'Total:'
# Target: Total >= 4852/6065 (80%)

# Core coverage (package-level; includes bench/crdt/inline_token/exports)
# To get the filtered core metric, exclude non-core modules and sum:
moon coverage analyze -p mizchi/markdown -- -f detail 2>&1 \
  | grep -v 'bench\|crdt_experiment\|inline_token\|exports' \
  | grep -o '[0-9]*/[0-9]*' \
  | awk -F/ '{c+=$1; t+=$2} END{printf "Core: %d/%d (%.1f%%)\n", c, t, c*100/t}'

# E2E
pnpm exec playwright test
```

## Principles

1. **Unit tests first.** Parser functions are pure — prefer unit tests over integration tests for coverage.
2. **Spec tests for compliance.** CommonMark/GFM spec tests verify standards compliance, not implementation details.
3. **Don't chase 100%.** Tier 3 modules have valid reasons for lower coverage. Focus effort where ROI is highest.
4. **All targets matter.** Core unit tests must pass on js, native, and wasm-gc targets.
5. **Incremental improvement.** Follow the phased plan to lift coverage predictably.

## References

- [CommonMark Spec 0.31.2](https://spec.commonmark.org/0.31.2/)
- [GFM Spec](https://github.github.com/gfm/)
- [CI workflow](../.github/workflows/ci.yml)
- [CommonMark test generation](../scripts/gen-tests.js)
- [GFM test generation](../scripts/gen-gfm-tests.js)
- [CONTRIBUTING.md](../CONTRIBUTING.md)
