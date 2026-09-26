/*
 * Light / dark theme for TriRepo. Loaded in <head> so the saved theme applies
 * before the page paints (no flash). Light is the default; a visitor's choice
 * is remembered in localStorage and shared by the landing page and the clinic.
 */
(function () {
  'use strict';
  var KEY = 'trirepo-theme';
  var root = document.documentElement;

  function saved() {
    try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function remember(theme) {
    try { window.localStorage.setItem(KEY, theme); } catch (e) { /* private mode: fine */ }
  }
  function isDark() {
    return root.getAttribute('data-theme') === 'dark';
  }
  function apply(theme) {
    if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
  }

  apply(saved());

  function label(button) {
    var dark = isDark();
    var text = dark ? 'Switch to light mode' : 'Switch to dark mode';
    button.setAttribute('aria-label', text);
    button.setAttribute('title', text);
    button.setAttribute('aria-pressed', dark ? 'true' : 'false');
  }

  function wire() {
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    Array.prototype.forEach.call(buttons, function (button) {
      label(button);
      button.addEventListener('click', function () {
        var next = isDark() ? 'light' : 'dark';
        apply(next);
        remember(next);
        Array.prototype.forEach.call(buttons, label);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
