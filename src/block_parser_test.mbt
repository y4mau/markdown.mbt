///|
/// Block parser tests
test "parse heading" {
  let result = parse("# Hello World\n")
  let blocks = result.document.children
  inspect(blocks.length(), content="1")
  match blocks[0] {
    Block::Heading(level~, style~, children~, ..) => {
      inspect(level, content="1")
      inspect(style, content="Atx")
      inspect(children.length(), content="1")
      match children[0] {
        Inline::Text(content~, ..) => inspect(content, content="Hello World")
        _ => fail("Expected text")
      }
    }
    _ => fail("Expected heading")
  }
}

///|
test "parse heading level 2-6" {
  for level = 2; level <= 6; level = level + 1 {
    let prefix = String::make(level, '#')
    let result = parse("\{prefix} Test\n")
    match result.document.children[0] {
      Block::Heading(level=l, ..) => inspect(l == level, content="true")
      _ => fail("Expected heading")
    }
  }
}

///|
test "parse heading with closing hashes" {
  let result = parse("## Title ##\n")
  match result.document.children[0] {
    Block::Heading(level~, closing_hashes~, ..) => {
      inspect(level, content="2")
      inspect(closing_hashes, content="2")
    }
    _ => fail("Expected heading")
  }
}

///|
test "parse paragraph" {
  let result = parse("Hello world.\n")
  match result.document.children[0] {
    Block::Paragraph(children~, ..) =>
      match children[0] {
        Inline::Text(content~, ..) => inspect(content, content="Hello world.")
        _ => fail("Expected text")
      }
    _ => fail("Expected paragraph")
  }
}

///|
test "parse multiline paragraph" {
  let result = parse("Line 1\nLine 2\n")
  match result.document.children[0] {
    Block::Paragraph(children~, ..) => {
      // With inline parsing: "Line 1" + SoftBreak + "Line 2"
      inspect(children.length() >= 2, content="true")
      match children[0] {
        Inline::Text(content~, ..) => inspect(content, content="Line 1")
        _ => fail("Expected text")
      }
    }
    _ => fail("Expected paragraph")
  }
}

///|
test "parse fenced code block" {
  let result = parse("```js\nconsole.log('hello');\n```\n")
  match result.document.children[0] {
    Block::FencedCode(info~, code~, fence_marker~, fence_length~, ..) => {
      inspect(info, content="js")
      inspect(code, content="console.log('hello');\n")
      inspect(fence_marker, content="Backtick")
      inspect(fence_length, content="3")
    }
    _ => fail("Expected fenced code")
  }
}

///|
test "parse fenced code with tilde" {
  let result = parse("~~~python\nprint('hello')\n~~~\n")
  match result.document.children[0] {
    Block::FencedCode(info~, fence_marker~, ..) => {
      inspect(info, content="python")
      inspect(fence_marker, content="Tilde")
    }
    _ => fail("Expected fenced code")
  }
}

///|
test "parse fenced code with filename" {
  let result = parse("```json:package.json\n{\"name\": \"test\"}\n```\n")
  match result.document.children[0] {
    Block::FencedCode(info~, ..) => inspect(info, content="json:package.json")
    _ => fail("Expected fenced code")
  }
}

///|
test "parse thematic break" {
  // Thematic break after content to avoid frontmatter confusion
  let result = parse("text\n\n---\n")
  let children = result.document.children
  // Find the thematic break
  let mut found = false
  for block in children {
    match block {
      Block::ThematicBreak(marker~, count~, ..) => {
        inspect(marker == '-', content="true")
        inspect(count, content="3")
        found = true
      }
      _ => ()
    }
  }
  inspect(found, content="true")
}

///|
test "parse thematic break with asterisk" {
  let result = parse("***\n")
  match result.document.children[0] {
    Block::ThematicBreak(marker~, ..) => inspect(marker == '*', content="true")
    _ => fail("Expected thematic break")
  }
}

///|
test "parse blockquote" {
  let result = parse("> Quote\n")
  match result.document.children[0] {
    Block::Blockquote(children~, ..) => {
      inspect(children.length(), content="1")
      match children[0] {
        Block::Paragraph(children=p_children, ..) =>
          match p_children[0] {
            Inline::Text(content~, ..) => inspect(content, content="Quote")
            _ => fail("Expected text")
          }
        _ => fail("Expected paragraph in blockquote")
      }
    }
    _ => fail("Expected blockquote")
  }
}

