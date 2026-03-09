///| Syntax highlighting API smoke tests

///|
test "highlight_typescript produces html" {
  let html = highlight_typescript("const x = 42;")
  inspect(html.contains("<span"), content="true")
}

///|
test "highlight_moonbit produces html" {
  let html = highlight_moonbit("fn main { println(42) }")
  inspect(html.contains("<span"), content="true")
}

///|
test "highlight_json produces html" {
  let html = highlight_json("{\"key\": \"value\"}")
  inspect(html.contains("<span"), content="true")
}

///|
test "highlight_html produces html" {
  let html = highlight_html("<div>hello</div>")
  inspect(html.contains("<span"), content="true")
}

///|
test "highlight_css produces html" {
  let html = highlight_css("body { color: red; }")
  inspect(html.contains("<span"), content="true")
}

///|
test "highlight_bash produces html" {
  let html = highlight_bash("echo hello")
  inspect(html.contains("<span"), content="true")
}

///|
test "highlight_rust produces html" {
  let html = highlight_rust("fn main() {}")
  inspect(html.contains("<span"), content="true")
}

///|
test "highlight_typescript empty input" {
  let html = highlight_typescript("")
  // Should not error on empty input
  inspect(html.length() >= 0, content="true")
}
