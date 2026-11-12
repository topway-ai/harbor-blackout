/* HARBOR BLACKOUT - bootstrap. */
(function (HB) {
  'use strict';
  function boot() {
    try {
      HB.game.init();
    } catch (e) {
      console.error('[HARBOR BLACKOUT] fatal startup error', e);
      try {
        HB.ui.localize();
        HB.ui.showError('ERROR_DETAIL_RUNTIME');
      } catch (e2) { /* The error screen is a best-effort fallback. */ }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.HB = window.HB || {});