///|
test "parse bullet list" {
  let result = parse("- Item 1\n- Item 2\n")
  match result.document.children[0] {
    Block::BulletList(marker~, items~, tight~, ..) => {
      inspect(marker, content="Dash")
      inspect(items.length(), content="2")
      inspect(tight, content="true")
    }
    _ => fail("Expected bullet list")
  }
}

///|
test "parse ordered list" {
  let result = parse("1. First\n2. Second\n")
  match result.document.children[0] {
    Block::OrderedList(start~, delimiter~, items~, ..) => {
      inspect(start, content="1")
      inspect(delimiter, content="Dot")
      inspect(items.length(), content="2")
    }
    _ => fail("Expected ordered list")
  }
}

///|
test "parse indented code" {
  let result = parse("    code line\n    more code\n")
  match result.document.children[0] {
    Block::IndentedCode(code~, ..) =>
      inspect(code, content="code line\nmore code")
    _ => fail("Expected indented code")
  }
}

///|
test "parse setext heading h1" {
  let result = parse("Title\n=====\n")
  match result.document.children[0] {
    Block::Heading(level~, style~, ..) => {
      inspect(level, content="1")
      inspect(style, content="Setext")
    }
    _ => fail("Expected setext heading")
  }
}

///|
test "parse setext heading h2" {
  let result = parse("Title\n-----\n")
  match result.document.children[0] {
    Block::Heading(level~, style~, ..) => {
      inspect(level, content="2")
      inspect(style, content="Setext")
    }
    _ => fail("Expected setext heading")
  }
}

///|
test "parse frontmatter" {
  let result = parse("---\ntitle: Hello\nauthor: World\n---\n# Content\n")
  match result.document.frontmatter {
    Some(fm) => {
      inspect(fm.entries.length(), content="2")
      let (k1, v1) = fm.entries[0]
      inspect(k1, content="title")
      inspect(v1, content="Hello")
    }
    None => fail("Expected frontmatter")
  }
}

///|
test "parse link definition" {
  let result = parse("[link]: https://example.com \"Title\"\n")
  inspect(result.definitions.length(), content="1")
  let def = result.definitions[0]
  inspect(def.label, content="link")
  inspect(def.url, content="https://example.com")
  inspect(def.title, content="Title")
}

///|
test "parse mixed content" {
  let result = parse("# Title\n\nParagraph text.\n\n```js\ncode\n```\n")
  let children = result.document.children
  // Should have: Heading, BlankLines, Paragraph, BlankLines, FencedCode
  let mut heading_count = 0
  let mut para_count = 0
  let mut code_count = 0
  for block in children {
    match block {
      Block::Heading(..) => heading_count += 1
      Block::Paragraph(..) => para_count += 1
      Block::FencedCode(..) => code_count += 1
      _ => ()
    }
  }
  inspect(heading_count, content="1")
  inspect(para_count, content="1")
  inspect(code_count, content="1")
}

///|
test "parse simple table" {
  let source = "| A | B |\n|---|---|\n| 1 | 2 |\n"
  let result = parse(source)
  match result.document.children[0] {
    Block::Table(header~, alignments~, rows~, ..) => {
      inspect(header.length(), content="2")
      inspect(alignments.length(), content="2")
      inspect(rows.length(), content="1")
    }
    _ => fail("Expected Table")
  }
}

///|
test "parse table with alignment" {
  let source = "| Left | Center | Right |\n|:---|:---:|---:|\n| a | b | c |\n"
  let result = parse(source)
  match result.document.children[0] {
    Block::Table(alignments~, ..) => {
      inspect(alignments[0], content="Left")
      inspect(alignments[1], content="Center")
      inspect(alignments[2], content="Right")
    }
    _ => fail("Expected Table")
  }
}

///|
test "parse table with multiple rows" {
  let source = "| H1 | H2 |\n|---|---|\n| R1C1 | R1C2 |\n| R2C1 | R2C2 |\n| R3C1 | R3C2 |\n"
  let result = parse(source)
  match result.document.children[0] {
    Block::Table(rows~, header~, ..) => {
      inspect(header.length(), content="2")
      inspect(rows.length(), content="3")
    }
    _ => fail("Expected Table")
  }
}

///|
test "parse table with inline formatting" {
  let source = "| **Bold** | *Italic* |\n|---|---|\n| `code` | [link](url) |\n"
  let result = parse(source)
  match result.document.children[0] {
    Block::Table(header~, rows~, ..) => {
      // Header cell should have Strong
      match header[0].children[0] {
        Inline::Strong(..) => ()
        _ => fail("Expected Strong in header")
      }
      // Data cell should have Code
      match rows[0][0].children[0] {
        Inline::Code(..) => ()
        _ => fail("Expected Code in cell")
      }
    }
    _ => fail("Expected Table")
  }
}

