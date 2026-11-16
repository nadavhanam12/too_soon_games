// Lazy modules (DECISIONS 72): heavy code a game needs only after the title (a 3D library, say) is built by build.mjs
// from Games/<GameId>/src/lazy/<name>.ts into <slug>/lazy/<name>.js, outside index.html's 300 KB budget (rule 13א).
// loadLazy adds the script tag once; the module registers itself on window and the game reads it from there.

const pending = new Map<string, Promise<void>>();

/** Load lazy/<name>.js (relative to the page). Resolves when the script has run; rejects if it fails to load. */
export function loadLazy(name: string): Promise<void> {
  const hit = pending.get(name);
  if (hit) return hit;
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `lazy/${name}.js`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { pending.delete(name); s.remove(); reject(new Error(`lazy module ${name} failed to load`)); };
    document.head.appendChild(s);
  });
  pending.set(name, p);
  return p;
}
