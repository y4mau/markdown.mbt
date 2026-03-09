///| Scanner method tests

///|
test "scanner: peek at beginning" {
  let s = Scanner::new("abc")
  inspect(s.peek(), content="Some('a')")
}

///|
test "scanner: peek at eof" {
  let s = Scanner::new("")
  inspect(s.peek(), content="None")
}

///|
test "scanner: peek_at offset" {
  let s = Scanner::new("abcde")
  inspect(s.peek_at(0), content="Some('a')")
  inspect(s.peek_at(2), content="Some('c')")
  inspect(s.peek_at(4), content="Some('e')")
  inspect(s.peek_at(5), content="None")
  inspect(s.peek_at(-1), content="None")
}

///|
test "scanner: consume returns chars sequentially" {
  let s = Scanner::new("ab")
  inspect(s.consume(), content="Some('a')")
  inspect(s.consume(), content="Some('b')")
  inspect(s.consume(), content="None")
}

///|
test "scanner: advance" {
  let s = Scanner::new("abcde")
  s.advance(3)
  inspect(s.peek(), content="Some('d')")
  // Advance past end clamps to len
  s.advance(100)
  inspect(s.is_eof(), content="true")
}

///|
test "scanner: remaining" {
  let s = Scanner::new("hello world")
  s.advance(6)
  inspect(s.remaining(), content="world")
}

///|
test "scanner: remaining at eof" {
  let s = Scanner::new("x")
  s.advance(1)
  inspect(s.remaining(), content="")
}

///|
test "scanner: substring" {
  let s = Scanner::new("abcdef")
  inspect(s.substring(1, 4), content="bcd")
}

///|
test "scanner: substring clamping" {
  let s = Scanner::new("abc")
  inspect(s.substring(-1, 10), content="abc")
  inspect(s.substring(3, 1), content="")
}

///|
test "scanner: skip_spaces" {
  let s = Scanner::new("   abc")
  let skipped = s.skip_spaces()
  inspect(skipped, content="3")
  inspect(s.peek(), content="Some('a')")
}

///|
test "scanner: skip_spaces with tabs" {
  let s = Scanner::new("\t\tabc")
  let skipped = s.skip_spaces()
  inspect(skipped, content="2")
  inspect(s.peek(), content="Some('a')")
}

///|
test "scanner: skip_spaces no spaces" {
  let s = Scanner::new("abc")
  let skipped = s.skip_spaces()
  inspect(skipped, content="0")
}

///|
test "scanner: count_leading_spaces" {
  let s = Scanner::new("  abc")
  inspect(s.count_leading_spaces(), content="2")
  // Position should not change
  inspect(s.peek(), content="Some(' ')")
}

///|
test "scanner: count_leading_spaces with tab" {
  let s = Scanner::new("\tabc")
  let count = s.count_leading_spaces()
  inspect(count, content="4")
}

///|
test "scanner: read_line" {
  let s = Scanner::new("hello\nworld")
  let line = s.read_line()
  inspect(line, content="hello")
  // Position should be at \n
  inspect(s.peek(), content="Some('\\n')")
}

///|
test "scanner: read_line at eof" {
  let s = Scanner::new("no newline")
  let line = s.read_line()
  inspect(line, content="no newline")
  inspect(s.is_eof(), content="true")
}

///|
test "scanner: skip_line" {
  let s = Scanner::new("first\nsecond")
  s.skip_line()
  inspect(s.peek(), content="Some('s')")
}

///|
test "scanner: skip_line at eof" {
  let s = Scanner::new("only")
  s.skip_line()
  inspect(s.is_eof(), content="true")
}

///|
test "scanner: is_blank_line true" {
  let s = Scanner::new("   \nhello")
  inspect(s.is_blank_line(), content="true")
}

///|
test "scanner: is_blank_line false" {
  let s = Scanner::new("hello\n")
  inspect(s.is_blank_line(), content="false")
}

///|
test "scanner: is_blank_line empty" {
  let s = Scanner::new("")
  inspect(s.is_blank_line(), content="true")
}

///|
test "scanner: matches" {
  let s = Scanner::new("```js")
  inspect(s.matches("```"), content="true")
  inspect(s.matches("~~~"), content="false")
  inspect(s.matches("```javascript"), content="false")
}

///|
test "scanner: consume_str" {
  let s = Scanner::new("---rest")
  inspect(s.consume_str("---"), content="true")
  inspect(s.peek(), content="Some('r')")
  inspect(s.consume_str("nope"), content="false")
}

///|
test "scanner: count_char" {
  let s = Scanner::new("###text")
  inspect(s.count_char('#'), content="3")
  inspect(s.count_char('x'), content="0")
}

///|
test "scanner: save and restore" {
  let s = Scanner::new("abcdef")
  let pos = s.save()
  s.advance(3)
  inspect(s.peek(), content="Some('d')")
  s.restore(pos)
  inspect(s.peek(), content="Some('a')")
}

///|
test "scanner: is_eof" {
  let s = Scanner::new("a")
  inspect(s.is_eof(), content="false")
  s.advance(1)
  inspect(s.is_eof(), content="true")
}

///|
test "scanner: line ending normalization \\r\\n" {
  let s = Scanner::new("a\r\nb")
  inspect(s.peek_at(1), content="Some('\\n')")
  // \r\n is normalized to single \n, so length is 3
  inspect(s.len, content="3")
}

///|
test "scanner: line ending normalization \\r" {
  let s = Scanner::new("a\rb")
  inspect(s.peek_at(1), content="Some('\\n')")
  inspect(s.len, content="3")
}

// Character utility tests

///|
test "is_whitespace" {
  inspect(is_whitespace(' '), content="true")
  inspect(is_whitespace('\t'), content="true")
  inspect(is_whitespace('\n'), content="true")
  inspect(is_whitespace('\r'), content="true")
  inspect(is_whitespace('a'), content="false")
}

///|
test "is_digit" {
  inspect(is_digit('0'), content="true")
  inspect(is_digit('9'), content="true")
  inspect(is_digit('a'), content="false")
}

///|
test "is_letter" {
  inspect(is_letter('a'), content="true")
  inspect(is_letter('Z'), content="true")
  inspect(is_letter('0'), content="false")
}

///|
test "is_alphanumeric" {
  inspect(is_alphanumeric('a'), content="true")
  inspect(is_alphanumeric('5'), content="true")
  inspect(is_alphanumeric('!'), content="false")
}

///|
test "is_punctuation" {
  inspect(is_punctuation('!'), content="true")
  inspect(is_punctuation('*'), content="true")
  inspect(is_punctuation('~'), content="true")
  inspect(is_punctuation('a'), content="false")
  inspect(is_punctuation(' '), content="false")
}

///|
test "char_is" {
  inspect(char_is(Some('a'), 'a'), content="true")
  inspect(char_is(Some('a'), 'b'), content="false")
  inspect(char_is(None, 'a'), content="false")
}

///|
test "char_is_digit" {
  inspect(char_is_digit(Some('5')), content="true")
  inspect(char_is_digit(Some('x')), content="false")
  inspect(char_is_digit(None), content="false")
}

///|
test "scanner substring clamping" {
  let s = Scanner::new("hello")
  inspect(s.substring(100, 200), content="")
  inspect(s.substring(-1, 3), content="hel")
  inspect(s.substring(0, -1), content="")
}