///|
test "parse nested code block with 4 backticks" {
  // Use 4 backticks to wrap markdown containing 3-backtick code blocks
  let source = "````md\n```js\nconsole.log('hello');\n```\n````\n"
  let result = parse(source)
  match result.document.children[0] {
    Block::FencedCode(info~, code~, fence_length~, ..) => {
      inspect(fence_length, content="4")
      inspect(info, content="md")
      // The inner code block should be preserved as content
      inspect(code.contains("```js"), content="true")
      inspect(code.contains("console.log"), content="true")
    }
    _ => fail("Expected fenced code block")
  }
}

///|
test "parse code block with lang and filename" {
  let result = parse("```typescript:src/index.ts\nconst x = 1;\n```\n")
  match result.document.children[0] {
    Block::FencedCode(info~, ..) =>
      inspect(info, content="typescript:src/index.ts")
    _ => fail("Expected fenced code")
  }
}

///|
test "parse code block with lang, filename, and meta" {
  // Support meta attributes like {highlight=[1,3]}
  let result = parse(
    "```js:app.js {highlight=[1,3]}\nconst a = 1;\nconst b = 2;\nconst c = 3;\n```\n",
  )
  match result.document.children[0] {
    Block::FencedCode(info~, ..) =>
      inspect(info, content="js:app.js {highlight=[1,3]}")
    _ => fail("Expected fenced code")
  }
}

///|
test "serialize table roundtrip" {
  let source = "| A | B |\n|:---|---:|\n| 1 | 2 |\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("| A |"), content="true")
  // remark-gfm style: | :-- | (left) and | --: | (right)
  inspect(output.contains("| :-- |"), content="true")
  inspect(output.contains("| --: |"), content="true")
}

///|
test "parse task list unchecked" {
  let result = parse("- [ ] todo item\n")
  match result.document.children[0] {
    Block::BulletList(items~, ..) => {
      inspect(items.length(), content="1")
      inspect(items[0].checked, content="Some(false)")
    }
    _ => fail("Expected BulletList")
  }
}

///|
test "parse task list checked lowercase" {
  let result = parse("- [x] done item\n")
  match result.document.children[0] {
    Block::BulletList(items~, ..) => {
      inspect(items.length(), content="1")
      inspect(items[0].checked, content="Some(true)")
    }
    _ => fail("Expected BulletList")
  }
}

///|
test "parse task list checked uppercase" {
  let result = parse("- [X] done item\n")
  match result.document.children[0] {
    Block::BulletList(items~, ..) => {
      inspect(items.length(), content="1")
      inspect(items[0].checked, content="Some(true)")
    }
    _ => fail("Expected BulletList")
  }
}

///|
test "parse task list mixed" {
  let result = parse("- [ ] foo\n- [x] bar\n")
  match result.document.children[0] {
    Block::BulletList(items~, ..) => {
      inspect(items.length(), content="2")
      inspect(items[0].checked, content="Some(false)")
      inspect(items[1].checked, content="Some(true)")
    }
    _ => fail("Expected BulletList")
  }
}

///|
test "serialize task list roundtrip" {
  let source = "- [ ] foo\n- [x] bar\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("[ ] foo"), content="true")
  inspect(output.contains("[x] bar"), content="true")
}

///|
test "parse custom element single line" {
  let result = parse("<my-component>content</my-component>\n")
  inspect(result.document.children.length(), content="1")
  match result.document.children[0] {
    Block::HtmlBlock(html~, ..) => {
      inspect(html.contains("my-component"), content="true")
      inspect(html.contains("content"), content="true")
    }
    _ => fail("Expected HtmlBlock")
  }
}

///|
test "parse custom element multi-line" {
  let source =
    #|<my-component>
    #|  <div>Content here</div>
    #|  <p>More content</p>
    #|</my-component>
    #|
  let result = parse(source)
  inspect(result.document.children.length(), content="1")
  match result.document.children[0] {
    Block::HtmlBlock(html~, ..) => {
      inspect(html.contains("<my-component>"), content="true")
      inspect(html.contains("</my-component>"), content="true")
      inspect(html.contains("Content here"), content="true")
    }
    _ => fail("Expected HtmlBlock for multi-line custom element")
  }
}

