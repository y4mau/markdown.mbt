///|
/// HTML Renderer tests
test "render paragraph" {
  let html = md_to_html("Hello, world!\n")
  inspect(html, content="<p>Hello, world!</p>\n")
}

///|
test "render heading" {
  let html = md_to_html("# Title\n")
  inspect(html, content="<h1>Title</h1>\n")
}

///|
test "render heading levels" {
  let html = md_to_html("## Level 2\n### Level 3\n")
  inspect(html, content="<h2>Level 2</h2>\n<h3>Level 3</h3>\n")
}

///|
test "render emphasis" {
  let html = md_to_html("*italic* and **bold**\n")
  inspect(html, content="<p><em>italic</em> and <strong>bold</strong></p>\n")
}

///|
test "render code" {
  let html = md_to_html("Use `code` here\n")
  inspect(html, content="<p>Use <code>code</code> here</p>\n")
}

///|
test "render fenced code block" {
  let html = md_to_html("```js\nconsole.log('hi');\n```\n")
  inspect(
    html,
    content="<pre><code class=\"language-js\">console.log('hi');\n</code></pre>\n",
  )
}

///|
test "render link" {
  let html = md_to_html("[click](https://example.com)\n")
  inspect(html, content="<p><a href=\"https://example.com\">click</a></p>\n")
}

///|
test "render link with title" {
  let html = md_to_html("[click](https://example.com \"title\")\n")
  inspect(
    html,
    content="<p><a href=\"https://example.com\" title=\"title\">click</a></p>\n",
  )
}

///|
test "render image" {
  let html = md_to_html("![alt](image.png)\n")
  inspect(html, content="<p><img src=\"image.png\" alt=\"alt\"></p>\n")
}

///|
test "render bullet list" {
  let html = md_to_html("- one\n- two\n- three\n")
  inspect(
    html,
    content="<ul>\n<li>one</li>\n<li>two</li>\n<li>three</li>\n</ul>\n",
  )
}

///|
test "render ordered list" {
  let html = md_to_html("1. one\n2. two\n3. three\n")
  inspect(
    html,
    content="<ol>\n<li>one</li>\n<li>two</li>\n<li>three</li>\n</ol>\n",
  )
}

///|
test "render blockquote" {
  let html = md_to_html("> quote\n")
  inspect(html, content="<blockquote>\n<p>quote</p>\n</blockquote>\n")
}

///|
test "render thematic break" {
  let html = md_to_html("---\n")
  inspect(html, content="<hr>\n")
}

///|
test "render task list" {
  let html = md_to_html("- [ ] todo\n- [x] done\n")
  inspect(
    html,
    content="<ul class=\"contains-task-list\">\n<li class=\"task-list-item\"><input type=\"checkbox\" disabled> todo</li>\n<li class=\"task-list-item\"><input type=\"checkbox\" checked disabled> done</li>\n</ul>\n",
  )
}

///|
test "render table" {
  let html = md_to_html("| a | b |\n|---|---|\n| 1 | 2 |\n")
  inspect(
    html,
    content="<table>\n<thead>\n<tr>\n<th>a</th>\n<th>b</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>1</td>\n<td>2</td>\n</tr>\n</tbody>\n</table>\n",
  )
}

///|
test "escape html in text" {
  let html = md_to_html("a < b && c > d\n")
  inspect(html, content="<p>a &lt; b &amp;&amp; c &gt; d</p>\n")
}

///|
test "render footnote" {
  let html = md_to_html("Text[^1]\n\n[^1]: Note\n")
  inspect(html.contains("<sup><a href=\"#fn-1\""), content="true")
  inspect(html.contains("<div class=\"footnote\" id=\"fn-1\">"), content="true")
}

///|
test "render indented code" {
  let html = md_to_html("    code line\n")
  inspect(html.contains("<pre><code>"), content="true")
  inspect(html.contains("code line"), content="true")
}

///|
test "render strikethrough" {
  let html = md_to_html("~~deleted~~\n")
  inspect(html, content="<p><del>deleted</del></p>\n")
}

///|
test "render autolink" {
  let html = md_to_html("<https://example.com>\n")
  inspect(
    html,
    content="<p><a href=\"https://example.com\">https://example.com</a></p>\n",
  )
}

///|
test "render autolink email" {
  let html = md_to_html("<user@example.com>\n")
  inspect(html.contains("mailto:"), content="true")
  inspect(html.contains("user@example.com"), content="true")
}

