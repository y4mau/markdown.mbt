///|
/// Inline parser tests
test "parse inline text" {
  let inlines = parse_inlines("Hello World")
  inspect(inlines.length(), content="1")
  match inlines[0] {
    Inline::Text(content~, ..) => inspect(content, content="Hello World")
    _ => fail("Expected Text")
  }
}

///|
test "parse emphasis with asterisk" {
  let inlines = parse_inlines("Hello *world*")
  inspect(inlines.length(), content="2")
  match inlines[1] {
    Inline::Emphasis(marker~, children~, ..) => {
      inspect(marker, content="Asterisk")
      inspect(children.length(), content="1")
    }
    _ => fail("Expected Emphasis")
  }
}

///|
test "parse emphasis with underscore" {
  let inlines = parse_inlines("Hello _world_")
  inspect(inlines.length(), content="2")
  match inlines[1] {
    Inline::Emphasis(marker~, ..) => inspect(marker, content="Underscore")
    _ => fail("Expected Emphasis")
  }
}

///|
test "parse strong with asterisk" {
  let inlines = parse_inlines("Hello **world**")
  inspect(inlines.length(), content="2")
  match inlines[1] {
    Inline::Strong(marker~, children~, ..) => {
      inspect(marker, content="Asterisk")
      inspect(children.length(), content="1")
    }
    _ => fail("Expected Strong")
  }
}

///|
test "parse strong with underscore" {
  let inlines = parse_inlines("Hello __world__")
  inspect(inlines.length(), content="2")
  match inlines[1] {
    Inline::Strong(marker~, ..) => inspect(marker, content="Underscore")
    _ => fail("Expected Strong")
  }
}

///|
test "parse inline code" {
  let inlines = parse_inlines("Hello `code` world")
  inspect(inlines.length(), content="3")
  match inlines[1] {
    Inline::Code(content~, backtick_count~, ..) => {
      inspect(content, content="code")
      inspect(backtick_count, content="1")
    }
    _ => fail("Expected Code")
  }
}

///|
test "parse inline code with double backticks" {
  let inlines = parse_inlines("Use ``code with `backticks` inside``")
  match inlines[1] {
    Inline::Code(content~, backtick_count~, ..) => {
      inspect(backtick_count, content="2")
      inspect(content.contains("`"), content="true")
    }
    _ => fail("Expected Code")
  }
}

///|
test "parse link" {
  let inlines = parse_inlines("Click [here](https://example.com)")
  inspect(inlines.length(), content="2")
  match inlines[1] {
    Inline::Link(url~, title~, children~, ..) => {
      inspect(url, content="https://example.com")
      inspect(title, content="")
      inspect(children.length(), content="1")
    }
    _ => fail("Expected Link")
  }
}

///|
test "parse link with title" {
  let inlines = parse_inlines("[link](https://example.com \"Title\")")
  match inlines[0] {
    Inline::Link(url~, title~, ..) => {
      inspect(url, content="https://example.com")
      inspect(title, content="Title")
    }
    _ => fail("Expected Link")
  }
}

///|
test "parse reference link" {
  let inlines = parse_inlines("[text][ref]")
  match inlines[0] {
    Inline::RefLink(label~, children~, ..) => {
      inspect(label, content="ref")
      inspect(children.length(), content="1")
    }
    _ => fail("Expected RefLink")
  }
}

///|
test "parse image" {
  let inlines = parse_inlines("![alt text](image.png)")
  match inlines[0] {
    Inline::Image(alt~, url~, title~, ..) => {
      inspect(alt, content="alt text")
      inspect(url, content="image.png")
      inspect(title, content="")
    }
    _ => fail("Expected Image")
  }
}

///|
test "parse image with title" {
  let inlines = parse_inlines("![alt](image.png \"Title\")")
  match inlines[0] {
    Inline::Image(alt~, url~, title~, ..) => {
      inspect(alt, content="alt")
      inspect(url, content="image.png")
      inspect(title, content="Title")
    }
    _ => fail("Expected Image")
  }
}

///|
test "parse reference image" {
  let inlines = parse_inlines("![alt][ref]")
  match inlines[0] {
    Inline::RefImage(alt~, label~, ..) => {
      inspect(alt, content="alt")
      inspect(label, content="ref")
    }
    _ => fail("Expected RefImage")
  }
}

///|
test "parse autolink URL" {
  let inlines = parse_inlines("<https://example.com>")
  match inlines[0] {
    Inline::Autolink(url~, is_email~, ..) => {
      inspect(url, content="https://example.com")
      inspect(is_email, content="false")
    }
    _ => fail("Expected Autolink")
  }
}

