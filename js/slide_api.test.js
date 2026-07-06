import { describe, it, expect } from "vitest";
import { parseSlides } from "./slide_api.js";

describe("parseSlides", () => {
  it("returns slides array for basic 2-slide document", () => {
    const source = "# Slide 1\n\n---\n\n# Slide 2\n";
    const result = parseSlides(source);
    expect(result).toHaveProperty("slides");
    expect(result.slides).toHaveLength(2);
    expect(result.slides[0].index).toBe(0);
    expect(result.slides[1].index).toBe(1);
  });

  it("includes start/end byte offsets", () => {
    const source = "# Slide 1\n\n---\n\n# Slide 2\n";
    const result = parseSlides(source);
    expect(typeof result.slides[0].start).toBe("number");
    expect(typeof result.slides[0].end).toBe("number");
    expect(result.slides[0].start).toBe(0);
  });

  it("splits steps via standalone -- paragraph", () => {
    const source = "# Slide\n\nfirst\n\n--\n\nsecond\n";
    const result = parseSlides(source);
    expect(result.slides).toHaveLength(1);
    expect(result.slides[0].steps).toHaveLength(2);
    expect(result.slides[0].steps[0]).toContain("first");
    expect(result.slides[0].steps[1]).toContain("second");
  });

  it("slide without -- has single step with content", () => {
    const source = "# Title\n\nsome content here\n";
    const result = parseSlides(source);
    expect(result.slides[0].steps).toHaveLength(1);
    expect(result.slides[0].steps[0]).toContain("some content here");
  });

  it("::transition directive populates transition field", () => {
    const source = "::transition fade\n\n# Content\n";
    const result = parseSlides(source);
    expect(result.slides[0].transition).toBe("fade");
  });

  it("invalid ::transition gives null", () => {
    const source = "::transition wobble\n\n# Content\n";
    const result = parseSlides(source);
    expect(result.slides[0].transition).toBeNull();
  });

  it("::background directive populates background field", () => {
    const source = "::background #ff0000\n\n# Content\n";
    const result = parseSlides(source);
    expect(result.slides[0].background).toBe("#ff0000");
  });

  it("::effect confetti populates effect field", () => {
    const source = "::effect confetti\n\n# Content\n";
    const result = parseSlides(source);
    expect(result.slides[0].effect).toBe("confetti");
  });

  it("absent directives are null not undefined", () => {
    const source = "# Simple slide\n";
    const result = parseSlides(source);
    expect(result.slides[0].transition).toBeNull();
    expect(result.slides[0].background).toBeNull();
    expect(result.slides[0].effect).toBeNull();
  });

  it("JSON shape has correct field types", () => {
    const source = "::transition slide\n\nstep1\n\n--\n\nstep2\n\n---\n\n# Next\n";
    const result = parseSlides(source);
    const slide = result.slides[0];
    expect(typeof slide.index).toBe("number");
    expect(typeof slide.start).toBe("number");
    expect(typeof slide.end).toBe("number");
    expect(Array.isArray(slide.steps)).toBe(true);
    expect(typeof slide.transition).toBe("string");
    expect(result.slides[1].transition).toBeNull();
  });

  it("directives do not appear in steps content", () => {
    const source = "::transition zoom\n\n# Content\n";
    const result = parseSlides(source);
    expect(result.slides[0].steps[0]).not.toContain("::transition");
  });

  it("meta does not leak between slides", () => {
    const source = "::transition fade\n\n# Slide 1\n\n---\n\n# Slide 2\n";
    const result = parseSlides(source);
    expect(result.slides[0].transition).toBe("fade");
    expect(result.slides[1].transition).toBeNull();
  });
});
