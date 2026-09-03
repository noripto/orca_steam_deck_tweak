/*
 * Minimal Property Inspector client for the standard Stream Deck PI protocol.
 * Avoids any external/CDN dependency so the PI works fully offline. Exposes a
 * small API on window.orcaPI used by each PI page.
 */

// These files are plain <script> includes, not modules, so the IIFE is the only
// scope boundary. Hoisting helpers out of it would put them on the global
// object, where the PI pages would collide (quick-prompt.html defines its own
// `el`, for one).
/* oxlint-disable unicorn/consistent-function-scoping */
(() => {
  let ws = null;
  let uuid = null;
  let actionUUID = null;
  let settings = {};
  let globalSettings = {};
  const readyListeners = [];
  const stateListeners = [];
  let isReady = false;

  const send = (obj) => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(obj));
    }
  };

  /** Fan a payload out to registered listeners (observer, not a callback). */
  const notify = (listeners, detail) => {
    for (const listener of listeners) {
      listener(detail);
    }
  };

  window.connectElgatoStreamDeckSocket = (
    inPort,
    inUUID,
    inRegisterEvent,
    _inInfo,
    inActionInfo
  ) => {
    uuid = inUUID;
    let actionInfo = {};
    try {
      actionInfo = JSON.parse(inActionInfo) || {};
    } catch {
      actionInfo = {};
    }
    actionUUID = actionInfo.action || null;
    settings = (actionInfo.payload && actionInfo.payload.settings) || {};

    ws = new WebSocket(`ws://127.0.0.1:${inPort}`);

    ws.addEventListener("open", () => {
      send({ event: inRegisterEvent, uuid: inUUID });
      send({ context: uuid, event: "getGlobalSettings" });
      // Ask the plugin for the current Orca state (connection + agents + worktrees).
      window.orcaPI.sendToPlugin({ event: "refresh" });
      isReady = true;
      notify(readyListeners, { actionUUID, settings });
    });

    ws.addEventListener("message", (evt) => {
      let msg = {};
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (msg.event === "didReceiveGlobalSettings") {
        globalSettings = (msg.payload && msg.payload.settings) || {};
        notify(stateListeners, { globalSettings, type: "global" });
      } else if (msg.event === "didReceiveSettings") {
        settings = (msg.payload && msg.payload.settings) || {};
        notify(stateListeners, { settings, type: "settings" });
      } else if (msg.event === "sendToPropertyInspector") {
        notify(stateListeners, { payload: msg.payload || {}, type: "state" });
      }
    });
  };

  window.orcaPI = {
    getGlobalSettings() {
      return globalSettings;
    },
    getSettings() {
      return settings;
    },
    onMessage(listener) {
      stateListeners.push(listener);
    },
    onReady(listener) {
      readyListeners.push(listener);
      if (isReady) {
        listener({ actionUUID, settings });
      }
    },
    sendToPlugin(payload) {
      send({
        action: actionUUID,
        context: uuid,
        event: "sendToPlugin",
        payload,
      });
    },
    setGlobal(key, value) {
      globalSettings = { ...globalSettings, [key]: value };
      send({
        context: uuid,
        event: "setGlobalSettings",
        payload: globalSettings,
      });
    },
    setSetting(key, value) {
      settings = { ...settings, [key]: value };
      send({ context: uuid, event: "setSettings", payload: settings });
    },
  };
})();