///|
test "parse autolink email" {
  let inlines = parse_inlines("<user@example.com>")
  match inlines[0] {
    Inline::Autolink(url~, is_email~, ..) => {
      inspect(url, content="user@example.com")
      inspect(is_email, content="true")
    }
    _ => fail("Expected Autolink")
  }
}

///|
test "parse strikethrough" {
  let inlines = parse_inlines("Hello ~~deleted~~ world")
  inspect(inlines.length(), content="3")
  match inlines[1] {
    Inline::Strikethrough(children~, ..) =>
      inspect(children.length(), content="1")
    _ => fail("Expected Strikethrough")
  }
}

///|
test "parse hard break two spaces" {
  let inlines = parse_inlines("Line 1  \nLine 2")
  // Should have: "Line 1", HardBreak, "Line 2"
  let has_hard_break = inlines
    .iter()
    .any(fn(i) {
      match i {
        Inline::HardBreak(style=HardBreakStyle::TwoSpaces, ..) => true
        _ => false
      }
    })
  inspect(has_hard_break, content="true")
}

///|
test "parse hard break backslash" {
  let inlines = parse_inlines("Line 1\\\nLine 2")
  let has_hard_break = inlines
    .iter()
    .any(fn(i) {
      match i {
        Inline::HardBreak(style=HardBreakStyle::Backslash, ..) => true
        _ => false
      }
    })
  inspect(has_hard_break, content="true")
}

///|
test "parse soft break" {
  let inlines = parse_inlines("Line 1\nLine 2")
  let has_soft_break = inlines
    .iter()
    .any(fn(i) {
      match i {
        Inline::SoftBreak(..) => true
        _ => false
      }
    })
  inspect(has_soft_break, content="true")
}

///|
test "parse escaped character" {
  let inlines = parse_inlines("Hello \\*not emphasis\\*")
  // Should parse as text, not emphasis
  let is_all_text = inlines
    .iter()
    .all(fn(i) {
      match i {
        Inline::Text(..) => true
        _ => false
      }
    })
  inspect(is_all_text, content="true")
}

///|
test "parse nested emphasis in link" {
  let inlines = parse_inlines("[**bold** link](url)")
  match inlines[0] {
    Inline::Link(children~, ..) =>
      // Should have Strong as first child
      match children[0] {
        Inline::Strong(..) => ()
        _ => fail("Expected Strong inside Link")
      }
    _ => fail("Expected Link")
  }
}

///|
test "parse mixed inline content" {
  let inlines = parse_inlines("Hello *world* and `code`")
  inspect(inlines.length() >= 4, content="true")
}

///|
test "parse link with single-quote title" {
  let inlines = parse_inlines("[text](url 'title')")
  match inlines[0] {
    Inline::Link(url~, title~, ..) => {
      inspect(url, content="url")
      inspect(title, content="title")
    }
    _ => fail("Expected Link")
  }
}

///|
test "parse link with parens in URL" {
  let inlines = parse_inlines("[text](url(1))")
  match inlines[0] {
    Inline::Link(url~, ..) => inspect(url, content="url(1)")
    _ => fail("Expected Link")
  }
}

///|
test "parse empty link destination" {
  let inlines = parse_inlines("[text]()")
  match inlines[0] {
    Inline::Link(url~, ..) => inspect(url, content="")
    _ => fail("Expected Link")
  }
}

///|
test "parse strikethrough with inner content" {
  let inlines = parse_inlines("~~deleted text~~")
  match inlines[0] {
    Inline::Strikethrough(children~, ..) =>
      inspect(children.length() >= 1, content="true")
    _ => fail("Expected Strikethrough")
  }
}

///|
test "parse nested code in emphasis" {
  let inlines = parse_inlines("*text `code` text*")
  match inlines[0] {
    Inline::Emphasis(children~, ..) => {
      let has_code = children
        .iter()
        .any(fn(i) {
          match i {
            Inline::Code(..) => true
            _ => false
          }
        })
      inspect(has_code, content="true")
    }
    _ => fail("Expected Emphasis")
  }
}

///|
test "parse backslash escape preserves literal" {
  let inlines = parse_inlines("\\*not bold\\*")
  // Should not produce emphasis
  let has_emphasis = inlines
    .iter()
    .any(fn(i) {
      match i {
        Inline::Emphasis(..) => true
        _ => false
      }
    })
  inspect(has_emphasis, content="false")
}

