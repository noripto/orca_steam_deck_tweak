/*
 * Minimal Property Inspector client for the standard Stream Deck PI protocol.
 * Avoids any external/CDN dependency so the PI works fully offline. Exposes a
 * small API on window.orcaPI used by each PI page.
 */
(function () {
  let ws = null;
  let uuid = null;
  let actionUUID = null;
  let settings = {};
  let globalSettings = {};
  const readyCbs = [];
  const stateCbs = [];
  let isReady = false;

  function send(obj) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  window.connectElgatoStreamDeckSocket = function (
    inPort,
    inUUID,
    inRegisterEvent,
    _inInfo,
    inActionInfo,
  ) {
    uuid = inUUID;
    let actionInfo = {};
    try {
      actionInfo = JSON.parse(inActionInfo) || {};
    } catch (e) {
      actionInfo = {};
    }
    actionUUID = actionInfo.action || null;
    settings = (actionInfo.payload && actionInfo.payload.settings) || {};

    ws = new WebSocket("ws://127.0.0.1:" + inPort);
    ws.onopen = function () {
      send({ event: inRegisterEvent, uuid: inUUID });
      send({ event: "getGlobalSettings", context: uuid });
      // Ask the plugin for the current Orca state (connection + agents + worktrees).
      window.orcaPI.sendToPlugin({ event: "refresh" });
      isReady = true;
      readyCbs.forEach(function (cb) {
        cb({ settings: settings, actionUUID: actionUUID });
      });
    };
    ws.onmessage = function (evt) {
      let msg = {};
      try {
        msg = JSON.parse(evt.data);
      } catch (e) {
        return;
      }
      if (msg.event === "didReceiveGlobalSettings") {
        globalSettings = (msg.payload && msg.payload.settings) || {};
        stateCbs.forEach(function (cb) {
          cb({ type: "global", globalSettings: globalSettings });
        });
      } else if (msg.event === "didReceiveSettings") {
        settings = (msg.payload && msg.payload.settings) || {};
        stateCbs.forEach(function (cb) {
          cb({ type: "settings", settings: settings });
        });
      } else if (msg.event === "sendToPropertyInspector") {
        stateCbs.forEach(function (cb) {
          cb({ type: "state", payload: msg.payload || {} });
        });
      }
    };
  };

  window.orcaPI = {
    onReady: function (cb) {
      readyCbs.push(cb);
      if (isReady) cb({ settings: settings, actionUUID: actionUUID });
    },
    onMessage: function (cb) {
      stateCbs.push(cb);
    },
    getSettings: function () {
      return settings;
    },
    getGlobalSettings: function () {
      return globalSettings;
    },
    setSetting: function (key, value) {
      settings = Object.assign({}, settings, keyed(key, value));
      send({ event: "setSettings", context: uuid, payload: settings });
    },
    setGlobal: function (key, value) {
      globalSettings = Object.assign({}, globalSettings, keyed(key, value));
      send({ event: "setGlobalSettings", context: uuid, payload: globalSettings });
    },
    sendToPlugin: function (payload) {
      send({ event: "sendToPlugin", action: actionUUID, context: uuid, payload: payload });
    },
  };

  function keyed(key, value) {
    const o = {};
    o[key] = value;
    return o;
  }
})();
