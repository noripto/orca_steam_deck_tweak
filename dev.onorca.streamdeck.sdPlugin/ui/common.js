/*
 * Shared PI helpers: connection banner, global CLI settings, and the live agent
 * / worktree readout. Pages call orcaCommon.init() after their own DOM is set up.
 */
window.orcaCommon = (function () {
  let lastState = null;

  function el(id) {
    return document.getElementById(id);
  }

  function renderBanner(connection) {
    const b = el("banner");
    if (!b) return;
    b.className = "banner " + (connection || "offline");
    const text = {
      online: "Orca online",
      offline: "Orca not running — start Orca",
      "cli-missing": "Orca CLI not found — set the path below",
      error: "Orca CLI error — see path below"
    };
    el("banner-text").textContent = text[connection] || connection || "unknown";
  }

  function renderLists(payload) {
    const agents = el("agent-list");
    if (agents) {
      agents.innerHTML = "";
      (payload.agents || []).forEach(function (a) {
        const d = document.createElement("div");
        d.textContent = "• " + (a.agentType || "agent") + " · " + a.label + " [" + a.state + "]";
        agents.appendChild(d);
      });
      if (!(payload.agents || []).length) agents.innerHTML = "<div>no agents</div>";
    }
    const wts = el("worktree-list");
    if (wts) {
      wts.innerHTML = "";
      (payload.worktrees || []).forEach(function (w) {
        const d = document.createElement("div");
        d.textContent = "• " + w.repo + " · " + w.branch;
        d.title = w.path;
        wts.appendChild(d);
      });
      if (!(payload.worktrees || []).length) wts.innerHTML = "<div>no worktrees</div>";
    }
  }

  function fillSelect(select, items, mapper, current) {
    if (!select) return;
    const placeholder = select.querySelector('option[value=""]');
    select.innerHTML = "";
    if (placeholder) select.appendChild(placeholder);
    items.forEach(function (it) {
      const m = mapper(it);
      const o = document.createElement("option");
      o.value = m.value;
      o.textContent = m.label;
      if (m.value === current) o.selected = true;
      select.appendChild(o);
    });
  }

  function wireGlobal() {
    const cli = el("cliPath");
    const poll = el("pollSeconds");
    if (cli) {
      cli.addEventListener("change", function () {
        window.orcaPI.setGlobal("cliPath", cli.value.trim() || "auto");
        window.orcaPI.sendToPlugin({ event: "refresh" });
      });
    }
    if (poll) {
      poll.addEventListener("change", function () {
        const n = Math.min(10, Math.max(2, Number(poll.value) || 3));
        poll.value = String(n);
        window.orcaPI.setGlobal("pollSeconds", n);
      });
    }
  }

  function applyGlobal(g) {
    const cli = el("cliPath");
    const poll = el("pollSeconds");
    if (cli && typeof g.cliPath === "string") cli.value = g.cliPath;
    if (poll && (typeof g.pollSeconds === "number" || typeof g.pollSeconds === "string"))
      poll.value = String(g.pollSeconds);
  }

  function init(onState) {
    wireGlobal();
    window.orcaPI.onMessage(function (m) {
      if (m.type === "global") {
        applyGlobal(m.globalSettings || {});
        if (typeof (m.globalSettings || {}).cliPath === "undefined") {
          // Seed defaults so the fields aren't blank on first open.
          applyGlobal({ cliPath: "auto", pollSeconds: 3 });
        }
      } else if (m.type === "state") {
        lastState = m.payload;
        renderBanner(m.payload.connection);
        renderLists(m.payload);
        if (onState) onState(m.payload);
      }
    });
    const refresh = el("refresh");
    if (refresh) refresh.addEventListener("click", function () {
      window.orcaPI.sendToPlugin({ event: "refresh" });
    });
  }

  return { init: init, fillSelect: fillSelect, el: el, getLastState: function () { return lastState; } };
})();