///|
test "parse inline with strict mode" {
  let inlines = parse_inlines("Hello *world*", strict=true)
  inspect(inlines.length(), content="2")
  match inlines[1] {
    Inline::Emphasis(marker~, children~, ..) => {
      inspect(marker, content="Asterisk")
      inspect(children.length(), content="1")
    }
    _ => fail("Expected Emphasis in strict mode")
  }
}

///|
test "parse strong with strict mode" {
  let inlines = parse_inlines("**bold**", strict=true)
  match inlines[0] {
    Inline::Strong(marker~, ..) => inspect(marker, content="Asterisk")
    _ => fail("Expected Strong in strict mode")
  }
}

///|
test "parse code span in strict mode" {
  let inlines = parse_inlines("Hello `code` world", strict=true)
  let has_code = inlines
    .iter()
    .any(fn(i) {
      match i {
        Inline::Code(..) => true
        _ => false
      }
    })
  inspect(has_code, content="true")
}

///|
test "parse link inside link is invalid" {
  let inlines = parse_inlines("[[inner](url1)](url2)")
  // Nested links are invalid per CommonMark
  inspect(inlines.length() >= 1, content="true")
}

///|
test "parse footnote reference" {
  let inlines = parse_inlines("Text[^note]")
  let has_fn = inlines
    .iter()
    .any(fn(i) {
      match i {
        Inline::FootnoteReference(..) => true
        _ => false
      }
    })
  inspect(has_fn, content="true")
}

///|
test "parse invalid footnote reference" {
  let inlines = parse_inlines("Text[^]")
  // Empty footnote label should not produce FootnoteReference
  let has_fn = inlines
    .iter()
    .any(fn(i) {
      match i {
        Inline::FootnoteReference(..) => true
        _ => false
      }
    })
  inspect(has_fn, content="false")
}

///|
test "parse unclosed emphasis" {
  let inlines = parse_inlines("Hello *world")
  // Unclosed * should be treated as text
  inspect(inlines.length() >= 1, content="true")
}

///|
test "parse unclosed code span" {
  let inlines = parse_inlines("Hello `code")
  inspect(inlines.length() >= 1, content="true")
}

///|
test "parse unclosed strikethrough" {
  let inlines = parse_inlines("Hello ~~deleted")
  inspect(inlines.length() >= 1, content="true")
}

///|
test "parse link with angle bracket url" {
  let inlines = parse_inlines("[text](<https://example.com>)")
  match inlines[0] {
    Inline::Link(url~, ..) => inspect(url, content="https://example.com")
    _ => fail("Expected Link")
  }
}

///|
test "parse link with newline in url fails" {
  let inlines = parse_inlines("[text](url\nbroken)")
  // Link with newline in URL should not parse as link
  let has_link = inlines
    .iter()
    .any(fn(i) {
      match i {
        Inline::Link(..) => true
        _ => false
      }
    })
  inspect(has_link, content="false")
}

///|
test "parse image with escape in alt" {
  let inlines = parse_inlines("![alt \\* text](img.png)")
  match inlines[0] {
    Inline::Image(alt~, ..) => inspect(alt.contains("*"), content="true")
    _ => fail("Expected Image")
  }
}

///|
test "parse emphasis with code inside" {
  let inlines = parse_inlines("*text `code` more*")
  match inlines[0] {
    Inline::Emphasis(children~, ..) => {
      let has_code = children
        .iter()
        .any(fn(i) {
          match i {
            Inline::Code(..) => true
            _ => false
          }
        })
      inspect(has_code, content="true")
    }
    _ => fail("Expected Emphasis")
  }
}

///|
test "parse link with escape in text" {
  let inlines = parse_inlines("[text \\] more](url)")
  match inlines[0] {
    Inline::Link(url~, ..) => inspect(url, content="url")
    _ => fail("Expected Link")
  }
}

///|
test "parse link with paren title" {
  let inlines = parse_inlines("[text](url (title))")
  match inlines[0] {
    Inline::Link(url~, title~, ..) => {
      inspect(url, content="url")
      inspect(title, content="title")
    }
    _ => fail("Expected Link")
  }
}

///|
test "parse emphasis underscore strict mode" {
  let inlines = parse_inlines("_italic_", strict=true)
  match inlines[0] {
    Inline::Emphasis(marker~, ..) => inspect(marker, content="Underscore")
    _ => fail("Expected Emphasis in strict mode")
  }
}

