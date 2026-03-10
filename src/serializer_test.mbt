///|
/// Serializer tests
test "serialize heading" {
  let source = "# Hello World\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output, content="# Hello World\n")
}

///|
test "serialize heading with closing hashes" {
  let source = "## Title ##\n"
  let result = parse(source)
  let output = serialize(result.document)
  // GFM style: closing hashes are removed
  inspect(output, content="## Title\n")
}

///|
test "serialize paragraph" {
  let source = "Hello world.\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output, content="Hello world.\n")
}

///|
test "serialize fenced code" {
  let source = "```js\nconsole.log('hello');\n```\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output, content="```js\nconsole.log('hello');\n```\n")
}

///|
test "serialize fenced code with tilde" {
  let source = "~~~python\nprint('hello')\n~~~\n"
  let result = parse(source)
  let output = serialize(result.document)
  // GFM style: tilde fences are converted to backtick fences
  inspect(output, content="```python\nprint('hello')\n```\n")
}

///|
test "serialize thematic break" {
  let source = "text\n\n---\n"
  let result = parse(source)
  let output = serialize(result.document)
  // Output is normalized to *** for GFM compatibility
  inspect(output.contains("***"), content="true")
}

///|
test "serialize blockquote" {
  let source = "> Quote\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output, content="> Quote\n")
}

///|
test "serialize bullet list" {
  let source = "- Item 1\n- Item 2\n"
  let result = parse(source)
  let output = serialize(result.document)
  // Output is normalized to * for GFM compatibility
  inspect(output, content="* Item 1\n* Item 2\n")
}

///|
test "serialize frontmatter roundtrip" {
  let source = "---\ntitle: Hello\n---\n# Content\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.has_prefix("---\ntitle: Hello\n---\n"), content="true")
}

///|
test "serialize mixed content" {
  let source = "# Title\n\nParagraph.\n\n```js\ncode\n```\n"
  let result = parse(source)
  let output = serialize(result.document)
  // Verify key parts are present
  inspect(output.contains("# Title"), content="true")
  inspect(output.contains("Paragraph"), content="true")
  inspect(output.contains("```js"), content="true")
  inspect(output.contains("code"), content="true")
}

///|
test "serialize ordered list" {
  let source = "1. First\n2. Second\n3. Third\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("1. First"), content="true")
  inspect(output.contains("2. Second"), content="true")
  inspect(output.contains("3. Third"), content="true")
}

///|
test "serialize ordered list with start number" {
  let source = "3. Third\n4. Fourth\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("3. Third"), content="true")
  inspect(output.contains("4. Fourth"), content="true")
}

///|
test "serialize indented code" {
  let source = "    code line\n    more code\n"
  let result = parse(source)
  let output = serialize(result.document)
  // Indented code converted to fenced code
  inspect(output.contains("```"), content="true")
  inspect(output.contains("code line"), content="true")
}

///|
test "serialize html block" {
  let source = "<div>\nhello\n</div>\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("<div>"), content="true")
  inspect(output.contains("</div>"), content="true")
}

///|
test "serialize footnote definition" {
  let source = "Text[^1]\n\n[^1]: Footnote text\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("[^1]"), content="true")
  inspect(output.contains("Footnote text"), content="true")
}

///|
test "serialize table" {
  let source = "| a | b |\n|---|---|\n| 1 | 2 |\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("| a |"), content="true")
  inspect(output.contains("| 1 |"), content="true")
  inspect(output.contains("---"), content="true")
}

///|
test "serialize table with alignment" {
  let source = "| L | C | R |\n|:--|:-:|--:|\n| a | b | c |\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains(":--"), content="true")
  inspect(output.contains(":-:"), content="true")
  inspect(output.contains("--:"), content="true")
}

///|
test "serialize nested blockquote" {
  let source = "> > Nested\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("> > Nested"), content="true")
}

///|
test "serialize emphasis markers normalized" {
  let source = "_italic_\n"
  let result = parse(source)
  let output = serialize(result.document)
  // GFM normalizes _ to *
  inspect(output, content="*italic*\n")
}

///|
test "serialize strong markers normalized" {
  let source = "__bold__\n"
  let result = parse(source)
  let output = serialize(result.document)
  // GFM normalizes __ to **
  inspect(output, content="**bold**\n")
}

///|
test "serialize strikethrough" {
  let source = "~~deleted~~\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output, content="~~deleted~~\n")
}

///|
test "serialize link" {
  let source = "[text](url)\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output, content="[text](url)\n")
}

///|
test "serialize image" {
  let source = "![alt](img.png)\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output, content="![alt](img.png)\n")
}

