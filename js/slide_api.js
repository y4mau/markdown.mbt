/**
 * @moonbit/markdown - Slide parsing API
 *
 * Parses markdown into slide data with fragment steps and directives.
 */

import { md_parse_slides } from "../_build/js/release/build/api/api.js";

/**
 * Parse markdown source into slide data.
 * @param {string} source - Markdown source
 * @returns {import('./slide_api').ParseSlidesResult} Parsed slide data
 */
export function parseSlides(source) {
  return JSON.parse(md_parse_slides(source));
}
