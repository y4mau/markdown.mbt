/**
 * @moonbit/markdown - Slide API TypeScript definitions
 */

/**
 * Data for a single parsed slide.
 */
export interface SlideData {
  /** 0-indexed slide number */
  index: number;
  /** Start byte offset in source */
  start: number;
  /** End byte offset in source (exclusive) */
  end: number;
  /** Fragment steps: source text of each step (split by standalone "--" paragraphs) */
  steps: string[];
  /** Validated transition: "fade" | "slide" | "zoom" | "flip" | "none", or null */
  transition: string | null;
  /** Background value (any non-empty string), or null */
  background: string | null;
  /** Validated effect: "confetti" | "sparkle", or null */
  effect: string | null;
}

/**
 * Result of parsing a markdown document into slides.
 */
export interface ParseSlidesResult {
  slides: SlideData[];
}

/**
 * Parse markdown source into slide data.
 *
 * Slides are split on thematic breaks (---).
 * Within each slide, standalone "--" paragraphs split the content into fragment steps.
 * Directive lines (::key value) set per-slide metadata.
 *
 * @example
 * const result = parseSlides("# Slide 1\n\n::transition fade\n\nHello\n\n--\n\nWorld\n\n---\n\n# Slide 2\n");
 * result.slides[0].transition; // "fade"
 * result.slides[0].steps.length; // 2
 */
export function parseSlides(source: string): ParseSlidesResult;
