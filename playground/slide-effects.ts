///| Canvas particle engine for slide effects, ported from slidecraft's
///| Effects.tsx into a framework-agnostic class.
///|
///| Single requestAnimationFrame loop; self-stops when idle (no particles and
///| ambient off). Confetti is a one-shot burst; sparkle is an ambient drizzle.

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  spin: number;
  life: number;
  maxLife: number;
  kind: "confetti" | "sparkle";
}

const COLORS = ["#ff5e5b", "#ffd166", "#06d6a0", "#4cc9f0", "#c77dff", "#f72585"];

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export class SlideEffects {
  private canvas: HTMLCanvasElement | null = null;
  private particles: Particle[] = [];
  private ambient = false;
  private frame = 0;
  private running = false;
  private resizeHandler: (() => void) | null = null;

  /** Attach to a canvas element; sizes it to the window and tracks resizes. */
  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    const resize = () => {
      if (this.canvas) {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
      }
    };
    resize();
    this.resizeHandler = resize;
    window.addEventListener("resize", resize);
  }

  /** Fire a one-shot confetti burst from the lower-center of the canvas. */
  burst(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    for (let i = 0; i < 180; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 11;
      this.particles.push({
        x: canvas.width / 2,
        y: canvas.height * 0.6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6,
        size: 6 + Math.random() * 8,
        color: pick(COLORS),
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3,
        life: 0,
        maxLife: 120 + Math.random() * 60,
        kind: "confetti",
      });
    }
    this.ensureLoop();
  }

  /** Enable/disable the ambient sparkle drizzle. */
  setAmbient(on: boolean): void {
    this.ambient = on;
    if (on) this.ensureLoop();
  }

  /** Stop the loop and detach listeners. */
  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.running = false;
    this.particles = [];
    this.ambient = false;
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    this.canvas = null;
  }

  private spawnSparkles(width: number, height: number): void {
    if (Math.random() < 0.25) {
      this.particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: -0.2,
        size: 1.5 + Math.random() * 2.5,
        color: pick(["#fef9c3", "#e0f2fe", "#ffffff", "#fde68a"]),
        rotation: 0,
        spin: 0,
        life: 0,
        maxLife: 50 + Math.random() * 40,
        kind: "sparkle",
      });
    }
  }

  private tick = (): void => {
    const canvas = this.canvas;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      this.running = false;
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.ambient) {
      this.spawnSparkles(canvas.width, canvas.height);
    }
    this.particles = this.particles.filter((p) => {
      p.life += 1;
      if (p.life >= p.maxLife) return false;
      if (p.kind === "confetti") {
        p.vy += 0.18;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;
        if (p.y > canvas.height + 20) return false;
        const fade = Math.min(1, (p.maxLife - p.life) / 30);
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        p.y += p.vy;
        const twinkle = Math.sin((Math.PI * p.life) / p.maxLife);
        ctx.save();
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      return true;
    });
    if (this.particles.length > 0 || this.ambient) {
      this.frame = requestAnimationFrame(this.tick);
    } else {
      this.running = false;
    }
  };

  private ensureLoop(): void {
    if (!this.running) {
      this.running = true;
      this.frame = requestAnimationFrame(this.tick);
    }
  }
}
