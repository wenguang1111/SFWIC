// 方向键按住即持续为 true；攻击键 A/B/C/D 只在按下那一帧为 true。
const bindings = new Map(Object.entries({
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  KeyJ: 'a', KeyK: 'b', KeyU: 'c', KeyI: 'd',
}));
const directions = new Set(['up', 'down', 'left', 'right']);

// Key edges survive between display frames, but never repeat during catch-up ticks.
export function keyboard(isPlaying) {
  const held = new Set(), edges = new Set();
  window.addEventListener('keydown', event => {
    const action = bindings.get(event.code);
    if (!action || !isPlaying() || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    if (!event.repeat && !directions.has(action)) edges.add(action);
    held.add(event.code);
  });
  window.addEventListener('keyup', event => held.delete(event.code));
  return {
    sample() {
      const input = {};
      for (const code of held) {
        const action = bindings.get(code);
        if (directions.has(action)) input[action] = true;
      }
      for (const action of edges) input[action] = true;
      edges.clear();
      return input;
    },
    reset() { held.clear(); edges.clear(); },
  };
}
