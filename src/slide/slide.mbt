///|
/// Slide metadata parsed from directive blocks
pub(all) struct SlideMeta {
  /// Validated: fade|slide|zoom|flip|none; None if absent or invalid
  transition : String?
  /// Any non-empty value, not validated
  background : String?
  /// Validated: confetti|sparkle; None if absent or invalid
  effect : String?
}

///|
/// Slide represents a single slide with its content span
pub(all) struct Slide {
  /// 0-indexed slide number
  index : Int
  /// Start offset in source text
  start : Int
  /// End offset in source text (exclusive)
  end : Int
  /// The AST blocks for this slide
  blocks : Array[@markdown.Block]
  /// Fragment steps: source text of each step, split by standalone -- paragraphs
  steps : Array[String]
  /// Slide-level metadata from directive blocks
  meta : SlideMeta
}

///|
/// SlideDocument represents a parsed slide document
pub(all) struct SlideDocument {
  slides : Array[Slide]
  source : String
}

///|
/// Check if a string is a valid transition value
fn is_valid_transition(s : String) -> Bool {
  s == "fade" || s == "slide" || s == "zoom" || s == "flip" || s == "none"
}

///|
/// Check if a string is a valid effect value
fn is_valid_effect(s : String) -> Bool {
  s == "confetti" || s == "sparkle"
}

///|
/// Parse a single directive line of the form "::<word> <value>"
/// Returns Some((key, value)) if valid, None otherwise
fn parse_directive_line(line : String) -> (String, String)? {
  if not(line.has_prefix("::")) {
    return None
  }
  let rest = line.unsafe_substring(start=2, end=line.length())
  // Find whitespace separating key and value
  let mut space_idx = -1
  let mut idx = 0
  let chars = rest.to_array()
  for c in chars {
    if c == ' ' || c == '\t' {
      space_idx = idx
      break
    }
    // Key chars must be [A-Za-z0-9_]
    let is_valid = (c >= 'a' && c <= 'z') ||
      (c >= 'A' && c <= 'Z') ||
      (c >= '0' && c <= '9') ||
      c == '_'
    if not(is_valid) {
      return None
    }
    idx += 1
  }
  if space_idx <= 0 {
    return None
  }
  let key = rest.unsafe_substring(start=0, end=space_idx)
  let value_raw = rest.unsafe_substring(start=space_idx + 1, end=rest.length())
  // Trim trailing whitespace from value
  let value = value_raw.trim_end(chars=" \t\r\n").to_string()
  if value.is_empty() {
    return None
  }
  Some((key, value))
}

///|
/// Check if a source text string is a directive block
/// (every non-empty line matches "::<word> <value>")
/// Returns parsed directives if true, None if not a directive block
fn parse_directive_block(text : String) -> Array[(String, String)]? {
  let lines = text.split("\n")
  let directives : Array[(String, String)] = []
  let mut found_directive = false
  for line in lines {
    let trimmed = line.to_string().trim_end(chars=" \t\r").to_string()
    if trimmed.is_empty() {
      continue
    }
    match parse_directive_line(trimmed) {
      Some(d) => {
        directives.push(d)
        found_directive = true
      }
      None => return None // Mixed content - not a directive block
    }
  }
  if found_directive {
    Some(directives)
  } else {
    None
  }
}

///|
/// Check if a source text string is a fragment separator (exactly "--" when trimmed)
fn is_fragment_separator(text : String) -> Bool {
  text.trim(chars=" \t\r\n").to_string() == "--"
}

///|
/// Get block source text from the document source, clamped to valid range
fn get_block_source(source : String, span : @markdown.Span) -> String {
  let start = if span.from < 0 { 0 } else { span.from }
  let end = if span.to > source.length() { source.length() } else { span.to }
  if start >= end {
    return ""
  }
  source[start:end].to_string() catch {
    _ => ""
  }
}

///|
/// Join an array of strings with a separator
fn join_strings(parts : Array[String], sep : String) -> String {
  let buf = StringBuilder::new()
  let mut first = true
  for s in parts {
    if not(first) {
      buf.write_string(sep)
    }
    buf.write_string(s)
    first = false
  }
  buf.to_string()
}

///|
/// Build SlideMeta from a list of (key, value) directives
fn build_meta(directives : Array[(String, String)]) -> SlideMeta {
  let mut transition : String? = None
  let mut background : String? = None
  let mut effect : String? = None
  for entry in directives {
    let (key, value) = entry
    match key {
      "transition" =>
        transition = if is_valid_transition(value) { Some(value) } else { None }
      "background" => background = Some(value)
      "effect" => effect = if is_valid_effect(value) { Some(value) } else { None }
      _ => () // Unknown keys are ignored
    }
  }
  SlideMeta::{ transition, background, effect }
}

