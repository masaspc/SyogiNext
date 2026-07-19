const queue: string[] = [];
let showing = false;

function showNext(): void {
  if (showing || !queue.length || typeof document === 'undefined') return;
  showing = true;
  const text = queue.shift()!;
  const overlay = document.createElement('div');
  overlay.className = 'ability-cutin';
  const call = document.createElement('strong');
  call.textContent = text;
  overlay.append(call);
  document.body.append(overlay);
  window.setTimeout(() => {
    overlay.remove();
    showing = false;
    showNext();
  }, 900);
}

export function showCutin(text: string): void {
  queue.push(text);
  showNext();
}