///|
test "parse custom element self-closing" {
  let result = parse("<my-component attr=\"value\" />\n")
  inspect(result.document.children.length(), content="1")
  match result.document.children[0] {
    Block::HtmlBlock(html~, ..) => {
      inspect(html.contains("my-component"), content="true")
      inspect(html.contains("/>"), content="true")
    }
    _ => fail("Expected HtmlBlock for self-closing custom element")
  }
}

///|
test "parse custom element with attributes" {
  let source =
    #|<custom-button class="primary" data-id="123">
    #|  Click me
    #|</custom-button>
    #|
  let result = parse(source)
  inspect(result.document.children.length(), content="1")
  match result.document.children[0] {
    Block::HtmlBlock(html~, ..) => {
      inspect(html.contains("custom-button"), content="true")
      inspect(html.contains("class=\"primary\""), content="true")
      inspect(html.contains("data-id=\"123\""), content="true")
    }
    _ => fail("Expected HtmlBlock")
  }
}

///|
test "parse custom element with BEM class names (double underscore)" {
  // BEM naming: block__element--modifier
  // The __ should NOT be interpreted as markdown strong syntax
  let source =
    #|<styled-checkbox-demo>
    #|  <div class="checkbox__control">
    #|    <span class="checkbox__icon--check"></span>
    #|  </div>
    #|</styled-checkbox-demo>
    #|
  let result = parse(source)
  inspect(result.document.children.length(), content="1")
  match result.document.children[0] {
    Block::HtmlBlock(html~, ..) => {
      // Verify the double underscores are preserved
      inspect(html.contains("checkbox__control"), content="true")
      inspect(html.contains("checkbox__icon--check"), content="true")
    }
    _ => fail("Expected HtmlBlock for custom element with BEM classes")
  }
}

///|
test "parse custom element single line with BEM classes" {
  let source = "<my-demo><span class=\"switch__thumb\"></span></my-demo>\n"
  let result = parse(source)
  inspect(result.document.children.length(), content="1")
  match result.document.children[0] {
    Block::HtmlBlock(html~, ..) =>
      // __ must be preserved, not treated as strong/bold markdown
      inspect(html.contains("switch__thumb"), content="true")
    _ => fail("Expected HtmlBlock")
  }
}

///|
test "parse ordered list starting at 0" {
  let result = parse("0. Zero item\n1. One item\n")
  match result.document.children[0] {
    Block::OrderedList(start~, items~, ..) => {
      inspect(start, content="0")
      inspect(items.length(), content="2")
    }
    _ => fail("Expected OrderedList")
  }
}

///|
test "parse ordered list with paren delimiter" {
  let result = parse("1) First\n2) Second\n")
  match result.document.children[0] {
    Block::OrderedList(delimiter~, items~, ..) => {
      inspect(delimiter, content="Paren")
      inspect(items.length(), content="2")
    }
    _ => fail("Expected OrderedList")
  }
}

///|
test "parse nested list bullet inside ordered" {
  let result = parse("1. Item one\n   - Sub a\n   - Sub b\n2. Item two\n")
  match result.document.children[0] {
    Block::OrderedList(items~, ..) => {
      inspect(items.length(), content="2")
      // First item should have nested bullet list
      let has_nested = items[0].children
        .iter()
        .any(fn(b) {
          match b {
            Block::BulletList(..) => true
            _ => false
          }
        })
      inspect(has_nested, content="true")
    }
    _ => fail("Expected OrderedList")
  }
}

///|
test "parse setext heading roundtrip" {
  let source = "Title\n=====\n"
  let result = parse(source)
  let output = serialize(result.document)
  // Should preserve setext style or at least content
  inspect(output.contains("Title"), content="true")
}

///|
test "parse link ref definition with title" {
  let result = parse("[ref]: https://example.com \"My Title\"\n\n[ref]\n")
  inspect(result.definitions.length(), content="1")
  inspect(result.definitions[0].label, content="ref")
  inspect(result.definitions[0].url, content="https://example.com")
  inspect(result.definitions[0].title, content="My Title")
}

///|
test "parse strict mode block" {
  let result = parse("# Hello *world*\n\nParagraph.\n", strict=true)
  match result.document.children[0] {
    Block::Heading(level~, children~, ..) => {
      inspect(level, content="1")
      let has_emphasis = children
        .iter()
        .any(fn(i) {
          match i {
            Inline::Emphasis(..) => true
            _ => false
          }
        })
      inspect(has_emphasis, content="true")
    }
    _ => fail("Expected Heading")
  }
}

