///| Fullscreen slide presentation overlay (Luna UI).
///|
///| Ported from slidecraft's Player.tsx. Renders above everything as a fixed
///| overlay. Keyboard / click / touch navigation, per-slide CSS transitions,
///| confetti / sparkle effects, blackout, laser pointer, help overlay, and an
///| auto-hiding controls bar.

import { render, createSignal, createEffect, onMount, onCleanup, Show, untrack } from "@luna_ui/luna";
import type { SlideData } from "../js/slide_api";
import { isAtEnd, next, prev, progress, type DeckPosition } from "./slide-navigation";
import { SlideView } from "./SlideView";
import { SlideEffects } from "./slide-effects";

interface SlidePlayerProps {
  deck: () => SlideData[];
  /// Whether the player is currently open. The component instance stays alive
  /// while hidden (Luna's <Show> only detaches the DOM), so all listeners and
  /// effects must gate on this, and opening must reset transient state.
  active: () => boolean;
  /// Accessor for the slide index to start from when the player opens.
  startSlide?: () => number;
  onExit: () => void;
}

const HELP_ITEMS: Array<[string, string]> = [
  ["→ / Space / Click", "Next"],
  ["← / ↑", "Previous"],
  ["Home / End", "First / last slide"],
  ["F", "Toggle fullscreen"],
  ["B / .", "Blackout"],
  ["L", "Laser pointer"],
  ["C", "Confetti"],
  ["? / H", "This help"],
  ["Esc", "Exit presentation"],
];

