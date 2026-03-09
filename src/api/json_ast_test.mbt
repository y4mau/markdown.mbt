///| JSON AST serialization tests (mdast-compatible)

///|
test "json: paragraph" {
  let doc = @markdown.parse("Hello\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"root\""), content="true")
  inspect(json.contains("\"type\":\"paragraph\""), content="true")
  inspect(json.contains("\"type\":\"text\""), content="true")
  inspect(json.contains("\"value\":\"Hello\""), content="true")
}

///|
test "json: heading" {
  let doc = @markdown.parse("## Title\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"heading\""), content="true")
  inspect(json.contains("\"depth\":2"), content="true")
}

///|
test "json: fenced code" {
  let doc = @markdown.parse("```js\ncode\n```\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"code\""), content="true")
  inspect(json.contains("\"lang\":\"js\""), content="true")
}

///|
test "json: fenced code no lang" {
  let doc = @markdown.parse("```\ncode\n```\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"code\""), content="true")
  inspect(json.contains("\"lang\":null"), content="true")
}

///|
test "json: indented code" {
  let doc = @markdown.parse("    indented\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"code\""), content="true")
  inspect(json.contains("\"lang\":null"), content="true")
}

///|
test "json: blockquote" {
  let doc = @markdown.parse("> quote\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"blockquote\""), content="true")
}

///|
test "json: bullet list" {
  let doc = @markdown.parse("- a\n- b\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"list\""), content="true")
  inspect(json.contains("\"ordered\":false"), content="true")
  inspect(json.contains("\"type\":\"listItem\""), content="true")
}

///|
test "json: ordered list" {
  let doc = @markdown.parse("1. a\n2. b\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"list\""), content="true")
  inspect(json.contains("\"ordered\":true"), content="true")
  inspect(json.contains("\"start\":1"), content="true")
}

///|
test "json: thematic break" {
  let doc = @markdown.parse("---\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"thematicBreak\""), content="true")
}

///|
test "json: html block" {
  let doc = @markdown.parse("<div>hello</div>\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"html\""), content="true")
}

///|
test "json: table" {
  let doc = @markdown.parse("| a | b |\n|---|---|\n| 1 | 2 |\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"table\""), content="true")
  inspect(json.contains("\"type\":\"tableRow\""), content="true")
  inspect(json.contains("\"type\":\"tableCell\""), content="true")
}

///|
test "json: table alignment" {
  let doc = @markdown.parse("| L | C | R |\n|:--|:-:|--:|\n| a | b | c |\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"left\""), content="true")
  inspect(json.contains("\"center\""), content="true")
  inspect(json.contains("\"right\""), content="true")
}

///|
test "json: emphasis" {
  let doc = @markdown.parse("*em*\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"emphasis\""), content="true")
}

///|
test "json: strong" {
  let doc = @markdown.parse("**strong**\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"strong\""), content="true")
}

///|
test "json: strikethrough" {
  let doc = @markdown.parse("~~deleted~~\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"delete\""), content="true")
}

///|
test "json: inline code" {
  let doc = @markdown.parse("`code`\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"inlineCode\""), content="true")
  inspect(json.contains("\"value\":\"code\""), content="true")
}

///|
test "json: link" {
  let doc = @markdown.parse("[text](url)\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"link\""), content="true")
  inspect(json.contains("\"url\":\"url\""), content="true")
}

///|
test "json: link with title" {
  let doc = @markdown.parse("[text](url \"title\")\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"title\":\"title\""), content="true")
}

///|
test "json: image" {
  let doc = @markdown.parse("![alt](img.png)\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"image\""), content="true")
  inspect(json.contains("\"alt\":\"alt\""), content="true")
  inspect(json.contains("\"url\":\"img.png\""), content="true")
}

///|
test "json: autolink" {
  let doc = @markdown.parse("<https://example.com>\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"link\""), content="true")
  inspect(json.contains("\"url\":\"https://example.com\""), content="true")
}

///|
test "json: hard break" {
  let doc = @markdown.parse("a\\\nb\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"break\""), content="true")
}

///|
test "json: soft break" {
  let doc = @markdown.parse("a\nb\n").document
  let json = document_to_json(doc)
  // Soft breaks are rendered as text with \n value
  inspect(json.contains("\"value\":\"\\n\""), content="true")
}

///|
test "json: html block value" {
  let doc = @markdown.parse("<div>hello</div>\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"html\""), content="true")
}

///|
test "json: footnote" {
  let doc = @markdown.parse("Text[^1]\n\n[^1]: Note\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"type\":\"footnoteReference\""), content="true")
  inspect(json.contains("\"type\":\"footnoteDefinition\""), content="true")
}

///|
test "json: blank lines skipped" {
  let doc = @markdown.parse("a\n\n\n\nb\n").document
  let json = document_to_json(doc)
  // BlankLines should not appear in JSON output
  let no_blank = not(json.contains("\"type\":\"blankLines\""))
  inspect(no_blank, content="true")
}

///|
test "json: position contains offsets" {
  let doc = @markdown.parse("Hello\n").document
  let json = document_to_json(doc)
  inspect(json.contains("\"position\""), content="true")
  inspect(json.contains("\"start\""), content="true")
  inspect(json.contains("\"end\""), content="true")
  inspect(json.contains("\"offset\""), content="true")
}