///|
test "parse heading without space after hash" {
  let result = parse("#NotAHeading\n")
  // #NotAHeading is not a valid ATX heading (needs space after #)
  // Parser may treat it as paragraph or skip; just verify no crash
  inspect(result.document.children.length() >= 0, content="true")
}

///|
test "parse heading closing hashes without space" {
  let result = parse("## Title##\n")
  match result.document.children[0] {
    Block::Heading(level~, ..) => inspect(level, content="2")
    _ => fail("Expected Heading")
  }
}

///|
test "parse indented code after paragraph" {
  let result = parse("Paragraph.\n\n    code here\n")
  let has_code = result.document.children
    .iter()
    .any(fn(b) {
      match b {
        Block::IndentedCode(..) => true
        _ => false
      }
    })
  inspect(has_code, content="true")
}

///|
test "parse bullet list with plus marker" {
  let result = parse("+ Item one\n+ Item two\n")
  match result.document.children[0] {
    Block::BulletList(marker~, items~, ..) => {
      inspect(marker, content="Plus")
      inspect(items.length(), content="2")
    }
    _ => fail("Expected BulletList")
  }
}

///|
test "parse loose list with blank lines" {
  let result = parse("- Item one\n\n- Item two\n")
  match result.document.children[0] {
    Block::BulletList(tight~, ..) => inspect(tight, content="false")
    _ => fail("Expected BulletList")
  }
}

///|
test "parse nested blockquote with definition" {
  let result = parse("> [link]: url\n> \n> [link]\n")
  let children = result.document.children
  inspect(children.length() >= 1, content="true")
}

///|
test "parse task list without trailing space" {
  let result = parse("- [x]done\n")
  match result.document.children[0] {
    Block::BulletList(items~, ..) => inspect(items.length(), content="1")
    _ => fail("Expected BulletList")
  }
}

///|
test "parse setext heading empty content" {
  let result = parse("\n===\n")
  let children = result.document.children
  inspect(children.length() >= 1, content="true")
}

///|
test "parse custom html element empty tag" {
  let result = parse("<>\n")
  inspect(result.document.children.length() >= 1, content="true")
}

///|
test "parse large ordered list number" {
  let result = parse("1234567890. Item\n")
  inspect(result.document.children.length() >= 1, content="true")
}

///|
test "parse tab indented list" {
  let result = parse("1.\tItem with tab\n")
  match result.document.children[0] {
    Block::OrderedList(..) => ()
    _ => fail("Expected OrderedList")
  }
}

///|
test "parse nested blockquote" {
  let result = parse("> > Nested quote\n")
  match result.document.children[0] {
    Block::Blockquote(children~, ..) => {
      let has_inner = children
        .iter()
        .any(fn(b) {
          match b {
            Block::Blockquote(..) => true
            _ => false
          }
        })
      inspect(has_inner, content="true")
    }
    _ => fail("Expected Blockquote")
  }
}

///|
test "parse html closing tag" {
  let result = parse("</div>\n")
  inspect(result.document.children.length() >= 1, content="true")
}

///|
test "parse empty ordered list item" {
  let result = parse("1.\n2. Second\n")
  // Empty first item may not parse as list
  inspect(result.document.children.length() >= 1, content="true")
}

///|
test "parse empty bullet list item" {
  let result = parse("-\n- Second\n")
  // Empty first item may not parse as list
  inspect(result.document.children.length() >= 1, content="true")
}

///|
test "parse ordered list many digits" {
  let result = parse("123456789. Long number\n")
  inspect(result.document.children.length() >= 1, content="true")
}

///|
test "parse setext heading level 2 dashes" {
  let result = parse("Title\n---\n")
  match result.document.children[0] {
    Block::Heading(level~, style~, ..) => {
      inspect(level, content="2")
      inspect(style, content="Setext")
    }
    _ => fail("Expected setext heading")
  }
}

///|
test "parse indented code with tab" {
  let result = parse("\tcode with tab\n")
  inspect(result.document.children.length() >= 1, content="true")
}

///|
test "parse ordered list paren no space" {
  let result = parse("1)no space after paren\n")
  inspect(result.document.children.length() >= 1, content="true")
}

///|
test "parse fenced code with tab indented content" {
  let source = " ```\n\tcode with tab\n ```\n"
  let result = parse(source)
  inspect(result.document.children.length() >= 1, content="true")
}

///|
test "parse indented code only blank lines" {
  let result = parse("    \n    \n")
  inspect(result.document.children.length() >= 0, content="true")
}