export function SlidePlayer(props: SlidePlayerProps) {
  const deck = () => props.deck();

  const [pos, setPos] = createSignal<DeckPosition>({ slide: 0, fragment: 0 });
  const [direction, setDirection] = createSignal<"forward" | "backward">("forward");
  const [blackout, setBlackout] = createSignal(false);
  const [laser, setLaser] = createSignal(false);
  const [pointer, setPointer] = createSignal({ x: -100, y: -100 });
  const [showHelp, setShowHelp] = createSignal(false);
  const [controlsVisible, setControlsVisible] = createSignal(true);

  let hideTimer = 0;
  let touchStartX: number | null = null;
  const effects = new SlideEffects();

  const currentSlide = () => deck()[pos().slide];

  const goNext = () => {
    setDirection("forward");
    setPos((p) => next(deck(), p));
  };

  const goPrev = () => {
    setDirection("backward");
    setPos((p) => prev(deck(), p));
  };

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(index, deck().length - 1));
    setDirection(clamped >= untrack(() => pos().slide) ? "forward" : "backward");
    setPos({ slide: clamped, fragment: 0 });
  };

  const exit = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    props.onExit();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const wakeControls = () => {
    setControlsVisible(true);
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => setControlsVisible(false), 2500);
  };

  // Reset transient state every time the player opens; silence ambient
  // effects while it is hidden.
  createEffect(() => {
    if (props.active()) {
      const start = untrack(() => props.startSlide?.() ?? 0);
      const max = untrack(() => Math.max(0, deck().length - 1));
      setPos({ slide: Math.min(Math.max(0, start), max), fragment: 0 });
      setDirection("forward");
      setBlackout(false);
      setLaser(false);
      setShowHelp(false);
      wakeControls();
    } else {
      effects.setAmbient(false);
    }
  });

  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!props.active()) return;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "Enter":
        case "PageDown":
          event.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
        case "Backspace":
          event.preventDefault();
          goPrev();
          break;
        case "Home":
          event.preventDefault();
          goTo(0);
          break;
        case "End":
          event.preventDefault();
          goTo(deck().length - 1);
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "b":
        case "B":
        case ".":
          setBlackout((v) => !v);
          break;
        case "l":
        case "L":
          setLaser((v) => !v);
          break;
        case "c":
        case "C":
          effects.burst();
          break;
        case "?":
        case "h":
        case "H":
          setShowHelp((v) => !v);
          break;
        case "Escape":
          event.preventDefault();
          exit();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    wakeControls();
    onCleanup(() => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(hideTimer);
      effects.dispose();
    });
  });

  // Per-slide effects: confetti burst on entry, ambient sparkle while present.
  createEffect(() => {
    if (!props.active()) return;
    pos().slide; // track slide changes
    const slide = untrack(() => currentSlide());
    if (slide?.effect === "confetti") {
      effects.burst();
    }
    effects.setAmbient(slide?.effect === "sparkle");
  });

  const handlePointerMove = (event: PointerEvent) => {
    wakeControls();
    if (laser()) {
      setPointer({ x: event.clientX, y: event.clientY });
    }
  };

  const handleClick = (event: MouseEvent) => {
    if (showHelp()) {
      setShowHelp(false);
      return;
    }
    if (blackout()) {
      setBlackout(false);
      return;
    }
    if (event.clientX < window.innerWidth * 0.2) {
      goPrev();
    } else {
      goNext();
    }
  };

  const handleTouchStart = (event: TouchEvent) => {
    touchStartX = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (touchStartX === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX;
    touchStartX = null;
    if (delta < -40) {
      goNext();
    } else if (delta > 40) {
      goPrev();
    }
  };

  return (
    <div
      class="sld-player"
      ref={(el: HTMLDivElement) => {
        createEffect(() => {
          el.classList.toggle("sld-laser-on", laser());
        });
      }}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slide frame: imperative re-render so the transition animation
          re-triggers on each slide change (class is rebuilt every render). */}
      <div
        class="sld-frame"
        ref={(el: HTMLDivElement) => {
          createEffect(() => {
            const p = pos();
            const slides = deck();
            const slide = slides[p.slide];
            const transition = slide?.transition ?? "slide";
            const dir = untrack(() => direction());
            // Rebuild className to retrigger the CSS animation on each change.
            el.className = `sld-frame sld-anim-${transition} sld-dir-${dir}`;
            el.innerHTML = "";
            if (slide) {
              render(el, <SlideView slide={slide} fragment={p.fragment} />);
            }
          });
        }}
      />

      <canvas
        class="sld-effects-canvas"
        ref={(el: HTMLCanvasElement) => {
          effects.attach(el);
        }}
      />

      <Show when={blackout}>
        <div class="sld-blackout" />
      </Show>

      <Show when={laser}>
        <div
          class="sld-laser-dot"
          ref={(el: HTMLDivElement) => {
            createEffect(() => {
              const pt = pointer();
              el.style.left = `${pt.x}px`;
              el.style.top = `${pt.y}px`;
            });
          }}
        />
      </Show>

      <Show when={showHelp}>
        <div class="sld-help-overlay">
          <h2>Keyboard Shortcuts</h2>
          <dl>
            {HELP_ITEMS.map(([key, label]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Show>

      <div class="sld-progress-bar">
        <div
          class="sld-progress-fill"
          ref={(el: HTMLDivElement) => {
            createEffect(() => {
              el.style.width = `${progress(deck(), pos()) * 100}%`;
            });
          }}
        />
      </div>

      <div
        class="sld-controls"
        ref={(el: HTMLDivElement) => {
          createEffect(() => {
            el.classList.toggle("sld-visible", controlsVisible());
          });
        }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <button onClick={goPrev} title="Previous (←)">
          {"←"}
        </button>
        <button
          onClick={goNext}
          title="Next (→)"
          ref={(el: HTMLButtonElement) => {
            createEffect(() => {
              el.disabled = isAtEnd(deck(), pos());
            });
          }}
        >
          {"→"}
        </button>
        <span
          class="sld-counter"
          ref={(el: HTMLSpanElement) => {
            createEffect(() => {
              el.textContent = `${pos().slide + 1} / ${deck().length}`;
            });
          }}
        />
        <button onClick={toggleFullscreen} title="Fullscreen (F)">
          {"⛶"}
        </button>
        <button onClick={() => effects.burst()} title="Confetti (C)">
          {"🎉"}
        </button>
        <button
          onClick={() => setLaser((v) => !v)}
          title="Laser pointer (L)"
          ref={(el: HTMLButtonElement) => {
            createEffect(() => {
              el.classList.toggle("sld-active", laser());
            });
          }}
        >
          {"●"}
        </button>
        <button onClick={() => setBlackout((v) => !v)} title="Blackout (B)">
          {"◼"}
        </button>
        <button onClick={() => setShowHelp((v) => !v)} title="Help (?)">
          {"?"}
        </button>
        <button onClick={exit} title="Exit (Esc)">
          {"✕"}
        </button>
      </div>
    </div>
  );
}
