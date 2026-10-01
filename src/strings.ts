const NOTES = [220, 329.63, 440, 554.37];

type AudioBundle = {
  ctx: AudioContext;
};

let audio: AudioBundle | null = null;

function audioContext(): AudioContext | null {
  const Ctx = window.AudioContext;
  if (!Ctx) return null;
  if (!audio) audio = { ctx: new Ctx() };
  return audio.ctx;
}

export function pluck(index: number): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = audioContext();
  if (!ctx) return;
  const freq = NOTES[index] ?? NOTES[0];
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.55), now + 0.35);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1400, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.45);
}

type Strand = {
  y: Float32Array;
  v: Float32Array;
  rest: number;
};

export function mountStrings(canvas: HTMLCanvasElement, bed: HTMLElement): () => void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const count = 4;
  const samples = 64;
  const strands: Strand[] = Array.from({ length: count }, () => ({
    y: new Float32Array(samples),
    v: new Float32Array(samples),
    rest: 0,
  }));

  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;

  let frame = 0;
  let pointerX = -1;
  let pointerY = -1;
  let alive = true;

  function resize(): void {
    const rect = bed.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    strands.forEach((strand, i) => {
      strand.rest = ((i + 0.5) / count) * rect.height;
    });
  }

  function nearestStrand(py: number): number {
    let nearest = 0;
    let best = Infinity;
    strands.forEach((strand, i) => {
      const distance = Math.abs(py - strand.rest);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    });
    return nearest;
  }

  function hoverBend(strand: Strand, i: number, width: number): number {
    const x = (i / (samples - 1)) * width;
    const dx = x - pointerX;
    const spatial = Math.exp(-(dx * dx) / 14000);
    const dy = pointerY - strand.rest;
    const reach = 24;
    if (Math.abs(dy) > reach) return 0;
    const vertical = 1 - Math.abs(dy) / reach;
    return Math.sign(dy) * vertical * spatial * 5;
  }

  function disturb(px: number, py: number, amount: number): void {
    const width = bed.getBoundingClientRect().width;
    const strand = strands[nearestStrand(py)];
    if (!strand) return;
    const index = Math.round((px / width) * (samples - 1));
    for (let k = -3; k <= 3; k += 1) {
      const j = index + k;
      if (j <= 0 || j >= samples - 1) continue;
      const local = 1 - Math.abs(k) / 4;
      strand.v[j] += amount * local;
    }
  }

  function step(): void {
    if (reduced) return;
    const width = bed.getBoundingClientRect().width;
    const active = pointerX >= 0 ? nearestStrand(pointerY) : -1;
    strands.forEach((strand, s) => {
      const { y, v } = strand;
      for (let i = 1; i < samples - 1; i += 1) {
        const target = s === active ? hoverBend(strand, i, width) : 0;
        const wave = ((y[i - 1] + y[i + 1]) / 2 - y[i]) * 0.12;
        const restore = (target - y[i]) * 0.28;
        v[i] = (v[i] + wave + restore) * 0.62;
        y[i] += v[i];
        if (y[i] > 8) y[i] = 8;
        if (y[i] < -8) y[i] = -8;
      }
      y[0] = 0;
      y[samples - 1] = 0;
      v[0] = 0;
      v[samples - 1] = 0;
    });
  }

  function draw(): void {
    const rect = bed.getBoundingClientRect();
    ctx!.clearRect(0, 0, rect.width, rect.height);
    strands.forEach((strand, s) => {
      ctx!.beginPath();
      ctx!.lineWidth = s === 1 ? 1.6 : 1.15;
      ctx!.strokeStyle = s === 1 ? "#c4622d" : "rgba(28, 25, 21, 0.72)";
      for (let i = 0; i < samples; i += 1) {
        const x = (i / (samples - 1)) * rect.width;
        const y = strand.rest + strand.y[i];
        if (i === 0) ctx!.moveTo(x, y);
        else ctx!.lineTo(x, y);
      }
      ctx!.stroke();
    });
  }

  function loop(): void {
    if (!alive) return;
    step();
    draw();
    frame = window.requestAnimationFrame(loop);
  }

  function onMove(event: PointerEvent): void {
    const rect = bed.getBoundingClientRect();
    pointerX = event.clientX - rect.left;
    pointerY = event.clientY - rect.top;
  }

  function onLeave(): void {
    pointerX = -1;
    pointerY = -1;
  }

  function onDown(event: PointerEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest("a")) return;
    const rect = bed.getBoundingClientRect();
    const y = event.clientY - rect.top;
    let nearest = 0;
    let best = Infinity;
    strands.forEach((strand, i) => {
      const d = Math.abs(y - strand.rest);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    disturb(event.clientX - rect.left, y, 4);
    pluck(nearest);
    const link = bed.querySelectorAll<HTMLAnchorElement>(".string-labels a")[nearest];
    const href = link?.getAttribute("href");
    if (!href) return;
    if (href.startsWith("#")) {
      document.querySelector(href)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
  }

  resize();
  draw();
  if (!reduced) frame = window.requestAnimationFrame(loop);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(bed);
  bed.addEventListener("pointermove", onMove);
  bed.addEventListener("pointerleave", onLeave);
  bed.addEventListener("pointerdown", onDown);

  return () => {
    alive = false;
    window.cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    bed.removeEventListener("pointermove", onMove);
    bed.removeEventListener("pointerleave", onLeave);
    bed.removeEventListener("pointerdown", onDown);
  };
}
