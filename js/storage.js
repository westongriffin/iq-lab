/* IQ Lab - localStorage persistence (profile, history, in-progress tests) */

const IQStore = (() => {
  const KEYS = {
    profile: "iqlab_profile",
    history: "iqlab_history",
    progress: (mode) => `iqlab_progress_${mode}`,
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  return {
    getProfile() {
      return read(KEYS.profile, null);
    },
    saveProfile(patch) {
      const cur = read(KEYS.profile, { created: Date.now() });
      write(KEYS.profile, { ...cur, ...patch });
    },
    getHistory() {
      return read(KEYS.history, []);
    },
    addResult(result) {
      const h = read(KEYS.history, []);
      h.unshift(result);
      write(KEYS.history, h.slice(0, 50));
    },
    deleteResult(id) {
      const h = read(KEYS.history, []).filter((r) => r.id !== id);
      write(KEYS.history, h);
    },
    getResult(id) {
      return read(KEYS.history, []).find((r) => r.id === id) || null;
    },
    latestResult() {
      const h = read(KEYS.history, []);
      return h.length ? h[0] : null;
    },
    getProgress(mode) {
      return read(KEYS.progress(mode), null);
    },
    saveProgress(mode, state) {
      write(KEYS.progress(mode), state);
    },
    clearProgress(mode) {
      try { localStorage.removeItem(KEYS.progress(mode)); } catch {}
    },
  };
})();