///|
test "serialize autolink" {
  let source = "<https://example.com>\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output, content="<https://example.com>\n")
}

///|
test "serialize hard break" {
  let source = "line1\\\nline2\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("line1\\\nline2"), content="true")
}

///|
test "serialize html inline" {
  let source = "text <br> more\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("<br>"), content="true")
}

///|
test "serialize code with backticks in content" {
  let source = "`` `code` ``\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("`code`"), content="true")
}

///|
test "serialize fenced code with backticks in code" {
  let source = "````\n```\ncode\n```\n````\n"
  let result = parse(source)
  let output = serialize(result.document)
  // Fence length must be > backtick run in content
  inspect(output.contains("````"), content="true")
}

///|
test "serialize task list" {
  let source = "- [ ] todo\n- [x] done\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("[ ]"), content="true")
  inspect(output.contains("[x]"), content="true")
}

///|
test "serialize nested bullet list 2 levels" {
  let source = "* Item 1\n  * Sub 1\n  * Sub 2\n* Item 2\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("Item 1"), content="true")
  inspect(output.contains("Sub 1"), content="true")
  inspect(output.contains("Item 2"), content="true")
}

///|
test "serialize table with pipe in cell" {
  let source = "| a \\| b | c |\n|---|---|\n| d | e |\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("a"), content="true")
  inspect(output.contains("c"), content="true")
}

///|
test "serialize setext heading" {
  let source = "Title\n=====\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("Title"), content="true")
}

///|
test "serialize frontmatter without trailing newline" {
  let source = "---\ntitle: Test\n---\nContent\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("title: Test"), content="true")
  inspect(output.contains("Content"), content="true")
}

///|
test "serialize footnote with continuation" {
  let source = "Text[^1]\n\n[^1]: First line\n    continuation\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("[^1]"), content="true")
}

///|
test "serialize html block without trailing newline" {
  let source = "<div>content</div>\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("<div>content</div>"), content="true")
}

///|
test "serialize link with special chars in url" {
  let source = "[text](url?a=1&b=2)\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("url?a=1&b=2"), content="true")
}

///|
test "serialize ref link" {
  let source = "[text][ref]\n\n[ref]: url\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("[text]"), content="true")
  inspect(output.contains("[ref]"), content="true")
}

///|
test "serialize ref image" {
  let source = "![alt][ref]\n\n[ref]: img.png\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("![alt]"), content="true")
  inspect(output.contains("[ref]"), content="true")
}

///|
test "serialize definitions" {
  let defs : Array[LinkDefinition] = [
    {
      label: "ref1",
      url: "https://example.com",
      title: "",
      span: Span::new(0, 0),
    },
    {
      label: "ref2",
      url: "https://test.com",
      title: "Title",
      span: Span::new(0, 0),
    },
  ]
  let output = serialize_definitions(defs)
  inspect(output.contains("[ref1]: https://example.com"), content="true")
  inspect(output.contains("[ref2]: https://test.com \"Title\""), content="true")
}

///|
test "serialize ordered list with nested bullet list" {
  let source = "1. Item\n   - Sub A\n   - Sub B\n2. Next\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("Item"), content="true")
  inspect(output.contains("Sub A"), content="true")
  inspect(output.contains("Next"), content="true")
}

///|
test "serialize ordered list with task checkbox" {
  let source = "1. [ ] todo\n2. [x] done\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("[ ]"), content="true")
  inspect(output.contains("[x]"), content="true")
}

///|
test "serialize nested ordered in bullet list" {
  let source = "* Item\n  1. Sub 1\n  2. Sub 2\n* Next\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("Item"), content="true")
  inspect(output.contains("Sub 1"), content="true")
}

///|
test "serialize html block no trailing newline" {
  let result = parse("<div>test</div>")
  let output = serialize(result.document)
  inspect(output.contains("<div>test</div>"), content="true")
}

///|
test "serialize table with emphasis in cell" {
  let source = "| *bold* | text |\n|---|---|\n| a | b |\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("bold"), content="true")
  inspect(output.contains("text"), content="true")
}

///|
test "serialize code block with backticks in content" {
  let source = "````\n```\ncode\n```\n````\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("````"), content="true")
  inspect(output.contains("code"), content="true")
}

///|
test "serialize footnote with multiple paragraphs" {
  let source = "Text[^1]\n\n[^1]: First\n    Second\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("[^1]"), content="true")
  inspect(output.contains("First"), content="true")
}

///|
test "serialize code ending with backticks" {
  let source = "````\ncode```\n````\n"
  let result = parse(source)
  let output = serialize(result.document)
  inspect(output.contains("code```"), content="true")
  inspect(output.contains("````"), content="true")
}
