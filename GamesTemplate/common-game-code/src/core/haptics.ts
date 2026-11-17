// Vibration as part of feedback (UX-ANIMATION-RULES ת1). One place, so every game buzzes the same way and one switch
// turns it off. Android browsers vibrate; iPhone Safari has no navigator.vibrate at all, which is expected: the call
// does nothing there and the visual + sound feedback carries the moment.
export const haptics = { on: true };

/** Buzz for `ms` milliseconds, or a pattern [buzz, pause, buzz, ...]. Keep it short: 8–15 small, 30–50 a hit. */
export function haptic(ms: number | number[]): void {
  if (!haptics.on || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(ms);
}
