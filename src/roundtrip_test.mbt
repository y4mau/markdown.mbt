///| Roundtrip smoke tests: parse -> serialize -> assert equality

///| and parse -> render_html -> assert expected HTML

// Block-level roundtrip tests

///|
test "roundtrip: paragraph" {
  let src = "Hello world.\n"
  let doc = parse(src).document
  inspect(serialize(doc), content="Hello world.\n")
}

///|
test "roundtrip: heading levels 1-6" {
  for level = 1; level <= 6; level = level + 1 {
    let hashes = "#".repeat(level)
    let src = hashes + " Title\n"
    let doc = parse(src).document
    let output = serialize(doc)
    inspect(output.contains(hashes + " Title"), content="true")
  }
}

///|
test "roundtrip: fenced code block" {
  let src = "```js\nconsole.log(42);\n```\n"
  let doc = parse(src).document
  inspect(serialize(doc), content="```js\nconsole.log(42);\n```\n")
}

///|
test "roundtrip: indented code block" {
  let src = "    code line\n"
  let doc = parse(src).document
  let output = serialize(doc)
  // Indented code is converted to fenced code by serializer
  inspect(output.contains("code line"), content="true")
  inspect(output.contains("```"), content="true")
}

///|
test "roundtrip: thematic break" {
  let src = "---\n"
  let doc = parse(src).document
  let output = serialize(doc)
  inspect(output.contains("***"), content="true")
}

///|
test "roundtrip: blockquote" {
  let src = "> Quoted text\n"
  let doc = parse(src).document
  inspect(serialize(doc), content="> Quoted text\n")
}

///|
test "roundtrip: nested blockquote" {
  let src = "> > Nested\n"
  let doc = parse(src).document
  let output = serialize(doc)
  inspect(output.contains("> > Nested"), content="true")
}

///|
test "roundtrip: bullet list" {
  let src = "- Item 1\n- Item 2\n"
  let doc = parse(src).document
  let output = serialize(doc)
  inspect(output.contains("* Item 1"), content="true")
  inspect(output.contains("* Item 2"), content="true")
}

///|
test "roundtrip: ordered list" {
  let src = "1. First\n2. Second\n"
  let doc = parse(src).document
  let output = serialize(doc)
  inspect(output.contains("1. First"), content="true")
  inspect(output.contains("2. Second"), content="true")
}

///|
test "roundtrip: html block" {
  let src = "<div>\nhello\n</div>\n"
  let doc = parse(src).document
  let output = serialize(doc)
  inspect(output.contains("<div>"), content="true")
  inspect(output.contains("</div>"), content="true")
}

///|
test "roundtrip: table" {
  let src = "| a | b |\n|---|---|\n| 1 | 2 |\n"
  let doc = parse(src).document
  let output = serialize(doc)
  inspect(output.contains("| a |"), content="true")
  inspect(output.contains("| 1 |"), content="true")
}

///|
test "roundtrip: table with alignment" {
  let src = "| L | C | R |\n|:--|:-:|--:|\n| a | b | c |\n"
  let doc = parse(src).document
  let output = serialize(doc)
  inspect(output.contains(":--"), content="true")
  inspect(output.contains(":-:"), content="true")
  inspect(output.contains("--:"), content="true")
}

///|
test "roundtrip: footnote definition" {
  let src = "Text[^1]\n\n[^1]: Footnote content\n"
  let doc = parse(src).document
  let output = serialize(doc)
  inspect(output.contains("[^1]"), content="true")
  inspect(output.contains("Footnote content"), content="true")
}

///|
test "roundtrip: blank lines between blocks" {
  let src = "# Title\n\nParagraph\n"
  let doc = parse(src).document
  let output = serialize(doc)
  inspect(output.contains("# Title"), content="true")
  inspect(output.contains("Paragraph"), content="true")
}

// Inline-level roundtrip tests

///|
test "roundtrip: emphasis" {
  let src = "*italic*\n"
  let doc = parse(src).document
  inspect(serialize(doc), content="*italic*\n")
}

///|
test "roundtrip: strong" {
  let src = "**bold**\n"
  let doc = parse(src).document
  inspect(serialize(doc), content="**bold**\n")
}

///|
test "roundtrip: inline code" {
  let src = "`code`\n"
  let doc = parse(src).document
  inspect(serialize(doc), content="`code`\n")
}

///|
test "roundtrip: link" {
  let src = "[text](https://example.com)\n"
  let doc = parse(src).document
  inspect(serialize(doc), content="[text](https://example.com)\n")
}

///|
test "roundtrip: link with title" {
  let src = "[text](url \"title\")\n"
  let doc = parse(src).document
  inspect(serialize(doc), content="[text](url \"title\")\n")
}

///|
test "roundtrip: image" {
  let src = "![alt](img.png)\n"
  let doc = parse(src).document
  inspect(serialize(doc), content="![alt](img.png)\n")
}

///|
test "roundtrip: autolink" {
  let src = "<https://example.com>\n"
  let doc = parse(src).document
  inspect(serialize(doc), content="<https://example.com>\n")
}

///|
test "roundtrip: hard break" {
  let src = "line1\\\nline2\n"
  let doc = parse(src).document
  let output = serialize(doc)
  inspect(output.contains("line1\\\nline2"), content="true")
}

///|
test "roundtrip: strikethrough" {
  let src = "~~deleted~~\n"
  let doc = parse(src).document
  inspect(serialize(doc), content="~~deleted~~\n")
}

///|
test "roundtrip: html inline" {
  let src = "text <br> more\n"
  let doc = parse(src).document
  let output = serialize(doc)
  inspect(output.contains("<br>"), content="true")
}

// HTML rendering tests

///|
test "html: paragraph" {
  inspect(md_to_html("Hello\n"), content="<p>Hello</p>\n")
}

///|
test "html: heading" {
  inspect(md_to_html("# H1\n"), content="<h1>H1</h1>\n")
}

///|
test "html: fenced code" {
  let html = md_to_html("```\ncode\n```\n")
  inspect(html, content="<pre><code>code\n</code></pre>\n")
}

///|
test "html: blockquote" {
  inspect(
    md_to_html("> quote\n"),
    content="<blockquote>\n<p>quote</p>\n</blockquote>\n",
  )
}

///|
test "html: thematic break" {
  inspect(md_to_html("---\n"), content="<hr>\n")
}

///|
test "html: bullet list" {
  let html = md_to_html("- a\n- b\n")
  inspect(html, content="<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n")
}

///|
test "html: ordered list" {
  let html = md_to_html("1. a\n2. b\n")
  inspect(html, content="<ol>\n<li>a</li>\n<li>b</li>\n</ol>\n")
}

///|
test "html: emphasis and strong" {
  let html = md_to_html("*em* **strong**\n")
  inspect(html, content="<p><em>em</em> <strong>strong</strong></p>\n")
}

///|
test "html: inline code" {
  let html = md_to_html("`x`\n")
  inspect(html, content="<p><code>x</code></p>\n")
}

///|
test "html: link and image" {
  let html = md_to_html("[a](b) ![c](d)\n")
  inspect(
    html,
    content="<p><a href=\"b\">a</a> <img src=\"d\" alt=\"c\"></p>\n",
  )
}
