/* נקודת הכניסה: מתאם אחסון (localStorage, ואם חסום — זיכרון בלבד) והפעלת האפליקציה. */
(function () {
  "use strict";
  const { engine: E, App } = window.Sipur;

  function createStorage() {
    try {
      const probe = "__sipur_probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return { storage: window.localStorage, persistent: true };
    } catch (e) {
      return { storage: new E.MemoryStorage(), persistent: false };
    }
  }

  const { storage, persistent } = createStorage();
  const progress = new E.ProgressStore(storage);
  const app = new App({ progress, persistent });
  window.Sipur.app = app;
  app.start();
})();
