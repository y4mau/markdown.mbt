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
