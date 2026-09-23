const active = new WeakMap();
export const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Interruptible feedback on content only; never replace focused controls. */
export function revealContent(element, {distance = 3, duration = 200} = {}) {
  active.get(element)?.cancel();
  if (!element?.animate || reducedMotion()) return;
  const animation = element.animate([{opacity: .45, translate: `${distance}px 0`}, {opacity: 1, translate: '0 0'}],
    {duration, easing: 'cubic-bezier(.2,.75,.25,1)'});
  active.set(element, animation);
  animation.finished.catch(() => {}).finally(() => {if (active.get(element) === animation) active.delete(element);});
}

/** Native details semantics stay intact, including keyboard and programmatic opening. */
export function polishDisclosures(root) {
  // Only a user's summary activation animates; opening the current course path
  // during navigation must not animate several nested, full-height subtrees.
  const requested = new WeakSet();
  root.addEventListener('click', event => {
    const summary = event.target.closest?.('summary');
    if (summary?.parentElement?.tagName === 'DETAILS') requested.add(summary.parentElement);
  });
  root.addEventListener('toggle', event => {
    const details = event.target;
    if (!requested.has(details)) return;
    requested.delete(details);
    if (details.tagName !== 'DETAILS' || !details.open || reducedMotion()) return;
    for (const child of details.children) if (child.tagName !== 'SUMMARY') revealContent(child, {distance: -3, duration: 180});
  }, true);
}