///|
test "render hard break" {
  let html = md_to_html("line1\\\nline2\n")
  inspect(html.contains("<br>"), content="true")
  inspect(html.contains("line1"), content="true")
  inspect(html.contains("line2"), content="true")
}

///|
test "render soft break" {
  let html = md_to_html("line1\nline2\n")
  inspect(html.contains("line1"), content="true")
  inspect(html.contains("line2"), content="true")
}

///|
test "render code with special chars" {
  let html = md_to_html("`a < b`\n")
  inspect(html.contains("<code>a &lt; b</code>"), content="true")
}

///|
test "render html block" {
  let html = md_to_html("<div>\nhello\n</div>\n")
  inspect(html.contains("<div>"), content="true")
}

///|
test "render table with alignment" {
  let html = md_to_html("| L | C | R |\n|:--|:-:|--:|\n| a | b | c |\n")
  inspect(html.contains("align=\"left\""), content="true")
  inspect(html.contains("align=\"center\""), content="true")
  inspect(html.contains("align=\"right\""), content="true")
}

///|
test "render ordered list with start" {
  let html = md_to_html("3. a\n4. b\n")
  inspect(html.contains("start=\"3\""), content="true")
}

///|
test "render fenced code no language" {
  let html = md_to_html("```\nplain\n```\n")
  inspect(html, content="<pre><code>plain\n</code></pre>\n")
}

///|
test "render image with title" {
  let html = md_to_html("![alt](img.png \"title\")\n")
  inspect(html.contains("title=\"title\""), content="true")
  inspect(html.contains("alt=\"alt\""), content="true")
}

///|
test "render strong and emphasis separate" {
  let html = md_to_html("**bold** and *italic*\n")
  inspect(html.contains("<strong>bold</strong>"), content="true")
  inspect(html.contains("<em>italic</em>"), content="true")
}

///|
test "render mixed list" {
  let html = md_to_html("- a\n- b\n  - c\n")
  inspect(html.contains("<ul>"), content="true")
  inspect(html.contains("<li>"), content="true")
}

///|
test "render ordered list with task" {
  let html = md_to_html("1. [ ] todo\n2. [x] done\n")
  inspect(html.contains("contains-task-list"), content="true")
  inspect(html.contains("<ol"), content="true")
}

///|
test "render ordered list with start and task" {
  let html = md_to_html("3. [ ] todo\n4. [x] done\n")
  inspect(html.contains("contains-task-list"), content="true")
  inspect(html.contains("start=\"3\""), content="true")
}

///|
test "render strict mode" {
  let html = md_to_html_strict("*emphasis*\n")
  inspect(html.contains("<em>emphasis</em>"), content="true")
}

///|
test "render escape quote in attr" {
  let html = md_to_html("[link](url\"quote)\n")
  inspect(html.contains("&quot;"), content="true")
}

///|
test "render escape ampersand" {
  let html = md_to_html("[a&b](url)\n")
  inspect(html.contains("&amp;"), content="true")
}

///|
test "render ref link" {
  let source = "[text][ref]\n\n[ref]: https://example.com\n"
  let result = parse(source)
  let html = render_html(result.document)
  inspect(html.contains("text"), content="true")
}

///|
test "render ref image" {
  let source = "![alt][ref]\n\n[ref]: image.png\n"
  let result = parse(source)
  let html = render_html(result.document)
  inspect(html.contains("alt"), content="true")
}

///|
test "render html block no trailing newline" {
  let result = parse("<div>test</div>")
  let html = render_html(result.document)
  inspect(html.contains("<div>"), content="true")
}

///|
test "render plugin default options" {
  let opts = RenderOptions::default()
  inspect(opts.code_highlighter is None, content="true")
}

///|
test "render plugin with highlighter" {
  let opts = RenderOptions::with_highlighter(fn(
    info : CodeBlockInfo,
    code : String,
  ) -> String {
    "<highlighted lang=\"" + info.lang + "\">" + code + "</highlighted>"
  })
  inspect(not(opts.code_highlighter is None), content="true")
}

///|
test "render plugin with simple highlighter" {
  let opts = RenderOptions::with_simple_highlighter(fn(
    lang : String,
    code : String,
  ) -> String {
    "<pre class=\"" + lang + "\">" + code + "</pre>"
  })
  inspect(not(opts.code_highlighter is None), content="true")
  match opts.code_highlighter {
    Some(hl) => {
      let info = parse_code_block_info("js")
      let result = hl(info, "code")
      inspect(result.contains("js"), content="true")
    }
    None => fail("Expected highlighter")
  }
}
