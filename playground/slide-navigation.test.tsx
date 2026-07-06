import { describe, expect, it } from "vitest";
import { next, prev, isAtEnd, isAtStart, progress, slideIndexAtOffset } from "./slide-navigation";
import type { SlideData } from "../js/slide_api";

// Build a SlideData with given steps; start/end spans are filled in sequentially.
let spanCursor = 0;
function slide(...steps: string[]): SlideData {
  const start = spanCursor;
  const len = Math.max(1, steps.join("\n").length);
  const end = start + len;
  spanCursor = end + 4; // gap for the "---" separator
  return {
    index: 0,
    start,
    end,
    steps,
    transition: null,
    background: null,
    effect: null,
  };
}

function makeDeck(): SlideData[] {
  spanCursor = 0;
  const deck = [slide("a"), slide("b1", "b2", "b3"), slide("c")];
  deck.forEach((s, i) => (s.index = i));
  return deck;
}

describe("next", () => {
  const deck = makeDeck();
  it("reveals the next fragment before changing slides", () => {
    expect(next(deck, { slide: 1, fragment: 0 })).toEqual({ slide: 1, fragment: 1 });
    expect(next(deck, { slide: 1, fragment: 1 })).toEqual({ slide: 1, fragment: 2 });
  });

  it("moves to the next slide after the last fragment", () => {
    expect(next(deck, { slide: 0, fragment: 0 })).toEqual({ slide: 1, fragment: 0 });
    expect(next(deck, { slide: 1, fragment: 2 })).toEqual({ slide: 2, fragment: 0 });
  });

  it("stays put at the very end", () => {
    expect(next(deck, { slide: 2, fragment: 0 })).toEqual({ slide: 2, fragment: 0 });
  });
});

describe("prev", () => {
  const deck = makeDeck();
  it("hides the latest fragment before changing slides", () => {
    expect(prev(deck, { slide: 1, fragment: 2 })).toEqual({ slide: 1, fragment: 1 });
  });

  it("moves to the previous slide with all fragments revealed", () => {
    expect(prev(deck, { slide: 2, fragment: 0 })).toEqual({ slide: 1, fragment: 2 });
    expect(prev(deck, { slide: 1, fragment: 0 })).toEqual({ slide: 0, fragment: 0 });
  });

  it("stays put at the very start", () => {
    expect(prev(deck, { slide: 0, fragment: 0 })).toEqual({ slide: 0, fragment: 0 });
  });
});

describe("isAtStart / isAtEnd", () => {
  const deck = makeDeck();
  it("detects the boundaries of the deck", () => {
    expect(isAtStart({ slide: 0, fragment: 0 })).toBe(true);
    expect(isAtStart({ slide: 0, fragment: 1 })).toBe(false);
    expect(isAtEnd(deck, { slide: 2, fragment: 0 })).toBe(true);
    expect(isAtEnd(deck, { slide: 1, fragment: 2 })).toBe(false);
  });
});

describe("progress", () => {
  const deck = makeDeck();
  it("reports 0 at the start and 1 at the end", () => {
    expect(progress(deck, { slide: 0, fragment: 0 })).toBe(0);
    expect(progress(deck, { slide: 2, fragment: 0 })).toBe(1);
  });

  it("grows monotonically through fragments and slides", () => {
    const a = progress(deck, { slide: 0, fragment: 0 });
    const b = progress(deck, { slide: 1, fragment: 0 });
    const c = progress(deck, { slide: 1, fragment: 1 });
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it("handles a single-step deck without dividing by zero", () => {
    spanCursor = 0;
    expect(progress([slide("only")], { slide: 0, fragment: 0 })).toBe(1);
  });
});

describe("slideIndexAtOffset", () => {
  // Slides with explicit, non-overlapping spans: [0,10), [10,20), [20,30).
  const deck: SlideData[] = [
    { index: 0, start: 0, end: 10, steps: ["a"], transition: null, background: null, effect: null },
    { index: 1, start: 10, end: 20, steps: ["b"], transition: null, background: null, effect: null },
    { index: 2, start: 20, end: 30, steps: ["c"], transition: null, background: null, effect: null },
  ];

  it("maps offsets within a span to that slide", () => {
    expect(slideIndexAtOffset(deck, 0)).toBe(0);
    expect(slideIndexAtOffset(deck, 9)).toBe(0);
    expect(slideIndexAtOffset(deck, 10)).toBe(1);
    expect(slideIndexAtOffset(deck, 25)).toBe(2);
  });

  it("clamps an offset at or past the last end to the last slide", () => {
    expect(slideIndexAtOffset(deck, 30)).toBe(2);
    expect(slideIndexAtOffset(deck, 1000)).toBe(2);
  });

  it("clamps an offset before the first start to the first slide", () => {
    const shifted: SlideData[] = [
      { index: 0, start: 5, end: 10, steps: ["a"], transition: null, background: null, effect: null },
    ];
    expect(slideIndexAtOffset(shifted, 0)).toBe(0);
  });

  it("returns 0 for an empty deck", () => {
    expect(slideIndexAtOffset([], 5)).toBe(0);
  });
});
