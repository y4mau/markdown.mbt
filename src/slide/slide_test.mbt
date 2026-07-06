///| Slide module tests

///|
test "slide: parse single slide" {
  let doc = parse("# Title\n\nContent\n")
  inspect(doc.slide_count(), content="1")
  assert_true(not(doc.get_slide(0) is None))
}

///|
test "slide: parse multiple slides" {
  let doc = parse("# Slide 1\n\n---\n\n# Slide 2\n\n---\n\n# Slide 3\n")
  inspect(doc.slide_count(), content="3")
}

///|
test "slide: empty document" {
  let doc = parse("")
  inspect(doc.slide_count(), content="1")
  assert_true(not(doc.get_slide(0) is None))
}

///|
test "slide: get_slide valid index" {
  let doc = parse("# A\n\n---\n\n# B\n")
  assert_true(not(doc.get_slide(0) is None))
  assert_true(not(doc.get_slide(1) is None))
}

///|
test "slide: get_slide invalid index" {
  let doc = parse("# A\n")
  assert_true(doc.get_slide(-1) is None)
  assert_true(doc.get_slide(5) is None)
}

///|
test "slide: find_slide_at_position beginning" {
  let doc = parse("# Slide 1\n\n---\n\n# Slide 2\n")
  let idx = doc.find_slide_at_position(0)
  inspect(idx, content="0")
}

///|
test "slide: find_slide_at_position second slide" {
  let source = "# Slide 1\n\n---\n\n# Slide 2\n"
  let doc = parse(source)
  // Position after --- should be in slide 1
  let idx = doc.find_slide_at_position(source.length() - 1)
  inspect(idx, content="1")
}

///|
test "slide: find_slide_at_position past end" {
  let doc = parse("# A\n\n---\n\n# B\n")
  let idx = doc.find_slide_at_position(9999)
  // Should return last slide index
  inspect(idx, content="1")
}

///|
test "slide: get_slide_source" {
  let source = "# Slide 1\n\n---\n\n# Slide 2\n"
  let doc = parse(source)
  let src0 = doc.get_slide_source(0)
  inspect(src0.contains("Slide 1"), content="true")
  let src1 = doc.get_slide_source(1)
  inspect(src1.contains("Slide 2"), content="true")
}

///|
test "slide: get_slide_source invalid index" {
  let doc = parse("# A\n")
  inspect(doc.get_slide_source(99), content="")
}

///|
test "slide: slide indices are sequential" {
  let doc = parse("A\n\n---\n\nB\n\n---\n\nC\n")
  for i = 0; i < doc.slide_count(); i = i + 1 {
    match doc.get_slide(i) {
      Some(slide) => inspect(slide.index, content=i.to_string())
      None => panic()
    }
  }
}

// =============================================================================
// New tests: fragment steps and slide directives
// =============================================================================

///|
test "slide: -- splits slide into 2 steps" {
  let source = "# Slide\n\nfirst\n\n--\n\nsecond\n"
  let doc = parse(source)
  inspect(doc.slide_count(), content="1")
  match doc.get_slide(0) {
    Some(slide) => {
      inspect(slide.steps.length(), content="2")
      inspect(slide.steps[0].contains("first"), content="true")
      inspect(slide.steps[1].contains("second"), content="true")
    }
    None => panic()
  }
}

///|
test "slide: multiple -- separators produce 3 steps" {
  let source = "step1\n\n--\n\nstep2\n\n--\n\nstep3\n"
  let doc = parse(source)
  inspect(doc.slide_count(), content="1")
  match doc.get_slide(0) {
    Some(slide) => inspect(slide.steps.length(), content="3")
    None => panic()
  }
}

///|
test "slide: no -- means single step equal to content" {
  let source = "# Title\n\nsome content\n"
  let doc = parse(source)
  match doc.get_slide(0) {
    Some(slide) => {
      inspect(slide.steps.length(), content="1")
      inspect(slide.steps[0].contains("some content"), content="true")
    }
    None => panic()
  }
}

///|
test "slide: ::transition fade sets meta" {
  let source = "::transition fade\n\n# Content\n"
  let doc = parse(source)
  match doc.get_slide(0) {
    Some(slide) => {
      inspect(slide.meta.transition, content="Some(\"fade\")")
      // Directive block should not appear in steps
      inspect(slide.steps[0].contains("::transition"), content="false")
    }
    None => panic()
  }
}

///|
test "slide: ::background sets meta" {
  let source = "::background linear-gradient(red, blue)\n\n# Content\n"
  let doc = parse(source)
  match doc.get_slide(0) {
    Some(slide) =>
      inspect(
        slide.meta.background,
        content="Some(\"linear-gradient(red, blue)\")",
      )
    None => panic()
  }
}

///|
test "slide: ::effect confetti sets meta" {
  let source = "::effect confetti\n\n# Content\n"
  let doc = parse(source)
  match doc.get_slide(0) {
    Some(slide) => inspect(slide.meta.effect, content="Some(\"confetti\")")
    None => panic()
  }
}

///|
test "slide: invalid transition is None" {
  let source = "::transition wobble\n\n# Content\n"
  let doc = parse(source)
  match doc.get_slide(0) {
    Some(slide) => inspect(slide.meta.transition, content="None")
    None => panic()
  }
}

///|
test "slide: unknown directive key is ignored but block consumed" {
  let source = "::foo bar\n\n# Content\n"
  let doc = parse(source)
  match doc.get_slide(0) {
    Some(slide) => {
      // Unknown key has no effect on meta
      inspect(slide.meta.transition, content="None")
      inspect(slide.meta.background, content="None")
      inspect(slide.meta.effect, content="None")
      // Directive block is consumed (not in steps)
      inspect(slide.steps[0].contains("::foo"), content="false")
    }
    None => panic()
  }
}

///|
test "slide: directives and fragments combined" {
  let source = "::transition slide\n\npart1\n\n--\n\npart2\n"
  let doc = parse(source)
  match doc.get_slide(0) {
    Some(slide) => {
      inspect(slide.meta.transition, content="Some(\"slide\")")
      inspect(slide.steps.length(), content="2")
      inspect(slide.steps[0].contains("part1"), content="true")
      inspect(slide.steps[1].contains("part2"), content="true")
    }
    None => panic()
  }
}

///|
test "slide: -- inside fenced code is not a separator" {
  let source = "# Slide\n\n```\n--\n```\n\nafter\n"
  let doc = parse(source)
  match doc.get_slide(0) {
    Some(slide) =>
      // The -- inside fenced code should not split steps
      inspect(slide.steps.length(), content="1")
    None => panic()
  }
}

///|
test "slide: meta is per-slide, does not leak between slides" {
  let source = "::transition fade\n\n# Slide 1\n\n---\n\n# Slide 2\n"
  let doc = parse(source)
  inspect(doc.slide_count(), content="2")
  match doc.get_slide(0) {
    Some(slide) => inspect(slide.meta.transition, content="Some(\"fade\")")
    None => panic()
  }
  match doc.get_slide(1) {
    Some(slide) => inspect(slide.meta.transition, content="None")
    None => panic()
  }
}
