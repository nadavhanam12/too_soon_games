// Lazy modules (DECISIONS 72): heavy code a game needs only after the title (a 3D library, say) is built by build.mjs
// from Games/<GameId>/src/lazy/<name>.ts into <slug>/lazy/<name>.js, outside index.html's 300 KB budget (rule 13א).
// loadLazy adds the script tag once; the module registers itself on window and the game reads it from there.

const pending = new Map<string, Promise<void>>();

// The game's version goes into the script's URL. The file keeps its name between releases and browsers hold it for
// hours: without the version a returning player ran the new index.html with the previous release's lazy module
// (WastedForSix v0.1.11, 2026-11-17: the old 3D renderer drew the new game, so it looked not updated).
let version = '';
/** createGame calls this with game.json's version before anything can ask for a lazy module. */
export function setLazyVersion(v: string): void { version = v; }

/** Load lazy/<name>.js (relative to the page). Resolves when the script has run; rejects if it fails to load. */
export function loadLazy(name: string): Promise<void> {
  const hit = pending.get(name);
  if (hit) return hit;
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `lazy/${name}.js${version ? `?v=${encodeURIComponent(version)}` : ''}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { pending.delete(name); s.remove(); reject(new Error(`lazy module ${name} failed to load`)); };
    document.head.appendChild(s);
  });
  pending.set(name, p);
  return p;
}