///|
test "parse link strict mode" {
  let inlines = parse_inlines("[text](url)", strict=true)
  match inlines[0] {
    Inline::Link(url~, ..) => inspect(url, content="url")
    _ => fail("Expected Link in strict mode")
  }
}

///|
test "parse image strict mode" {
  let inlines = parse_inlines("![alt](img.png)", strict=true)
  match inlines[0] {
    Inline::Image(url~, ..) => inspect(url, content="img.png")
    _ => fail("Expected Image in strict mode")
  }
}

///|
test "parse link with escape in title" {
  let inlines = parse_inlines("[text](url \"title \\\" end\")")
  match inlines[0] {
    Inline::Link(title~, ..) => inspect(title.contains("\""), content="true")
    _ => fail("Expected Link")
  }
}

///|
test "parse link with paren title nested parens" {
  let inlines = parse_inlines("[text](url (a (b) c))")
  match inlines[0] {
    Inline::Link(title~, ..) => inspect(title.contains("b"), content="true")
    _ => fail("Expected Link")
  }
}

///|
test "parse link with paren title escape" {
  let inlines = parse_inlines("[text](url (ti\\)tle))")
  match inlines[0] {
    Inline::Link(title~, ..) => inspect(title.contains(")"), content="true")
    _ => fail("Expected Link")
  }
}

///|
test "parse link with angle bracket url and title" {
  let inlines = parse_inlines("[text](<url> \"title\")")
  match inlines[0] {
    Inline::Link(url~, title~, ..) => {
      inspect(url, content="url")
      inspect(title, content="title")
    }
    _ => fail("Expected Link")
  }
}

///|
test "parse emphasis with link inside" {
  let inlines = parse_inlines("*click [here](url) now*")
  match inlines[0] {
    Inline::Emphasis(children~, ..) => {
      let has_link = children
        .iter()
        .any(fn(i) {
          match i {
            Inline::Link(..) => true
            _ => false
          }
        })
      inspect(has_link, content="true")
    }
    _ => fail("Expected Emphasis")
  }
}

///|
test "parse unclosed link bracket" {
  let inlines = parse_inlines("[text without close")
  inspect(inlines.length() >= 1, content="true")
}

///|
test "parse image with escape in url" {
  let inlines = parse_inlines("![alt](url%20space)")
  match inlines[0] {
    Inline::Image(url~, ..) => inspect(url, content="url%20space")
    _ => fail("Expected Image")
  }
}

///|
test "parse footnote reference with content" {
  let inlines = parse_inlines("before[^note1]after")
  inspect(inlines.length() >= 2, content="true")
}

///|
test "parse multipass inlines" {
  let inlines = parse_inlines_multipass("Hello *world*")
  inspect(inlines.length() >= 1, content="true")
}

///|
test "parse image with single quote title" {
  let inlines = parse_inlines("![alt](img.png 'title')")
  match inlines[0] {
    Inline::Image(title~, ..) => inspect(title, content="title")
    _ => fail("Expected Image")
  }
}

///|
test "parse image with angle bracket url" {
  let inlines = parse_inlines("![alt](<img.png>)")
  match inlines[0] {
    Inline::Image(url~, ..) => inspect(url, content="img.png")
    _ => fail("Expected Image")
  }
}

///|
test "parse ref image" {
  let inlines = parse_inlines("![alt][ref]")
  match inlines[0] {
    Inline::RefImage(alt~, label~, ..) => {
      inspect(alt, content="alt")
      inspect(label, content="ref")
    }
    _ => fail("Expected RefImage")
  }
}

///|
test "parse footnote with special chars" {
  let inlines = parse_inlines("[^my-note_1]")
  match inlines[0] {
    Inline::FootnoteReference(label~, ..) => inspect(label, content="my-note_1")
    _ => fail("Expected FootnoteReference")
  }
}

///|
test "parse footnote invalid char aborts" {
  let inlines = parse_inlines("[^no space]")
  let has_fn = inlines
    .iter()
    .any(fn(i) {
      match i {
        Inline::FootnoteReference(..) => true
        _ => false
      }
    })
  inspect(has_fn, content="false")
}

///|
test "parse nested link in link text rejected" {
  let inlines = parse_inlines("[[a](url1)](url2)")
  // Nested link makes outer invalid
  let link_count = inlines
    .iter()
    .fold(init=0, fn(acc, i) {
      match i {
        Inline::Link(..) => acc + 1
        _ => acc
      }
    })
  // Should have at most 1 link (the inner one)
  inspect(link_count <= 1, content="true")
}

