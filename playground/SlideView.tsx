///| Renders a single slide at a given fragment index (Luna UI).
///|
///| Each step string is parsed independently via parse() and rendered with
///| MarkdownRenderer. Steps with index > the visible fragment are hidden via
///| the `.sld-fragment` CSS (opacity/translateY), revealing them one at a time.
///|
///| NOTE: MarkdownRenderer emits `data-span` attributes whose offsets are
///| *step-local* (each step is parsed in isolation), so they do NOT match
///| document source offsets. That is fine because the main app's click-to-source
///| handler (`handlePreviewClick` in main.tsx) is attached only to the `.preview`
///| element; slides render in a separate container and never participate in that
///| sync. Do not render SlideView inside `.preview`.

import { parse } from "../js/api.js";
import type { Root } from "mdast";
import { MarkdownRenderer } from "./ast-renderer";
import type { SlideData } from "../js/slide_api";

interface SlideViewProps {
  slide: SlideData;
  /** Index of the last visible fragment step; defaults to all visible. */
  fragment?: number;
}

function parseStep(step: string): Root | null {
  try {
    return parse(step);
  } catch {
    return null;
  }
}

export function SlideView(props: SlideViewProps) {
  const slide = props.slide;
  const visible = props.fragment ?? slide.steps.length - 1;

  // Apply the background directive as a raw inline style value only (never HTML).
  const style = slide.background ? { background: slide.background } : undefined;

  return (
    <div class="sld-slide" style={style}>
      <div class="sld-slide-content">
        {slide.steps.map((step, i) => {
          const ast = parseStep(step);
          return (
            <div key={i} class={i <= visible ? "sld-fragment sld-visible" : "sld-fragment"}>
              {ast ? <MarkdownRenderer ast={ast} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
