///| FFI exports for slide parsing

///|
/// Parse markdown into slides and return JSON string.
/// JSON shape: {"slides":[{"index":0,"start":0,"end":42,"steps":["..."],"transition":"fade","background":null,"effect":null}]}
pub fn md_parse_slides(source : String) -> String {
  let doc = @slide.parse(source)
  let slides_json : Array[Json] = []
  for slide in doc.slides {
    let steps_json : Array[Json] = []
    for step in slide.steps {
      steps_json.push(step.to_json())
    }
    let transition_json : Json = match slide.meta.transition {
      Some(v) => v.to_json()
      None => Json::null()
    }
    let background_json : Json = match slide.meta.background {
      Some(v) => v.to_json()
      None => Json::null()
    }
    let effect_json : Json = match slide.meta.effect {
      Some(v) => v.to_json()
      None => Json::null()
    }
    slides_json.push({
      "index": slide.index.to_json(),
      "start": slide.start.to_json(),
      "end": slide.end.to_json(),
      "steps": Json::array(steps_json),
      "transition": transition_json,
      "background": background_json,
      "effect": effect_json,
    })
  }
  let result : Json = { "slides": Json::array(slides_json) }
  result.stringify()
}