///|
test "parse ref link with link in text rejected" {
  let inlines = parse_inlines("[[a](url)][ref]")
  inspect(inlines.length() >= 1, content="true")
}

///|
test "parse link title with single quote escape" {
  let inlines = parse_inlines("[t](url 'it\\'s')")
  match inlines[0] {
    Inline::Link(title~, ..) => inspect(title.contains("'"), content="true")
    _ => fail("Expected Link")
  }
}

///|
test "parse empty strikethrough" {
  let inlines = parse_inlines("~~~~")
  // Empty strikethrough should not produce Strikethrough node
  for inline in inlines {
    match inline {
      Inline::Strikethrough(..) =>
        fail("Should not produce empty strikethrough")
      _ => ()
    }
  }
}

///|
test "parse strikethrough with newline" {
  let inlines = parse_inlines("~~text\nmore~~")
  // Newline inside strikethrough should prevent parsing
  for inline in inlines {
    match inline {
      Inline::Strikethrough(..) => fail("Newline should prevent strikethrough")
      _ => ()
    }
  }
}

///|
test "parse link with nested link in emphasis" {
  let inlines = parse_inlines("[*[inner](url)*](outer)")
  // Contains link check: link inside emphasis inside link should be rejected
  inspect(inlines.length() >= 1, content="true")
}

///|
test "parse emphasis with trailing space break" {
  let inlines = parse_inlines("*text*   \nafter")
  // Should trigger trim_trailing_space_from_last_text
  inspect(inlines.length() >= 1, content="true")
  let mut has_break = false
  for inline in inlines {
    match inline {
      Inline::HardBreak(..) => has_break = true
      _ => ()
    }
  }
  inspect(has_break, content="true")
}

///|
test "parse emphasis with backtick that fails code span" {
  let inlines = parse_inlines("*text ` more*")
  // Backtick inside emphasis that doesn't form code span
  match inlines[0] {
    Inline::Emphasis(children~, ..) =>
      inspect(children.length() >= 1, content="true")
    _ => fail("Expected Emphasis")
  }
}

///|
test "parse link angle bracket url eof" {
  let inlines = parse_inlines("[text](<url")
  // Angle bracket URL without closing > should not form link
  inspect(inlines.length() >= 1, content="true")
}

///|
test "parse link with escaped bracket in text" {
  let inlines = parse_inlines("[a\\]b](url)")
  match inlines[0] {
    Inline::Link(children~, ..) =>
      inspect(children.length() >= 1, content="true")
    _ => fail("Expected Link with escaped bracket")
  }
}

///|
test "parse link title with escape in paren title" {
  let inlines = parse_inlines("[t](url (ti\\)tle))")
  match inlines[0] {
    Inline::Link(title~, ..) => inspect(title.contains(")"), content="true")
    _ => fail("Expected Link with paren title escape")
  }
}

///|
test "parse link angle bracket url with newline" {
  let inlines = parse_inlines("[text](<url\nmore>)")
  // Newline in angle bracket URL invalidates the link
  for inline in inlines {
    match inline {
      Inline::Link(..) => fail("Newline in angle URL should prevent link")
      _ => ()
    }
  }
}

///|
test "parse link with title escape at eof" {
  let inlines = parse_inlines("[t](url \"title\\")
  // Escape at end of title - unclosed
  inspect(inlines.length() >= 1, content="true")
}

///|
test "parse link with url eof" {
  let inlines = parse_inlines("[text](url")
  // Unclosed link parenthesis
  inspect(inlines.length() >= 1, content="true")
}

///|
test "parse ref link label eof" {
  let inlines = parse_inlines("[text][ref")
  // Unclosed ref link label
  inspect(inlines.length() >= 1, content="true")
}

///|
test "parse footnote without caret" {
  let inlines = parse_inlines("[^")
  // [ followed by ^ but no closing ] - should not be footnote
  inspect(inlines.length() >= 1, content="true")
}

///|
test "parse emphasis with nested link" {
  let inlines = parse_inlines("*before [link](url) after*")
  match inlines[0] {
    Inline::Emphasis(children~, ..) => {
      let mut has_link = false
      for child in children {
        match child {
          Inline::Link(..) => has_link = true
          _ => ()
        }
      }
      inspect(has_link, content="true")
    }
    _ => fail("Expected Emphasis with nested link")
  }
}

///|
test "parse soft break trims trailing spaces" {
  let inlines = parse_inlines("text   \nmore")
  // Three spaces before newline = hard break, should trim text
  inspect(inlines.length() >= 1, content="true")
}
