// Render hard-edged clusters on a low-resolution canvas, then enlarge once.
export function surface(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Scan conversion avoids anti-aliased vector edges on the native pixel grid.
export function poly(ctx, color, points) {
  let min = Infinity, max = -Infinity;
  for (let i = 1; i < points.length; i += 2) {
    min = Math.min(min, points[i]); max = Math.max(max, points[i]);
  }
  const hits = [];
  ctx.fillStyle = color;
  for (let y = Math.ceil(min - .5); y < max - .5; y++) {
    const row = y + .5;
    hits.length = 0;
    for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
      const a = points[i + 1], b = points[j + 1];
      if ((a > row) !== (b > row)) hits.push(points[i] + (row - a) * (points[j] - points[i]) / (b - a));
    }
    hits.sort((a, b) => a - b);
    for (let i = 1; i < hits.length; i += 2) {
      const x = Math.ceil(hits[i - 1] - .5), end = Math.ceil(hits[i] - .5);
      if (end > x) ctx.fillRect(x, y, end - x, 1);
    }
  }
}

export function panels(ctx, palette, shapes) {
  for (const [key, ...points] of shapes) poly(ctx, palette[key] || key, points);
}

export function line(ctx, color, x, y, endX, endY, weight = 1) {
  x = Math.round(x); y = Math.round(y); endX = Math.round(endX); endY = Math.round(endY);
  const dx = Math.abs(endX - x), sx = x < endX ? 1 : -1;
  const dy = -Math.abs(endY - y), sy = y < endY ? 1 : -1;
  let error = dx + dy;
  ctx.fillStyle = color;
  for (;;) {
    ctx.fillRect(x, y, weight, weight);
    if (x === endX && y === endY) return;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
}

export const colors = {
  jin: { ink:'#191727', dark:'#2b2537', shade:'#773b42', mid:'#bf5952', skin:'#ec9370', light:'#ffbc89', glow:'#ffdc9a', cloth:'#be483d', clothHi:'#f9794d', trim:'#ffaf65', hair:'#655675', hairMid:'#b6a1b6', hairHi:'#e8d8d5' },
  lan: { ink:'#111b2c', dark:'#1c2f40', shade:'#704857', mid:'#ad7377', skin:'#dfa596', light:'#ffcfad', glow:'#bdf9d7', cloth:'#205665', clothHi:'#359899', trim:'#67dcbd', hair:'#174555', hairMid:'#28888c', hairHi:'#69ccba' },
  yue: { ink:'#211f29', dark:'#32313a', shade:'#653c3e', mid:'#a26351', skin:'#c68561', light:'#edad78', glow:'#ffdf98', cloth:'#746043', clothHi:'#c19455', trim:'#efc266', hair:'#342e39', hairMid:'#5a4d53', hairHi:'#84706a' },
};
