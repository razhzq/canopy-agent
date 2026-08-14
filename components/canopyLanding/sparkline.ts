// Deterministic canvas sparkline used by the landing hero + marketplace cards.
// Seeded so server and client agree on shape (no Math.random hydration drift).

function series(seed: number, n: number): number[] {
  const out: number[] = [];
  let v = 0;
  let x = (seed * 9301) % 233280;
  for (let i = 0; i < n; i++) {
    x = (x * 9301 + 49297) % 233280;
    v += x / 233280 - 0.45;
    out.push(v);
  }
  return out;
}

export function drawSpark(canvas: HTMLCanvasElement, seed: number, up: boolean) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  const data = series(seed, 48);
  const min = Math.min(...data);
  const max = Math.max(...data);
  const rng = max - min || 1;
  const col = up ? "#5ED3B3" : "#E5484D";
  const pad = 4;
  const X = (i: number) => pad + (i / (data.length - 1)) * (w - pad * 2);
  const Y = (v: number) => h - pad - ((v - min) / rng) * (h - pad * 2);

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, up ? "rgba(94,211,179,.22)" : "rgba(229,72,77,.20)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.moveTo(X(0), h);
  data.forEach((v, i) => ctx.lineTo(X(i), Y(v)));
  ctx.lineTo(X(data.length - 1), h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  data.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.stroke();

  const lx = X(data.length - 1);
  const ly = Y(data[data.length - 1]);
  ctx.beginPath();
  ctx.arc(lx, ly, 2.6, 0, 7);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lx, ly, 5, 0, 7);
  ctx.strokeStyle = up ? "rgba(94,211,179,.4)" : "rgba(229,72,77,.4)";
  ctx.lineWidth = 1;
  ctx.stroke();
}
