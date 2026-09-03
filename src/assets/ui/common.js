/*
 * Shared PI helpers: connection banner, global CLI settings, and the live agent
 * / worktree readout. Pages call orcaCommon.init() after their own DOM is set up.
 */

// These files are plain <script> includes, not modules, so the IIFE is the only
// scope boundary. Hoisting helpers out of it would put them on the global
// object, where the PI pages would collide (quick-prompt.html defines its own
// `el`, for one).
/* oxlint-disable unicorn/consistent-function-scoping */
window.orcaCommon = (() => {
  let lastState = null;

  const el = (id) => document.querySelector(`#${id}`);

  const renderBanner = (connection, errorMessage) => {
    const b = el("banner");
    if (!b) {
      return;
    }
    b.className = `banner ${connection || "offline"}`;
    const text = {
      "cli-missing": "Orca CLI not found — set the path below",
      error: "Orca CLI error — see path below",
      offline: "Orca not running — start Orca",
      online: "Orca online",
    };
    let label = text[connection] || connection || "unknown";
    // The keys only have room for a word, so the reason is shown here.
    if (connection !== "online" && errorMessage) {
      label += ` (${errorMessage})`;
    }
    el("banner-text").textContent = label;
  };

  const renderLists = (payload) => {
    const agents = el("agent-list");
    if (agents) {
      agents.innerHTML = "";
      for (const a of payload.agents || []) {
        const d = document.createElement("div");
        d.textContent = `• ${a.agentType || "agent"} · ${a.label} [${a.state}]`;
        agents.append(d);
      }
      if (!(payload.agents || []).length) {
        agents.innerHTML = "<div>no agents</div>";
      }
    }
    const wts = el("worktree-list");
    if (wts) {
      wts.innerHTML = "";
      for (const w of payload.worktrees || []) {
        const d = document.createElement("div");
        d.textContent = `• ${w.repo} · ${w.branch}`;
        d.title = w.path;
        wts.append(d);
      }
      if (!(payload.worktrees || []).length) {
        wts.innerHTML = "<div>no worktrees</div>";
      }
    }
  };

  const fillSelect = (select, items, mapper, current) => {
    if (!select) {
      return;
    }
    const placeholder = select.querySelector('option[value=""]');
    select.innerHTML = "";
    if (placeholder) {
      select.append(placeholder);
    }
    for (const it of items) {
      const m = mapper(it);
      const o = document.createElement("option");
      o.value = m.value;
      o.textContent = m.label;
      if (m.value === current) {
        o.selected = true;
      }
      select.append(o);
    }
  };

  const wireGlobal = () => {
    const cli = el("cliPath");
    const poll = el("pollSeconds");
    if (cli) {
      cli.addEventListener("change", () => {
        window.orcaPI.setGlobal("cliPath", cli.value.trim() || "auto");
        window.orcaPI.sendToPlugin({ event: "refresh" });
      });
    }
    if (poll) {
      poll.addEventListener("change", () => {
        const n = Math.min(10, Math.max(2, Number(poll.value) || 3));
        poll.value = String(n);
        window.orcaPI.setGlobal("pollSeconds", n);
      });
    }
  };

  const applyGlobal = (g) => {
    const cli = el("cliPath");
    const poll = el("pollSeconds");
    if (cli && typeof g.cliPath === "string") {
      cli.value = g.cliPath;
    }
    if (
      poll &&
      (typeof g.pollSeconds === "number" || typeof g.pollSeconds === "string")
    ) {
      poll.value = String(g.pollSeconds);
    }
  };

  const init = (onState) => {
    wireGlobal();
    window.orcaPI.onMessage((m) => {
      if (m.type === "global") {
        applyGlobal(m.globalSettings || {});
        if ((m.globalSettings || {}).cliPath === undefined) {
          // Seed defaults so the fields aren't blank on first open.
          applyGlobal({ cliPath: "auto", pollSeconds: 3 });
        }
      } else if (m.type === "state") {
        lastState = m.payload;
        renderBanner(m.payload.connection, m.payload.errorMessage);
        renderLists(m.payload);
        if (onState) {
          onState(m.payload);
        }
      }
    });
    const refresh = el("refresh");
    if (refresh) {
      refresh.addEventListener("click", () => {
        window.orcaPI.sendToPlugin({ event: "refresh" });
      });
    }
  };

  return {
    el,
    fillSelect,
    getLastState() {
      return lastState;
    },
    init,
  };
})();
