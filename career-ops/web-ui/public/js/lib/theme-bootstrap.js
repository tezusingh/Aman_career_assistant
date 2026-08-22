/* global window */
/**
 * Theme bootstrap — sets data-theme on <html> BEFORE the rest of the SPA
 * loads, so the user never sees a flash of the wrong colour scheme.
 *
 * Priority order:
 *   1. localStorage.theme  ('light' | 'dark')      — user explicit choice
 *   2. (default)           leave undecided           — CSS @media query
 *                                                     picks system pref
 *
 * Must be loaded synchronously in <head> BEFORE app.css so the
 * stylesheet sees the attribute already set.
 */
(function () {
  try {
    var saved = window.localStorage && window.localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (e) {
    // Ignore — localStorage may be disabled (private mode, file://, …).
    // The CSS @media (prefers-color-scheme: dark) fallback takes over.
  }
})();