///|
/// Process blocks of a single slide into steps and meta
fn process_slide_blocks(
  source : String,
  blocks : Array[@markdown.Block],
) -> (Array[String], SlideMeta) {
  let all_directives : Array[(String, String)] = []
  // Build steps: current step content blocks
  let current_step_blocks : Array[String] = []
  let steps : Array[String] = []

  for block in blocks {
    match block {
      @markdown.Block::BlankLines(..) => () // Skip blank lines
      @markdown.Block::Paragraph(span~, ..) => {
        let text = get_block_source(source, span)
        // Check if it's a fragment separator
        if is_fragment_separator(text) {
          // End current step: collect non-empty blocks
          let non_empty : Array[String] = []
          for s in current_step_blocks {
            if not(s.trim(chars=" \t\r\n").to_string().is_empty()) {
              non_empty.push(s)
            }
          }
          let step_content = join_strings(non_empty, "\n\n")
          if not(step_content.trim(chars=" \t\r\n").to_string().is_empty()) {
            steps.push(step_content)
          }
          current_step_blocks.clear()
        } else {
          // Check if it's a directive block
          match parse_directive_block(text) {
            Some(directives) => {
              // Directive block: add to meta, exclude from steps
              for d in directives {
                all_directives.push(d)
              }
            }
            None => {
              // Regular content
              current_step_blocks.push(text)
            }
          }
        }
      }
      _ => {
        // Any other block type: get its source and add to current step
        let span = match block {
          @markdown.Block::Heading(span~, ..) => span
          @markdown.Block::FencedCode(span~, ..) => span
          @markdown.Block::IndentedCode(span~, ..) => span
          @markdown.Block::Blockquote(span~, ..) => span
          @markdown.Block::BulletList(span~, ..) => span
          @markdown.Block::OrderedList(span~, ..) => span
          @markdown.Block::HtmlBlock(span~, ..) => span
          @markdown.Block::Table(span~, ..) => span
          @markdown.Block::FootnoteDefinition(span~, ..) => span
          _ => @markdown.Span::new(0, 0)
        }
        let text = get_block_source(source, span)
        if not(text.is_empty()) {
          current_step_blocks.push(text)
        }
      }
    }
  }

  // Finalize last step
  let non_empty_last : Array[String] = []
  for s in current_step_blocks {
    if not(s.trim(chars=" \t\r\n").to_string().is_empty()) {
      non_empty_last.push(s)
    }
  }
  let last_step = join_strings(non_empty_last, "\n\n")
  if not(last_step.trim(chars=" \t\r\n").to_string().is_empty()) {
    steps.push(last_step)
  }

  // Ensure at least one step
  let final_steps = if steps.length() == 0 { [""] } else { steps }
  let meta = build_meta(all_directives)
  (final_steps, meta)
}

///|
/// Parse markdown into slides, splitting on ThematicBreak (---)
pub fn parse(source : String) -> SlideDocument {
  let result = @markdown.parse(source)
  let doc = result.document
  let slides : Array[Slide] = []
  let current_blocks : Array[@markdown.Block] = []
  let mut slide_start = 0
  let mut slide_index = 0
  for block in doc.children {
    match block {
      @markdown.Block::ThematicBreak(span~, ..) => {
        // End current slide before the thematic break
        if current_blocks.length() > 0 {
          let (steps, meta) = process_slide_blocks(source, current_blocks)
          slides.push(Slide::{
            index: slide_index,
            start: slide_start,
            end: span.from,
            blocks: current_blocks.copy(),
            steps,
            meta,
          })
          slide_index += 1
          current_blocks.clear()
        }
        // Start new slide after thematic break
        slide_start = span.to
      }
      _ => current_blocks.push(block)
    }
  }

  // Don't forget the last slide
  if current_blocks.length() > 0 {
    let (steps, meta) = process_slide_blocks(source, current_blocks)
    slides.push(Slide::{
      index: slide_index,
      start: slide_start,
      end: source.length(),
      blocks: current_blocks.copy(),
      steps,
      meta,
    })
  }

  // Handle empty document
  if slides.length() == 0 {
    slides.push(Slide::{
      index: 0,
      start: 0,
      end: source.length(),
      blocks: [],
      steps: [""],
      meta: SlideMeta::{ transition: None, background: None, effect: None },
    })
  }
  SlideDocument::{ slides, source }
}

///|
/// Find which slide contains the given cursor position
pub fn SlideDocument::find_slide_at_position(
  self : SlideDocument,
  position : Int,
) -> Int {
  for slide in self.slides {
    if position >= slide.start && position < slide.end {
      return slide.index
    }
  }
  // Default to last slide if position is at or beyond end
  if self.slides.length() > 0 {
    return self.slides[self.slides.length() - 1].index
  }
  0
}

///|
/// Get total number of slides
pub fn SlideDocument::slide_count(self : SlideDocument) -> Int {
  self.slides.length()
}

///|
/// Get a specific slide by index
pub fn SlideDocument::get_slide(self : SlideDocument, index : Int) -> Slide? {
  if index >= 0 && index < self.slides.length() {
    Some(self.slides[index])
  } else {
    None
  }
}

///|
/// Get the source text for a slide
pub fn SlideDocument::get_slide_source(
  self : SlideDocument,
  index : Int,
) -> String {
  match self.get_slide(index) {
    Some(slide) => {
      let start = if slide.start < 0 { 0 } else { slide.start }
      let end = if slide.end > self.source.length() {
        self.source.length()
      } else {
        slide.end
      }
      if start >= end {
        ""
      } else {
        // Use try to handle potential slice errors
        self.source[start:end].to_string() catch {
          _ => ""
        }
      }
    }
    None => ""
  }
}
