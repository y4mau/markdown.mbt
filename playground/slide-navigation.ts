///| Pure slide navigation logic, adapted from slidecraft's core/navigation.ts
///| to the parseSlides slide shape (steps: string[], start/end source spans).

import type { SlideData } from "../js/slide_api";

/** Position within a deck: which slide, and which fragment step is the last visible one. */
export interface DeckPosition {
  slide: number;
  fragment: number;
}

/** Advance one step: reveal the next fragment, else move to the next slide. */
export function next(deck: SlideData[], pos: DeckPosition): DeckPosition {
  const current = deck[pos.slide];
  if (current && pos.fragment < current.steps.length - 1) {
    return { slide: pos.slide, fragment: pos.fragment + 1 };
  }
  if (pos.slide < deck.length - 1) {
    return { slide: pos.slide + 1, fragment: 0 };
  }
  return pos;
}

/** Step back: hide the latest fragment, else move to the end of the previous slide. */
export function prev(deck: SlideData[], pos: DeckPosition): DeckPosition {
  if (pos.fragment > 0) {
    return { slide: pos.slide, fragment: pos.fragment - 1 };
  }
  if (pos.slide > 0) {
    const target = deck[pos.slide - 1]!;
    return { slide: pos.slide - 1, fragment: Math.max(0, target.steps.length - 1) };
  }
  return pos;
}

/** True when at the very first fragment of the first slide. */
export function isAtStart(pos: DeckPosition): boolean {
  return pos.slide === 0 && pos.fragment === 0;
}

/** True when at the last fragment of the last slide. */
export function isAtEnd(deck: SlideData[], pos: DeckPosition): boolean {
  const last = deck.length - 1;
  if (last < 0) return true;
  const lastSlide = deck[last]!;
  return pos.slide === last && pos.fragment === Math.max(0, lastSlide.steps.length - 1);
}

/** Overall progress through the deck, counting fragments, in [0, 1]. */
export function progress(deck: SlideData[], pos: DeckPosition): number {
  let total = 0;
  let index = 0;
  deck.forEach((slide, i) => {
    const steps = Math.max(1, slide.steps.length);
    if (i < pos.slide) {
      index += steps;
    } else if (i === pos.slide) {
      index += pos.fragment;
    }
    total += steps;
  });
  return total <= 1 ? 1 : index / (total - 1);
}

/**
 * Find the slide whose source span contains the given document offset.
 * Uses the start/end spans from parseSlides. An offset at or past the last
 * slide's end maps to the last slide (cursor-at-end behavior).
 */
export function slideIndexAtOffset(deck: SlideData[], offset: number): number {
  if (deck.length === 0) return 0;
  for (let i = 0; i < deck.length; i++) {
    const slide = deck[i]!;
    if (offset >= slide.start && offset < slide.end) {
      return i;
    }
  }
  // Past the last slide's end (or before the first start): clamp to last slide.
  const last = deck[deck.length - 1]!;
  if (offset >= last.end) return deck.length - 1;
  // Before the first slide's start: clamp to first slide.
  return 0;
}
