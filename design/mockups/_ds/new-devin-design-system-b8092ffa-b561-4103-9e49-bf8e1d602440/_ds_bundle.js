/* @ds-bundle: {"format":3,"namespace":"NewDevinDesignSystem_b8092f","components":[],"sourceHashes":{"ui_kits/desktop/desktop-app.jsx":"10aad9efa33f","ui_kits/desktop/desktop-chrome.jsx":"9dc65e70ea6d","ui_kits/desktop/desktop-kanban.jsx":"94c2bec6b9ed","ui_kits/desktop/desktop-primitives.jsx":"25b644871358","ui_kits/desktop/desktop-views.jsx":"71ef900a04bb","ui_kits/marketing/marketing-app.jsx":"a78daa0d77c8","ui_kits/marketing/marketing-components.jsx":"7276397d2321","ui_kits/marketing/marketing-pricing.jsx":"ba663f45f9a7","ui_kits/marketing/marketing-sections.jsx":"16a14a13cbd2","ui_kits/marketing/marketing-visuals.jsx":"fcf8c5cf39de"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.NewDevinDesignSystem_b8092f = window.NewDevinDesignSystem_b8092f || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/desktop/desktop-app.jsx
try { (() => {
// Devin Desktop — app shell wiring it all together
const {
  useState: useSA
} = React;
function DesktopApp() {
  const [view, setView] = useSA("Home"); // Home | Agents
  const [agentsOpen, setAgentsOpen] = useSA(false); // right session panel
  const [activity, setActivity] = useSA("files");
  const [model, setModel] = useSA("SWE-1.6 Fast");
  const [draft, setDraft] = useSA(""); // center composer draft
  const [panelDraft, setPanelDraft] = useSA(""); // side composer draft
  const [messages, setMessages] = useSA([]);
  function runTask(text) {
    if (!text || !text.trim()) return;
    const user = {
      role: "user",
      text: text.trim()
    };
    setMessages(m => [...m, user]);
    setAgentsOpen(true);
    setTimeout(() => {
      setMessages(m => [...m, {
        role: "devin",
        text: "On it. I'll scope the work, make the changes, and open a PR for review.",
        steps: ["Explored 18 files across the repo", "Drafted a plan", "Editing app/page.tsx"]
      }]);
    }, 650);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      background: "var(--surface-app)",
      borderRadius: "var(--r-xl)",
      overflow: "hidden",
      border: "1px solid var(--border)",
      boxShadow: "var(--shadow-lg)",
      fontFamily: "var(--font-ui)"
    }
  }, /*#__PURE__*/React.createElement(Topbar, {
    repo: "lumen-desk",
    agentsOpen: agentsOpen,
    onToggleAgents: () => setAgentsOpen(v => !v)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement(ActivityBar, {
    active: activity,
    onSelect: k => {
      setActivity(k);
      if (k === "map") setView("Agents");
      if (k === "files") setView("Home");
    }
  }), /*#__PURE__*/React.createElement(Explorer, null), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 44,
      flex: "none",
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "0 12px",
      borderBottom: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement(SegmentedControl, {
    options: ["Home", "Agents"],
    value: view,
    onChange: setView
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), view === "Agents" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    leftIcon: "sliders-horizontal"
  }, "Display"), /*#__PURE__*/React.createElement(IconButton, {
    name: "list-filter",
    color: "var(--fg-2)"
  }))), view === "Home" ? /*#__PURE__*/React.createElement(HomeCanvas, {
    model: model,
    onModel: setModel,
    draft: draft,
    setDraft: setDraft,
    onSend: () => {
      runTask(draft);
      setDraft("");
    },
    onSuggest: s => runTask(s)
  }) : /*#__PURE__*/React.createElement(KanbanBoard, null)), agentsOpen && /*#__PURE__*/React.createElement(SessionPanel, {
    onClose: () => setAgentsOpen(false),
    messages: messages,
    model: model,
    onModel: setModel,
    draft: panelDraft,
    setDraft: setPanelDraft,
    onSend: () => {
      runTask(panelDraft);
      setPanelDraft("");
    }
  })), /*#__PURE__*/React.createElement(StatusBar, null));
}
Object.assign(window, {
  DesktopApp
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop/desktop-app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/desktop/desktop-chrome.jsx
try { (() => {
// Devin Desktop — window chrome: TrafficLights, Topbar, ActivityBar, Explorer, StatusBar
const {
  useState: useStateC
} = React;
function TrafficLights() {
  const dot = c => ({
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: c
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: dot("#ff5f57")
  }), /*#__PURE__*/React.createElement("span", {
    style: dot("#febc2e")
  }), /*#__PURE__*/React.createElement("span", {
    style: dot("#28c840")
  }));
}

/* Top bar — traffic lights, view toggles, centered command bar, right utilities */
function Topbar({
  repo = "lumen-desk",
  onToggleAgents,
  agentsOpen
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 44,
      flex: "none",
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "0 12px",
      borderBottom: "1px solid var(--border)",
      background: "var(--surface-app)"
    }
  }, /*#__PURE__*/React.createElement(TrafficLights, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 1,
      marginLeft: 6
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    name: "panel-left",
    iconSize: 17,
    color: "var(--fg-2)"
  }), /*#__PURE__*/React.createElement(IconButton, {
    name: "square-pen",
    iconSize: 17,
    color: "var(--fg-2)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 18,
      background: "var(--border)",
      margin: "0 4px"
    }
  }), /*#__PURE__*/React.createElement(IconButton, {
    name: "search",
    iconSize: 17,
    color: "var(--fg-2)"
  }), /*#__PURE__*/React.createElement(IconButton, {
    name: "panel-right",
    iconSize: 17,
    color: "var(--fg-2)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      width: 460,
      maxWidth: "46vw",
      height: 28,
      padding: "0 10px",
      borderRadius: "var(--r-md)",
      border: "1px solid var(--border)",
      background: "#fff",
      color: "var(--fg-2)",
      font: "var(--ui-rg)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 14,
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fg-2)"
    }
  }, repo), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("kbd", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--fg-3)"
    }
  }, "\u2318P"))), /*#__PURE__*/React.createElement("img", {
    src: "../../assets/devin-mark.svg",
    alt: "",
    style: {
      height: 17,
      opacity: .9
    }
  }), /*#__PURE__*/React.createElement(IconButton, {
    name: "bug",
    iconSize: 17,
    color: "var(--fg-2)"
  }), /*#__PURE__*/React.createElement(IconButton, {
    name: "panel-bottom",
    iconSize: 17,
    color: "var(--fg-2)"
  }), /*#__PURE__*/React.createElement(IconButton, {
    name: "panel-right",
    iconSize: 17,
    color: agentsOpen ? "var(--ink)" : "var(--fg-2)",
    onClick: onToggleAgents,
    active: agentsOpen
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 2,
      marginLeft: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 24,
      height: 24,
      borderRadius: "50%",
      background: "var(--green)",
      color: "#fff",
      display: "grid",
      placeItems: "center",
      font: "var(--ui)",
      fontSize: 11
    }
  }, "ND"), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 14,
    color: "var(--fg-2)"
  })));
}

/* Left activity rail */
const RAIL = [{
  name: "files",
  key: "files"
}, {
  name: "search",
  key: "search"
}, {
  name: "git-branch",
  key: "scm",
  badge: 4
}, {
  name: "map",
  key: "map",
  badge: 1
}, {
  name: "sparkles",
  key: "ai"
}, {
  name: "bug",
  key: "debug"
}, {
  name: "box",
  key: "ext"
}, {
  name: "play",
  key: "run"
}, {
  name: "activity",
  key: "activity"
}];
function ActivityBar({
  active = "files",
  onSelect
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      flex: "none",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      padding: "8px 0",
      borderRight: "1px solid var(--border)",
      background: "var(--surface-app)"
    }
  }, RAIL.map(r => {
    const on = r.key === active;
    return /*#__PURE__*/React.createElement("button", {
      key: r.key,
      onClick: () => onSelect && onSelect(r.key),
      title: r.key,
      style: {
        position: "relative",
        width: 36,
        height: 36,
        border: 0,
        cursor: "pointer",
        borderRadius: "var(--r-sm)",
        background: on ? "rgba(0,0,0,0.06)" : "transparent",
        display: "grid",
        placeItems: "center"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: r.name,
      size: 20,
      color: on ? "var(--ink)" : "var(--fg-2)"
    }), r.badge && /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        top: 2,
        right: 2,
        minWidth: 14,
        height: 14,
        padding: "0 3px",
        borderRadius: 7,
        background: "var(--blue)",
        color: "#fff",
        fontSize: 9,
        fontWeight: 600,
        fontFamily: "var(--font-ui)",
        display: "grid",
        placeItems: "center"
      }
    }, r.badge));
  }));
}

/* Explorer file tree */
const TREE = [{
  t: "folder",
  name: ".devin"
}, {
  t: "folder",
  name: ".next"
}, {
  t: "folder",
  name: "app",
  tint: "var(--blue)",
  dot: "var(--blue)"
}, {
  t: "folder",
  name: "components"
}, {
  t: "folder",
  name: "lib",
  tint: "var(--green)",
  dot: "var(--green)"
}, {
  t: "folder",
  name: "node_modules",
  muted: true
}, {
  t: "folder",
  name: "prisma",
  dot: "var(--orange)"
}, {
  t: "folder",
  name: "server",
  dot: "var(--red)"
}, {
  t: "folder",
  name: "tests",
  tint: "var(--green)",
  dot: "var(--green)"
}, {
  t: "file",
  name: ".env",
  icon: "settings"
}, {
  t: "file",
  name: ".env.example",
  icon: "file"
}, {
  t: "file",
  name: ".gitignore",
  icon: "file",
  c: "var(--orange)"
}, {
  t: "file",
  name: "next.config.ts",
  icon: "file-code",
  c: "var(--blue)"
}, {
  t: "file",
  name: "package.json",
  icon: "braces",
  c: "var(--orange)"
}, {
  t: "file",
  name: "package-lock.json",
  icon: "braces",
  c: "var(--blue)",
  flag: "M"
}, {
  t: "file",
  name: "playwright.config.ts",
  icon: "file-code",
  c: "var(--green)"
}, {
  t: "file",
  name: "README.md",
  icon: "file-text",
  c: "var(--blue)"
}, {
  t: "file",
  name: "tailwind.config.ts",
  icon: "wind",
  c: "#38bdf8"
}];
function Explorer() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 240,
      flex: "none",
      display: "flex",
      flexDirection: "column",
      borderRight: "1px solid var(--border)",
      background: "var(--surface-app)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 38,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 8px 0 16px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--ui)",
      textTransform: "uppercase",
      fontSize: 11,
      letterSpacing: ".04em",
      color: "var(--fg-2)"
    }
  }, "Explorer"), /*#__PURE__*/React.createElement(IconButton, {
    name: "more-horizontal",
    size: 24,
    iconSize: 15,
    color: "var(--fg-2)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: "auto",
      paddingBottom: 8
    }
  }, /*#__PURE__*/React.createElement(Row, {
    depth: 0,
    chevron: true,
    open: true,
    icon: "chevron-down",
    label: "lumen-desk",
    bold: true
  }), TREE.map((n, i) => n.t === "folder" ? /*#__PURE__*/React.createElement(Row, {
    key: i,
    depth: 1,
    chevron: true,
    icon: "chevron-right",
    folder: true,
    dot: n.dot,
    label: n.name,
    muted: n.muted,
    tint: n.tint
  }) : /*#__PURE__*/React.createElement(Row, {
    key: i,
    depth: 1,
    icon: n.icon,
    iconColor: n.c,
    label: n.name,
    flag: n.flag
  })), /*#__PURE__*/React.createElement(Row, {
    depth: 0,
    chevron: true,
    icon: "chevron-right",
    label: "Outline",
    caps: true
  }), /*#__PURE__*/React.createElement(Row, {
    depth: 0,
    chevron: true,
    icon: "chevron-right",
    label: "Timeline",
    caps: true
  })));
}
function Row({
  depth,
  chevron,
  icon,
  folder,
  label,
  bold,
  muted,
  tint,
  dot,
  iconColor,
  flag,
  caps,
  open
}) {
  const [h, setH] = useStateC(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      height: 24,
      cursor: "pointer",
      padding: `0 8px 0 ${8 + depth * 14}px`,
      background: h ? "rgba(0,0,0,0.04)" : "transparent",
      font: "var(--ui-rg)",
      color: muted ? "var(--fg-3)" : "var(--ink)",
      fontWeight: bold ? 600 : 400,
      textTransform: caps ? "uppercase" : "none",
      fontSize: caps ? 11 : 13,
      letterSpacing: caps ? ".04em" : 0
    }
  }, chevron && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 14,
    color: "var(--fg-3)"
  }), !chevron && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 14,
    color: iconColor || "var(--fg-2)"
  }), folder && /*#__PURE__*/React.createElement(Icon, {
    name: "folder",
    size: 14,
    color: tint || "var(--fg-2)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: tint || (caps ? "var(--fg-2)" : undefined),
      flex: 1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, label), flag && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--blue)",
      fontWeight: 600,
      fontSize: 12
    }
  }, flag), dot && !flag && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: dot
    }
  }));
}

/* Bottom status bar */
function StatusBar() {
  const item = (children, opts = {}) => /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      height: 22,
      padding: "0 7px",
      borderRadius: 4,
      font: "var(--ui-sm)",
      color: "var(--fg-2)",
      ...opts
    }
  }, children);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 24,
      flex: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 6px",
      background: "var(--surface-2)",
      borderTop: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 1
    }
  }, item(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 13
  }), " main*")), item(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icon, {
    name: "circle-x",
    size: 13
  }), " 0")), item(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icon, {
    name: "triangle-alert",
    size: 13
  }), " 0")), item(/*#__PURE__*/React.createElement(React.Fragment, null, "(Renderer) Mem: 447 MB, CPU: 2%"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 1
    }
  }, item(/*#__PURE__*/React.createElement(React.Fragment, null, "Ln 231, Col 29")), item(/*#__PURE__*/React.createElement(React.Fragment, null, "Spaces: 2")), item(/*#__PURE__*/React.createElement(React.Fragment, null, "UTF-8")), item(/*#__PURE__*/React.createElement(React.Fragment, null, "{ }", " TypeScript JSX")), item(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), " Prettier")), item(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 13
  })))));
}
Object.assign(window, {
  TrafficLights,
  Topbar,
  ActivityBar,
  Explorer,
  StatusBar
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop/desktop-chrome.jsx", error: String((e && e.message) || e) }); }

// ui_kits/desktop/desktop-kanban.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Devin Desktop — Kanban board (Agent Command Center)
const {
  useState: useSK
} = React;
function KanbanColumn({
  state,
  title,
  count,
  cards
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "0 0 256px",
      minWidth: 0,
      borderRadius: "var(--r-lg)",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      padding: 8,
      background: "rgba(0,0,0,0.015)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "0 6px",
      height: 28
    }
  }, /*#__PURE__*/React.createElement(StatusGlyph, {
    state: state,
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--ui)"
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--ui)",
      color: "var(--fg-2)"
    }
  }, count), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(IconButton, {
    name: "plus",
    size: 24,
    iconSize: 15,
    color: "var(--fg-2)"
  })), cards.map((c, i) => /*#__PURE__*/React.createElement(KSessionCard, _extends({
    key: i
  }, c))));
}
function KSessionCard({
  space,
  title,
  meta,
  status,
  pill
}) {
  const [h, setH] = useSK(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      background: "#fff",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: "var(--r-sm)",
      padding: "10px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      cursor: "pointer",
      boxShadow: h ? "var(--shadow-sm)" : "var(--shadow-xs)",
      transition: "box-shadow .12s"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, space && /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--ui-sm)",
      color: "var(--fg-2)"
    }
  }, space), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--ui)",
      marginTop: 2
    }
  }, title)), status && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "none",
      marginTop: 1
    }
  }, /*#__PURE__*/React.createElement(StatusGlyph, {
    state: status,
    size: 16
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, pill && /*#__PURE__*/React.createElement(Pill, {
    tone: pill.tone
  }, pill.label), meta && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      font: "var(--ui-sm)",
      color: "var(--fg-2)",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 13,
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, meta))));
}
const BOARD = {
  Running: {
    state: "running",
    count: 4,
    cards: [{
      space: "cognition-ds",
      title: "feat: Add Figma Code Connect for design system components",
      meta: "Editing page.tsx, route.ts, and 2 more",
      status: "running"
    }, {
      space: "Unicode normalization",
      title: "Improve Unicode normalization",
      meta: "Running tests · 41 repos",
      status: "running"
    }, {
      space: "Auth",
      title: "Migrate session store to Redis",
      meta: "Editing server/session.ts",
      status: "running"
    }, {
      space: "Billing",
      title: "Add usage-based metering hooks",
      meta: "Reading prisma/schema.prisma",
      status: "running"
    }]
  },
  "Waiting for review": {
    state: "ready",
    count: 2,
    cards: [{
      space: "Review routes",
      title: "Better URL parsing for review routes",
      pill: {
        tone: "ready",
        label: "PR is ready"
      },
      status: "ready"
    }, {
      title: "Set up rate limiting on the public API",
      pill: {
        tone: "review",
        label: "Waiting for review"
      },
      status: "review"
    }]
  },
  Done: {
    state: "done",
    count: 6,
    cards: [{
      title: "Scaffold initial module application UI",
      pill: {
        tone: "merged",
        label: "Merged"
      },
      status: "done"
    }, {
      space: "Review module",
      title: "Set up Review module in webapp",
      pill: {
        tone: "merged",
        label: "Merged"
      },
      status: "done"
    }, {
      title: "Fix flaky Playwright e2e on CI",
      pill: {
        tone: "merged",
        label: "Merged"
      },
      status: "done"
    }]
  }
};
function KanbanBoard() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      gap: 6,
      padding: 8,
      overflow: "auto",
      background: "var(--surface-app)"
    }
  }, Object.entries(BOARD).map(([title, col]) => /*#__PURE__*/React.createElement(KanbanColumn, {
    key: title,
    title: title,
    state: col.state,
    count: col.count,
    cards: col.cards
  })));
}
Object.assign(window, {
  KanbanBoard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop/desktop-kanban.jsx", error: String((e && e.message) || e) }); }

// ui_kits/desktop/desktop-primitives.jsx
try { (() => {
// Devin Desktop — primitives: Icon, Button, IconButton, SegmentedControl, Pill, StatusGlyph
// Loaded as a Babel script. Exports to window for the other kit files.
const {
  useState,
  useEffect,
  useRef,
  useCallback
} = React;

/* Lucide icon — renders an <i data-lucide> then hydrates it to an <svg>. */
function Icon({
  name,
  size = 16,
  color,
  strokeWidth = 1.6,
  style
}) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = "";
      const el = document.createElement("i");
      el.setAttribute("data-lucide", name);
      ref.current.appendChild(el);
      window.lucide.createIcons({
        attrs: {
          width: size,
          height: size,
          "stroke-width": strokeWidth
        },
        nameAttr: "data-lucide"
      });
    }
  }, [name, size, strokeWidth]);
  return /*#__PURE__*/React.createElement("span", {
    ref: ref,
    style: {
      display: "inline-flex",
      width: size,
      height: size,
      color: color || "currentColor",
      ...style
    }
  });
}

/* Buttons — ghost / secondary / primary, sizes sm(24)/md(28) */
function Button({
  variant = "ghost",
  size = "md",
  children,
  leftIcon,
  onClick,
  style,
  active
}) {
  const [hover, setHover] = useState(false);
  const h = size === "sm" ? 24 : 28;
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: h,
    padding: leftIcon && !children ? 0 : "0 12px",
    width: leftIcon && !children ? h : undefined,
    justifyContent: "center",
    font: "var(--ui)",
    borderRadius: "var(--r-sm)",
    border: "1px solid transparent",
    background: "none",
    color: "var(--ink)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    userSelect: "none",
    transition: "background .12s ease, box-shadow .12s ease"
  };
  const variants = {
    ghost: {
      background: hover || active ? "rgba(0,0,0,0.06)" : "none"
    },
    secondary: {
      background: hover ? "var(--surface-2)" : "#fff",
      borderColor: "var(--border)",
      boxShadow: "var(--shadow-xs)"
    },
    primary: {
      background: hover ? "#000" : "var(--ink)",
      color: "#fff"
    }
  };
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      ...base,
      ...variants[variant],
      ...style
    }
  }, leftIcon && /*#__PURE__*/React.createElement(Icon, {
    name: leftIcon,
    size: 16
  }), children);
}
function IconButton({
  name,
  size = 28,
  iconSize = 16,
  color,
  onClick,
  active,
  title,
  style
}) {
  return /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    leftIcon: undefined,
    active: active,
    onClick: onClick,
    style: {
      width: size,
      height: size,
      padding: 0,
      ...style
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: name,
    size: iconSize,
    color: color
  }));
}

/* Segmented control — track + sliding buttons */
function SegmentedControl({
  options,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      gap: 2,
      padding: 2,
      background: "rgba(0,0,0,0.06)",
      borderRadius: "var(--r-md)"
    }
  }, options.map(o => {
    const on = o === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o,
      onClick: () => onChange(o),
      style: {
        font: "var(--ui)",
        height: 24,
        padding: "0 12px",
        border: 0,
        cursor: "pointer",
        borderRadius: "var(--r-sm)",
        color: on ? "var(--ink)" : "var(--fg-2)",
        background: on ? "#fff" : "transparent",
        boxShadow: on ? "var(--shadow-xs)" : "none",
        borderWidth: on ? 1 : 0,
        borderStyle: "solid",
        borderColor: "rgba(0,0,0,0.08)"
      }
    }, o);
  }));
}

/* Pill — colored status chip */
const PILL = {
  running: {
    bg: "rgba(245,142,58,0.14)",
    fg: "#c9690f"
  },
  review: {
    bg: "rgba(49,124,255,0.12)",
    fg: "#2d6ae0"
  },
  ready: {
    bg: "rgba(0,165,88,0.12)",
    fg: "#00813f"
  },
  conflict: {
    bg: "rgba(245,59,58,0.12)",
    fg: "#d12c2b"
  },
  merged: {
    bg: "rgba(25,25,25,0.06)",
    fg: "var(--fg-2)"
  }
};
function Pill({
  tone = "ready",
  children
}) {
  const c = PILL[tone] || PILL.ready;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      height: 18,
      padding: "0 7px",
      borderRadius: "var(--r-full)",
      fontFamily: "var(--font-ui)",
      fontSize: 11,
      fontWeight: 500,
      background: c.bg,
      color: c.fg
    }
  }, children);
}

/* Status glyph — icon that maps a session state to a colored lucide icon */
const GLYPH = {
  running: {
    name: "loader",
    color: "var(--orange)"
  },
  review: {
    name: "circle-dot",
    color: "var(--blue)"
  },
  ready: {
    name: "check-circle-2",
    color: "var(--green)"
  },
  done: {
    name: "git-merge",
    color: "var(--green)"
  },
  conflict: {
    name: "alert-triangle",
    color: "var(--red)"
  },
  idle: {
    name: "circle",
    color: "var(--fg-3)"
  }
};
function StatusGlyph({
  state = "idle",
  size = 16
}) {
  const g = GLYPH[state] || GLYPH.idle;
  return /*#__PURE__*/React.createElement(Icon, {
    name: g.name,
    size: size,
    color: g.color
  });
}
Object.assign(window, {
  Icon,
  Button,
  IconButton,
  SegmentedControl,
  Pill,
  StatusGlyph
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop/desktop-primitives.jsx", error: String((e && e.message) || e) }); }

// ui_kits/desktop/desktop-views.jsx
try { (() => {
// Devin Desktop — views: Composer, ModelPicker, SessionPanel, HomeCanvas
const {
  useState: useS,
  useRef: useR,
  useEffect: useE
} = React;
const MODELS = [{
  name: "SWE-1.6 Fast",
  note: "Fastest · local",
  icon: "zap"
}, {
  name: "SWE-1.6",
  note: "Most capable agent model",
  icon: "sparkles"
}, {
  name: "Claude Sonnet 4.5",
  note: "Anthropic",
  icon: "circle"
}, {
  name: "GPT-5",
  note: "OpenAI",
  icon: "circle"
}, {
  name: "Gemini 2.5 Pro",
  note: "Google",
  icon: "circle"
}];

/* Model picker popover */
function ModelPicker({
  value,
  onPick,
  onClose
}) {
  const ref = useR(null);
  useE(() => {
    const fn = e => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      position: "absolute",
      bottom: "calc(100% + 8px)",
      left: 0,
      width: 300,
      background: "#fff",
      borderRadius: "var(--r-md)",
      border: "1px solid var(--border)",
      boxShadow: "var(--shadow-pop)",
      padding: 6,
      zIndex: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: 32,
      padding: "0 8px",
      margin: "2px 0 6px",
      borderRadius: "var(--r-sm)",
      background: "var(--surface-2)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 14,
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("input", {
    placeholder: "Search models",
    style: {
      flex: 1,
      border: 0,
      outline: 0,
      background: "none",
      font: "var(--ui-rg)",
      color: "var(--ink)"
    }
  })), MODELS.map(m => {
    const on = m.name === value;
    return /*#__PURE__*/React.createElement(MenuItem, {
      key: m.name,
      title: m.name,
      note: m.note,
      icon: m.icon,
      checked: on,
      onClick: () => {
        onPick(m.name);
        onClose();
      }
    });
  }));
}
function MenuItem({
  title,
  note,
  icon,
  checked,
  onClick
}) {
  const [h, setH] = useS(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      minHeight: 40,
      padding: "6px 8px",
      cursor: "pointer",
      borderRadius: "var(--r-sm)",
      background: h ? "rgba(0,0,0,0.05)" : "transparent"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      display: "grid",
      placeItems: "center"
    }
  }, checked ? /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16,
    color: "var(--blue)"
  }) : null), /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 16,
    color: "var(--fg-2)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      lineHeight: 1.2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--ui)"
    }
  }, title), note && /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--ui-sm)",
      color: "var(--fg-2)"
    }
  }, note)));
}

/* Composer — placeholder, model chips, send. compact variant for the side panel. */
function Composer({
  compact,
  model,
  onModel,
  value,
  onChange,
  onSend,
  placeholder = "Ask anything (⌘L)"
}) {
  const [picker, setPicker] = useS(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      background: "#fff",
      border: "1px solid var(--border)",
      borderRadius: "var(--r-xl)",
      boxShadow: "var(--shadow-sm)",
      padding: compact ? "12px 12px 10px" : "16px 16px 12px",
      display: "flex",
      flexDirection: "column",
      gap: compact ? 12 : 16
    }
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: 1,
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
    },
    style: {
      border: 0,
      outline: 0,
      resize: "none",
      background: "none",
      width: "100%",
      font: "var(--body)",
      fontSize: compact ? 15 : 16,
      color: "var(--ink)",
      fontFamily: "var(--font-ui)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      width: 30,
      height: 30,
      flex: "none",
      borderRadius: "var(--r-md)",
      border: "1px solid var(--border)",
      background: "#fff",
      display: "grid",
      placeItems: "center",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 16,
    color: "var(--fg-1)"
  })), !compact && /*#__PURE__*/React.createElement(Chip, null, /*#__PURE__*/React.createElement(Icon, {
    name: "code-xml",
    size: 15,
    color: "var(--fg-2)"
  }), "Code"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(Chip, {
    onClick: () => setPicker(v => !v),
    active: picker
  }, model, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 13,
    color: "var(--fg-3)"
  })), picker && /*#__PURE__*/React.createElement(ModelPicker, {
    value: model,
    onPick: onModel,
    onClose: () => setPicker(false)
  })), /*#__PURE__*/React.createElement(Chip, null, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/devin-mark.svg",
    alt: "",
    style: {
      width: 15,
      height: 15
    }
  }), "Devin Local"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    style: {
      width: 30,
      height: 30,
      display: "grid",
      placeItems: "center",
      border: 0,
      background: "none",
      color: "var(--fg-2)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mic",
    size: 17
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onSend,
    style: {
      width: 30,
      height: 30,
      borderRadius: "50%",
      border: 0,
      background: value && value.trim() ? "var(--ink)" : "rgba(25,25,25,0.4)",
      display: "grid",
      placeItems: "center",
      cursor: "pointer",
      transition: "background .15s"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-up",
    size: 16,
    color: "#fff"
  }))));
}
function Chip({
  children,
  onClick,
  active
}) {
  const [h, setH] = useS(false);
  return /*#__PURE__*/React.createElement("span", {
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 30,
      padding: "0 10px",
      borderRadius: "var(--r-md)",
      font: "var(--ui)",
      color: "var(--ink)",
      cursor: onClick ? "pointer" : "default",
      background: h || active ? "rgba(0,0,0,0.05)" : "transparent",
      whiteSpace: "nowrap",
      flex: "none"
    }
  }, children);
}

/* Right session panel — Devin Local Session */
function SessionPanel({
  onClose,
  messages,
  model,
  onModel,
  draft,
  setDraft,
  onSend
}) {
  const hasChat = messages && messages.length > 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 360,
      flex: "none",
      display: "flex",
      flexDirection: "column",
      borderLeft: "1px solid var(--border)",
      background: "var(--surface-app)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 44,
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "0 8px 0 16px",
      borderBottom: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--ui)",
      flex: 1
    }
  }, "Devin Local Session"), /*#__PURE__*/React.createElement(IconButton, {
    name: "plus",
    size: 26,
    iconSize: 16,
    color: "var(--fg-2)"
  }), /*#__PURE__*/React.createElement(IconButton, {
    name: "history",
    size: 26,
    iconSize: 16,
    color: "var(--fg-2)"
  }), /*#__PURE__*/React.createElement(IconButton, {
    name: "more-horizontal",
    size: 26,
    iconSize: 16,
    color: "var(--fg-2)"
  }), /*#__PURE__*/React.createElement(IconButton, {
    name: "x",
    size: 26,
    iconSize: 16,
    color: "var(--fg-2)",
    onClick: onClose
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: "auto",
      display: "flex",
      flexDirection: "column",
      justifyContent: hasChat ? "flex-start" : "center",
      alignItems: hasChat ? "stretch" : "center",
      padding: hasChat ? 16 : 24,
      gap: 16
    }
  }, !hasChat && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/devin-mark.svg",
    alt: "",
    style: {
      width: 56
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--h4)",
      fontFamily: "var(--font-display)"
    }
  }, "Devin Local"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--body-sm)",
      color: "var(--fg-2)",
      marginTop: 4
    }
  }, "Describe your task to Devin"))), hasChat && messages.map((m, i) => /*#__PURE__*/React.createElement(Message, {
    key: i,
    m: m
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12
    }
  }, /*#__PURE__*/React.createElement(Composer, {
    compact: true,
    model: model,
    onModel: onModel,
    value: draft,
    onChange: setDraft,
    onSend: onSend
  })));
}
function Message({
  m
}) {
  if (m.role === "user") {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        alignSelf: "flex-end",
        maxWidth: "85%",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "8px 12px",
        font: "var(--body-sm)",
        color: "var(--ink)"
      }
    }, m.text);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/devin-mark.svg",
    alt: "",
    style: {
      width: 18,
      height: 18,
      marginTop: 2,
      flex: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--body-sm)",
      color: "var(--ink)",
      lineHeight: 1.5
    }
  }, m.text, m.steps && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, m.steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      font: "var(--ui-sm)",
      color: "var(--fg-2)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 14,
    color: "var(--green)"
  }), s)))));
}

/* Center home canvas — watermark, composer, start-new-session */
const SUGGESTIONS = ["Explore my codebase and diagram how it works", "Review my latest changes and suggest improvements", "Write tests for my most critical code paths"];
function HomeCanvas({
  model,
  onModel,
  draft,
  setDraft,
  onSend,
  onSuggest
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "min(720px, 92%)",
      display: "flex",
      flexDirection: "column",
      gap: 22
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/devin-mark.svg",
    alt: "",
    style: {
      width: 64,
      alignSelf: "center",
      opacity: .12
    }
  }), /*#__PURE__*/React.createElement(Composer, {
    model: model,
    onModel: onModel,
    value: draft,
    onChange: setDraft,
    onSend: onSend
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      font: "var(--ui)",
      color: "var(--fg-2)",
      padding: "10px 14px",
      border: "1px solid var(--border)",
      borderRadius: "var(--r-md)",
      background: "#fff"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "folder",
    size: 15,
    color: "var(--fg-2)"
  }), "Local", /*#__PURE__*/React.createElement(Icon, {
    name: "folder-git-2",
    size: 15,
    color: "var(--fg-2)",
    style: {
      marginLeft: 4
    }
  }), "lumen-desk", /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fg-2)",
      display: "inline-flex",
      alignItems: "center",
      gap: 4
    }
  }, "Go to agent manager ", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-up-right",
    size: 14
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--ui)",
      color: "var(--fg-2)",
      marginBottom: 8
    }
  }, "Start new session"), /*#__PURE__*/React.createElement("div", {
    style: {
      border: "1px solid var(--border)",
      borderRadius: "var(--r-md)",
      overflow: "hidden",
      background: "#fff"
    }
  }, SUGGESTIONS.map((s, i) => /*#__PURE__*/React.createElement(Suggest, {
    key: i,
    text: s,
    last: i === 2,
    onClick: () => onSuggest(s)
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      font: "var(--ui-sm)",
      color: "var(--fg-2)"
    }
  }, "Max \xB7 ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--blue)"
    }
  }, "Settings"))));
}
function Suggest({
  text,
  last,
  onClick
}) {
  const [h, setH] = useS(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      height: 44,
      padding: "0 16px",
      cursor: "pointer",
      borderBottom: last ? "none" : "1px solid var(--border-2)",
      font: "var(--body-sm)",
      background: h ? "var(--surface-2)" : "#fff",
      color: "var(--ink)"
    }
  }, text, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), h && /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-up-right",
    size: 15,
    color: "var(--fg-3)"
  }));
}
Object.assign(window, {
  Composer,
  ModelPicker,
  SessionPanel,
  HomeCanvas
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop/desktop-views.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/marketing-app.jsx
try { (() => {
// Devin Desktop marketing — full page composition
function MarketingPage() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--beige)",
      minHeight: "100%",
      color: "var(--ink)"
    }
  }, /*#__PURE__*/React.createElement(AnnouncementBar, null), /*#__PURE__*/React.createElement(MktNav, null), /*#__PURE__*/React.createElement("main", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 120,
      paddingBottom: 0
    }
  }, /*#__PURE__*/React.createElement(Hero, null), /*#__PURE__*/React.createElement(LogoCloud, null), /*#__PURE__*/React.createElement(FeatureBig, {
    label: "Agent Command Center",
    a: "A team of agents for",
    b: "every engineer.",
    body: "Devin Desktop is the home for coding agents to do your best work. You decide what to build, then your agents write the code, chase the edge cases, and test every detail.",
    visual: /*#__PURE__*/React.createElement(ProductFrame, {
      tab: "Agent",
      height: 400
    }, /*#__PURE__*/React.createElement(KanbanMock, null))
  }), /*#__PURE__*/React.createElement(FeatureBig, {
    reverse: true,
    label: "A world-class IDE",
    a: "The power of an IDE,",
    b: "exactly when you need it.",
    body: "Read, trace, and debug every change your agents ship. Devin Desktop includes a full IDE with syntax highlighting, autocomplete, and debugging tools built in for you to stay in flow.",
    visual: /*#__PURE__*/React.createElement(ProductFrame, {
      tab: "Editor",
      height: 400
    }, /*#__PURE__*/React.createElement(EditorMock, null))
  }), /*#__PURE__*/React.createElement(FeatureBig, {
    label: "Agent Client Protocol",
    a: "All the models.",
    b: "All the agents.",
    body: "Work across models and agents, powered by the Agent Client Protocol (ACP). Bring Devin Local, Devin Cloud, and frontier models into a single session.",
    visual: /*#__PURE__*/React.createElement(ProductFrame, {
      tab: "Agent",
      height: 400
    }, /*#__PURE__*/React.createElement(ModelsMock, null))
  }), /*#__PURE__*/React.createElement(FeatureCards, null), /*#__PURE__*/React.createElement(Integrations, null)), /*#__PURE__*/React.createElement(BigCTA, null), /*#__PURE__*/React.createElement("main", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 120,
      padding: "120px 0"
    }
  }, /*#__PURE__*/React.createElement(Pricing, null), /*#__PURE__*/React.createElement(Stats, null), /*#__PURE__*/React.createElement(FAQ, null)), /*#__PURE__*/React.createElement(MktFooter, null));
}
Object.assign(window, {
  MarketingPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/marketing-app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/marketing-components.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Devin Desktop marketing site — shared components
const {
  useState: useMS,
  useEffect: useME,
  useRef: useMR
} = React;
const MAXW = 1200;
const wrapStyle = {
  maxWidth: MAXW,
  margin: "0 auto",
  padding: "0 32px"
};
function MIcon({
  name,
  size = 16,
  color,
  strokeWidth = 1.6,
  style
}) {
  const ref = useMR(null);
  useME(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = "";
      const el = document.createElement("i");
      el.setAttribute("data-lucide", name);
      ref.current.appendChild(el);
      window.lucide.createIcons({
        attrs: {
          width: size,
          height: size,
          "stroke-width": strokeWidth
        },
        nameAttr: "data-lucide"
      });
    }
  }, [name, size]);
  return /*#__PURE__*/React.createElement("span", {
    ref: ref,
    style: {
      display: "inline-flex",
      width: size,
      height: size,
      color: color || "currentColor",
      ...style
    }
  });
}

/* Square button — the signature radius-0 CTA. */
function MButton({
  variant = "primary",
  children,
  leftIcon,
  arrow,
  size = "md",
  onClick,
  invert,
  full,
  style
}) {
  const [h, setH] = useMS(false);
  const dims = size === "sm" ? {
    fs: 13,
    pad: "7px 14px"
  } : size === "lg" ? {
    fs: 16,
    pad: "12px 22px"
  } : {
    fs: 14,
    pad: "9px 18px"
  };
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 0,
    cursor: "pointer",
    fontFamily: "var(--font-display)",
    fontWeight: 500,
    fontSize: dims.fs,
    lineHeight: 1.2,
    padding: dims.pad,
    border: "1px solid transparent",
    transition: "background .15s, color .15s, border-color .15s",
    whiteSpace: "nowrap",
    width: full ? "100%" : undefined
  };
  let v;
  if (variant === "primary") v = invert ? {
    background: h ? "#e7e7e7" : "#fff",
    color: "#000"
  } : {
    background: h ? "#363636" : "#191919",
    color: "#fff"
  };else if (variant === "outline") v = invert ? {
    background: h ? "rgba(255,255,255,.1)" : "transparent",
    color: "#fff",
    borderColor: "rgba(255,255,255,.4)"
  } : {
    background: h ? "rgba(0,0,0,.04)" : "transparent",
    color: "var(--ink)",
    borderColor: "rgba(0,0,0,.18)"
  };else v = {
    background: h ? "rgba(0,0,0,.05)" : "transparent",
    color: "var(--ink)"
  }; // ghost
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      ...base,
      ...v,
      ...style
    }
  }, leftIcon && /*#__PURE__*/React.createElement(MIcon, {
    name: leftIcon,
    size: dims.fs + 2
  }), children, arrow && /*#__PURE__*/React.createElement(MIcon, {
    name: "arrow-right",
    size: dims.fs
  }));
}

/* Section eyebrow — 8px blue square + uppercase mono label */
function SectionLabel({
  children,
  dark,
  center
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 12,
      justifyContent: center ? "center" : "flex-start",
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      lineHeight: 1,
      letterSpacing: ".04em",
      textTransform: "uppercase",
      color: dark ? "rgba(255,255,255,0.6)" : "var(--fg-2)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      background: "var(--blue)",
      flex: "none"
    }
  }), children);
}

/* Two-tone headline: line 1 ink, line 2 muted. */
function DualHeading({
  a,
  b,
  dark,
  size = 38,
  center
}) {
  return /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 500,
      fontSize: size,
      lineHeight: 1.08,
      letterSpacing: "-0.03em",
      margin: 0,
      textAlign: center ? "center" : "left",
      color: dark ? "#fff" : "#000"
    }
  }, a, /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: dark ? "rgba(255,255,255,0.45)" : "rgba(25,25,25,0.4)"
    }
  }, b));
}

/* Top announcement bar */
function AnnouncementBar() {
  const [h, setH] = useMS(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#191919",
      color: "#fff"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      ...wrapStyle,
      height: 40,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      cursor: "pointer",
      fontFamily: "var(--font-sans)",
      fontSize: 13.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "var(--blue)"
    }
  }), /*#__PURE__*/React.createElement("span", null, "Windsurf is now Devin Desktop. The IDE you love, with more features."), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      color: "#fff",
      textDecoration: h ? "underline" : "none",
      textUnderlineOffset: 3
    }
  }, "Learn more ", /*#__PURE__*/React.createElement(MIcon, {
    name: "arrow-right",
    size: 13
  }))));
}
function NavItem({
  label,
  menu
}) {
  const [open, setOpen] = useMS(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    },
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false)
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      border: 0,
      background: "none",
      cursor: "pointer",
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      color: "var(--ink)",
      padding: "8px 0"
    }
  }, label, menu && /*#__PURE__*/React.createElement(MIcon, {
    name: "chevron-down",
    size: 14,
    color: "var(--fg-2)"
  })), menu && open && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: "calc(100% - 2px)",
      left: -14,
      minWidth: 230,
      background: "#fff",
      border: "1px solid var(--border)",
      boxShadow: "var(--shadow-pop)",
      padding: 6,
      zIndex: 60
    }
  }, menu.map(it => /*#__PURE__*/React.createElement(MenuRow, _extends({
    key: it.t
  }, it)))));
}
function MenuRow({
  t,
  d
}) {
  const [h, setH] = useMS(false);
  return /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: "block",
      textDecoration: "none",
      padding: "9px 12px",
      background: h ? "var(--surface-2)" : "transparent"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 500,
      fontSize: 14,
      color: "var(--ink)"
    }
  }, t), d && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12.5,
      color: "var(--fg-2)",
      marginTop: 2
    }
  }, d));
}
function MktNav() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 100,
      background: "rgba(247,246,245,0.82)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(0,0,0,0.07)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...wrapStyle,
      height: 60,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 36
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/devin-logo.svg",
    alt: "Devin",
    style: {
      height: 22
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement(NavItem, {
    label: "Product",
    menu: [{
      t: "Devin Desktop",
      d: "The home for every agent you run"
    }, {
      t: "Devin Local",
      d: "The world's most capable local agent"
    }, {
      t: "Devin Cloud",
      d: "Async agents on their own machines"
    }, {
      t: "CLI",
      d: "Devin in your terminal"
    }]
  }), /*#__PURE__*/React.createElement(NavItem, {
    label: "Solutions",
    menu: [{
      t: "Enterprise",
      d: "Proven at 4,000+ companies"
    }, {
      t: "Startups",
      d: "Ship faster with fewer engineers"
    }]
  }), /*#__PURE__*/React.createElement(NavItem, {
    label: "Customers"
  }), /*#__PURE__*/React.createElement(NavItem, {
    label: "Resources",
    menu: [{
      t: "Docs"
    }, {
      t: "Blog"
    }, {
      t: "Changelog"
    }]
  }), /*#__PURE__*/React.createElement(NavItem, {
    label: "Pricing"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      color: "var(--ink)",
      textDecoration: "none"
    }
  }, "Contact sales"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      color: "var(--ink)",
      textDecoration: "none"
    }
  }, "Sign in"), /*#__PURE__*/React.createElement(MButton, {
    variant: "primary",
    size: "sm"
  }, "Download"))));
}
Object.assign(window, {
  MIcon,
  MButton,
  SectionLabel,
  DualHeading,
  AnnouncementBar,
  MktNav,
  MAXW,
  wrapStyle
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/marketing-components.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/marketing-pricing.jsx
try { (() => {
// Devin Desktop marketing — pricing, stats, FAQ, footer
const {
  useState: useS2
} = React;

/* ---- Pricing ---- */
const PLANS = [{
  n: "Free",
  price: "$0",
  cta: "Download",
  ctaVar: "outline",
  desc: "Get started with the IDE and world-class free models."
}, {
  n: "Pro",
  price: "$20",
  per: "per month",
  badge: "POPULAR",
  cta: "Select plan",
  ctaVar: "primary",
  desc: "For individual developers who run agents every day."
}, {
  n: "Max",
  price: "$200",
  per: "per month",
  badge: "NEW",
  cta: "Select plan",
  ctaVar: "outline",
  desc: "Maximum usage for power users and heavy agent fleets."
}, {
  n: "Teams",
  price: "$80",
  per: "/mo + $40/mo per full seat",
  cta: "Select plan",
  ctaVar: "outline",
  desc: "Shared Spaces, billing, and admin for your whole team."
}, {
  n: "Enterprise",
  price: "Let's talk",
  cta: "Contact us",
  ctaVar: "outline",
  desc: "SSO, compliance, and deployment support at scale."
}];
function Pricing() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      ...wrapStyle,
      paddingTop: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 14,
      marginBottom: 44
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, null, "Pricing Overview"), /*#__PURE__*/React.createElement("h2", {
    style: {
      ...H1S,
      fontSize: 36
    }
  }, "Learn about our plans")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: 12
    }
  }, PLANS.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.n,
    style: {
      background: "#fff",
      border: p.badge === "POPULAR" ? "1px solid var(--ink)" : "1px solid var(--border)",
      borderRadius: 10,
      padding: "22px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 14,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 500,
      fontSize: 17,
      color: "var(--ink)"
    }
  }, p.n), p.badge && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 9.5,
      letterSpacing: ".05em",
      background: p.badge === "NEW" ? "var(--blue)" : "var(--ink)",
      color: "#fff",
      padding: "2px 6px",
      borderRadius: 3
    }
  }, p.badge)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 6,
      minHeight: 38
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 500,
      fontSize: 30,
      letterSpacing: "-.02em",
      color: "#000"
    }
  }, p.price), p.per && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11.5,
      color: "var(--fg-2)",
      lineHeight: 1.2
    }
  }, p.per)), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      lineHeight: 1.45,
      color: "var(--fg-2)",
      margin: 0,
      flex: 1
    }
  }, p.desc), /*#__PURE__*/React.createElement(MButton, {
    variant: p.ctaVar,
    size: "sm",
    full: true
  }, p.cta)))));
}

/* ---- Stats ---- */
const STATS = [{
  n: "1M+",
  k: "Users",
  s: "Trusted by over a million developers worldwide"
}, {
  n: "4000+",
  k: "Enterprise Customers",
  s: "Startups, agencies, and enterprises"
}];
function Stats() {
  return /*#__PURE__*/React.createElement("section", {
    style: wrapStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 56,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, null, "Stats"), /*#__PURE__*/React.createElement(DualHeading, {
    a: "Trusted",
    b: "by developers.",
    size: 40
  })), /*#__PURE__*/React.createElement("div", null, STATS.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s.k,
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 24,
      padding: "22px 0",
      borderTop: "1px solid var(--border)",
      borderBottom: i === STATS.length - 1 ? "1px solid var(--border)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 500,
      fontSize: 40,
      letterSpacing: "-.03em",
      color: "#000",
      flex: "none",
      minWidth: 130
    }
  }, s.n), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 500,
      fontSize: 17,
      color: "#000"
    }
  }, s.k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 13.5,
      color: "var(--fg-2)",
      marginTop: 3
    }
  }, s.s)))))));
}

/* ---- FAQ ---- */
const FAQS = [{
  q: "What is Devin Desktop?",
  a: "Devin Desktop is the IDE formerly known as Windsurf, now the home for every coding agent you run—local and cloud—in one surface.",
  link: "Read the announcement →"
}, {
  q: "How do I upgrade to Devin Desktop from Windsurf?",
  a: "Download the latest build from the download page and your existing setup carries over automatically.",
  link: "Go to the download page →"
}, {
  q: "Will I lose anything if I update?",
  a: "No. Your settings, extensions, and projects come with you.",
  link: "Learn more in the docs →"
}, {
  q: "Does my plan or pricing change?",
  a: "No. Your current plan and pricing stay exactly the same, including legacy Windsurf Enterprise plans.",
  link: "Learn more in the docs →"
}, {
  q: "What is happening to JetBrains support?",
  a: "Windsurf for JetBrains (IntelliJ IDEA, PyCharm, WebStorm, and more) continues to be available for download.",
  link: "Get Windsurf for JetBrains →"
}];
function FAQ() {
  const [open, setOpen] = useS2(0);
  return /*#__PURE__*/React.createElement("section", {
    style: {
      ...wrapStyle,
      maxWidth: 820
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      ...H1S,
      fontSize: 34,
      textAlign: "center",
      marginBottom: 40
    }
  }, "Frequently Asked Questions"), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid var(--border)"
    }
  }, FAQS.map((f, i) => {
    const on = open === i;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        borderBottom: "1px solid var(--border)"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setOpen(on ? -1 : i),
      style: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "20px 4px",
        border: 0,
        background: "none",
        cursor: "pointer",
        textAlign: "left"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontWeight: 500,
        fontSize: 17,
        color: "var(--ink)"
      }
    }, f.q), /*#__PURE__*/React.createElement(MIcon, {
      name: on ? "minus" : "plus",
      size: 18,
      color: "var(--fg-2)"
    })), on && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "0 4px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontFamily: "var(--font-sans)",
        fontSize: 15,
        lineHeight: 1.55,
        color: "var(--fg-2)",
        margin: 0,
        maxWidth: 640
      }
    }, f.a), /*#__PURE__*/React.createElement("a", {
      href: "#",
      onClick: e => e.preventDefault(),
      style: {
        fontFamily: "var(--font-sans)",
        fontSize: 14,
        color: "var(--blue)",
        textDecoration: "none"
      }
    }, f.link)));
  })));
}

/* ---- Footer ---- */
const FCOLS = [{
  h: "Product",
  links: ["Devin Desktop", "Devin Local", "Devin Cloud", "CLI", "Pricing", "Download"]
}, {
  h: "Company",
  links: ["Customers", "Enterprise", "Blog", "Careers", "Contact sales"]
}, {
  h: "Resources",
  links: ["Docs", "Changelog", "Status", "Community"]
}, {
  h: "Legal",
  links: ["Privacy Policy", "Terms of Service", "Your Privacy Choices"]
}];
function MktFooter() {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: "#191919",
      color: "#fff",
      padding: "64px 32px 40px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: MAXW,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.5fr repeat(4,1fr)",
      gap: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/devin-mark-white.svg",
    alt: "Devin",
    style: {
      height: 28,
      alignSelf: "flex-start"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      color: "rgba(255,255,255,0.5)",
      fontFamily: "var(--font-mono)",
      fontSize: 12
    }
  }, "Built by Cognition")), FCOLS.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.h
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: ".04em",
      color: "rgba(255,255,255,0.45)",
      marginBottom: 16
    }
  }, c.h), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 11
    }
  }, c.links.map(l => /*#__PURE__*/React.createElement(FootLink, {
    key: l
  }, l)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 56,
      paddingTop: 24,
      borderTop: "1px solid rgba(255,255,255,0.1)",
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      color: "rgba(255,255,255,0.5)"
    }
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 Cognition AI, Inc."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(FootLink, null, "LinkedIn"), /*#__PURE__*/React.createElement(FootLink, null, "X (Twitter)")))));
}
function FootLink({
  children
}) {
  const [h, setH] = useS2(false);
  return /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      textDecoration: "none",
      color: h ? "#fff" : "rgba(255,255,255,0.6)"
    }
  }, children);
}
Object.assign(window, {
  Pricing,
  Stats,
  FAQ,
  MktFooter
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/marketing-pricing.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/marketing-sections.jsx
try { (() => {
// Devin Desktop marketing — page sections
const {
  useState: useSecS
} = React;
const H1S = {
  fontFamily: "var(--font-display)",
  fontWeight: 500,
  letterSpacing: "-0.03em",
  color: "#000",
  margin: 0
};
const BODY = {
  fontFamily: "var(--font-sans)",
  fontSize: 16,
  lineHeight: 1.5,
  color: "var(--fg-2)",
  margin: 0
};

/* ---- Hero ---- */
function Hero() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      ...wrapStyle,
      paddingTop: 64,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: "6px 8px 6px 14px",
      border: "1px solid rgba(0,0,0,0.1)",
      borderRadius: 999,
      background: "rgba(255,255,255,0.6)",
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      color: "var(--ink)",
      textDecoration: "none"
    }
  }, "The home for every agent you run", /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      color: "var(--blue)"
    }
  }, "Learn more ", /*#__PURE__*/React.createElement(MIcon, {
    name: "arrow-right",
    size: 13
  }))), /*#__PURE__*/React.createElement("h1", {
    style: {
      ...H1S,
      fontSize: 68,
      marginTop: 26,
      lineHeight: 1
    }
  }, "Devin Desktop"), /*#__PURE__*/React.createElement("p", {
    style: {
      ...BODY,
      fontSize: 19,
      maxWidth: 560,
      margin: "22px auto 0"
    }
  }, "Manage fleets of local and cloud agents from one surface. Plan, delegate, review, and ship without leaving your editor."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      justifyContent: "center",
      marginTop: 30
    }
  }, /*#__PURE__*/React.createElement(MButton, {
    variant: "primary",
    size: "lg",
    leftIcon: "apple"
  }, "Download for MacOS"), /*#__PURE__*/React.createElement(MButton, {
    variant: "outline",
    size: "lg"
  }, "Try on mobile")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 56
    }
  }, /*#__PURE__*/React.createElement(ProductFrame, {
    tab: "Agent",
    height: 520
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 200,
      flex: "none",
      borderRight: "1px solid var(--border)",
      background: "var(--surface-app)",
      padding: "12px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 14px 10px",
      fontFamily: "var(--font-ui)",
      fontSize: 12,
      fontWeight: 600,
      color: "var(--fg-2)",
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: "plus",
    size: 13
  }), " New session"), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 14px 6px",
      fontFamily: "var(--font-mono)",
      fontSize: 10.5,
      textTransform: "uppercase",
      letterSpacing: ".04em",
      color: "var(--fg-3)"
    }
  }, "Sessions"), /*#__PURE__*/React.createElement(SessionRow, {
    title: "Widen the model hidden dimension",
    status: "working"
  }), /*#__PURE__*/React.createElement(SessionRow, {
    title: "Switch the MLP activation to GELU",
    status: "pr",
    time: "42m ago"
  }), /*#__PURE__*/React.createElement(SessionRow, {
    space: "Learning rate tuning",
    title: "Increase the Muon matrix learning rate",
    status: "working"
  }), /*#__PURE__*/React.createElement(SessionRow, {
    title: "Add QK-norm and value embeddings",
    status: "ci",
    time: "1h ago"
  })), /*#__PURE__*/React.createElement(KanbanMock, null))));
}

/* ---- Customer logo cloud ---- */
const LOGOS = ["logo-01", "logo-02", "logo-05", "logo-06", "logo-07", "logo-08", "logo-10", "logo-11", "logo-12"];
function LogoCloud() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      ...wrapStyle,
      paddingTop: 80
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: ".05em",
      color: "var(--fg-2)",
      marginBottom: 36
    }
  }, "Trusted by teams at the world's best companies"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: "32px 56px",
      justifyContent: "center",
      alignItems: "center",
      opacity: .55
    }
  }, LOGOS.map(l => /*#__PURE__*/React.createElement("img", {
    key: l,
    src: `../../assets/logos/${l}.svg`,
    alt: "",
    style: {
      height: 30,
      maxWidth: 120,
      objectFit: "contain"
    }
  }))));
}

/* ---- Big two-tone feature with product frame ---- */
function FeatureBig({
  label,
  a,
  b,
  body,
  visual,
  reverse
}) {
  const text = /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, null, label), /*#__PURE__*/React.createElement(DualHeading, {
    a: a,
    b: b,
    size: 34
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      ...BODY,
      maxWidth: 440
    }
  }, body));
  return /*#__PURE__*/React.createElement("section", {
    style: wrapStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "0.85fr 1.15fr",
      gap: 56,
      alignItems: "center"
    }
  }, reverse ? /*#__PURE__*/React.createElement(React.Fragment, null, visual, text) : /*#__PURE__*/React.createElement(React.Fragment, null, text, visual)));
}

/* ---- Feature cards (H3 grid) ---- */
const FCARDS = [{
  ey: "Spaces",
  t: "One Space for every agent",
  d: "Use Spaces to share context and Git worktrees across all your agents."
}, {
  ey: "Supercomplete",
  t: "Tab, Tab, Ship",
  d: "Supercomplete predicts your next thought, not just your next edit."
}, {
  ey: "Fast Context",
  t: "Instant codebase context",
  d: "Fast Context finds the exact files and lines your agent needs—in milliseconds."
}, {
  ey: "Review",
  t: "Never miss a detail",
  d: "Rapidly (or deeply) review every agent diff—before you push."
}, {
  ey: "Free models",
  t: "Free world-class models",
  d: "Unlimited access to SWE-1.6, the fastest coding model in the world."
}, {
  ey: "Cloud handoff",
  t: "Effortless handoff to the cloud",
  d: "The only IDE designed for you to close your laptop."
}];
function FeatureCards() {
  return /*#__PURE__*/React.createElement("section", {
    style: wrapStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 1,
      background: "var(--border)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      overflow: "hidden"
    }
  }, FCARDS.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.t,
    style: {
      background: "var(--beige)",
      padding: "28px 26px",
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 120,
      background: "rgba(0,0,0,0.045)",
      borderRadius: 6,
      marginBottom: 6
    }
  }), /*#__PURE__*/React.createElement(SectionLabel, null, f.ey), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 500,
      fontSize: 19,
      color: "#000",
      margin: 0,
      letterSpacing: "-.02em"
    }
  }, f.t), /*#__PURE__*/React.createElement("p", {
    style: {
      ...BODY,
      fontSize: 14.5
    }
  }, f.d)))));
}

/* ---- Integrations ---- */
const INTEG = [{
  n: "Slack",
  k: "MCP Server",
  f: "slack",
  d: "Search channels and messages, send and read messages, and access user profiles."
}, {
  n: "ESLint",
  k: "Extension",
  f: "eslint",
  d: "Find and fix problems in your JavaScript and TypeScript code."
}, {
  n: "Linear",
  k: "MCP Server",
  f: "linear",
  d: "List, create, update, and query issues, projects, initiatives, cycles, and comments."
}, {
  n: "rust-analyzer",
  k: "Language Server",
  f: "rust-analyzer",
  d: "Code completion, go-to-definition, and inline diagnostics for Rust."
}, {
  n: "Notion",
  k: "MCP Server",
  f: "notion",
  d: "Retrieve and manage pages, databases, and comments; search across your workspace."
}, {
  n: "Prettier",
  k: "Extension",
  f: "prettier",
  d: "Opinionated code formatter that enforces a consistent style across your codebase."
}, {
  n: "Figma",
  k: "MCP Server",
  f: "figma",
  d: "Get files, nodes, and images; manage comments, components, styles, and webhooks."
}, {
  n: "clangd",
  k: "Language Server",
  f: "clangd",
  d: "C and C++ language server with completion, navigation, and diagnostics."
}, {
  n: "Sentry",
  k: "MCP Server",
  f: "sentry",
  d: "Retrieve issue data and stack traces; search, filter, and update issue status."
}, {
  n: "Pyright",
  k: "Extension",
  f: "pyright",
  d: "Fast type checking, IntelliSense, and diagnostics for Python."
}, {
  n: "Stripe",
  k: "MCP Server",
  f: "stripe",
  d: "Create and manage customers, products, subscriptions, invoices, payouts, and refunds."
}, {
  n: "gopls",
  k: "Language Server",
  f: "gopls",
  d: "The official Go language server for completion, navigation, and refactoring."
}, {
  n: "Vercel",
  k: "MCP Server",
  f: "vercel",
  d: "Manage projects and deployments, analyze logs, and search Vercel documentation."
}, {
  n: "Datadog",
  k: "MCP Server",
  f: "datadog",
  d: "Retrieve telemetry insights and manage incidents, monitors, logs, and traces."
}, {
  n: "Atlassian",
  k: "MCP Server",
  f: "atlassian",
  d: "Access Jira and Confluence — manage issues and create enterprise documentation."
}];
function Integrations() {
  return /*#__PURE__*/React.createElement("section", {
    style: wrapStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 16,
      marginBottom: 44
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, null, "Extensibility"), /*#__PURE__*/React.createElement("h2", {
    style: {
      ...H1S,
      fontSize: 36
    }
  }, "Make Devin Desktop your own"), /*#__PURE__*/React.createElement("p", {
    style: {
      ...BODY,
      maxWidth: 520
    }
  }, "Extend Devin with the tools, skills, and plugins your team already uses.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 16
    }
  }, INTEG.map(it => /*#__PURE__*/React.createElement("div", {
    key: it.n,
    style: {
      background: "#fff",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "18px 18px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 8,
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      display: "grid",
      placeItems: "center"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: `../../assets/integrations/${it.f}.svg`,
    alt: "",
    style: {
      width: 20,
      height: 20,
      objectFit: "contain"
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: 14,
      color: "var(--ink)"
    }
  }, it.n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 10.5,
      textTransform: "uppercase",
      letterSpacing: ".03em",
      color: "var(--fg-2)",
      marginTop: 2
    }
  }, it.k))), /*#__PURE__*/React.createElement("p", {
    style: {
      ...BODY,
      fontSize: 13,
      lineHeight: 1.45
    }
  }, it.d)))));
}

/* ---- Big CTA (dark) ---- */
function BigCTA() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: "#191919",
      color: "#fff",
      padding: "110px 32px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: MAXW,
      margin: "0 auto",
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 32
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      ...H1S,
      color: "#fff",
      fontSize: 46
    }
  }, "So good you can't work without it"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      flexWrap: "wrap",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(MButton, {
    variant: "primary",
    size: "lg",
    invert: true,
    leftIcon: "apple"
  }, "Download for MacOS"), /*#__PURE__*/React.createElement(MButton, {
    variant: "outline",
    size: "lg",
    invert: true
  }, "Try on mobile"), /*#__PURE__*/React.createElement(MButton, {
    variant: "outline",
    size: "lg",
    invert: true,
    arrow: true
  }, "Request a demo"))));
}
Object.assign(window, {
  Hero,
  LogoCloud,
  FeatureBig,
  FeatureCards,
  Integrations,
  BigCTA,
  BODY,
  H1S
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/marketing-sections.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/marketing-visuals.jsx
try { (() => {
// Devin Desktop marketing — product-frame mockups (branded, static)
const {
  useState: useVS
} = React;
function Dots() {
  const d = c => ({
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: c
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: d("#ff5f57")
  }), /*#__PURE__*/React.createElement("span", {
    style: d("#febc2e")
  }), /*#__PURE__*/React.createElement("span", {
    style: d("#28c840")
  }));
}

/* Generic mac window shell */
function ProductFrame({
  children,
  tab = "Agent",
  height,
  dark
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: dark ? "#191919" : "#fcfcfc",
      border: "1px solid rgba(0,0,0,0.1)",
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: "0 24px 60px -20px rgba(0,0,0,0.35), 0 8px 20px -8px rgba(0,0,0,0.18)",
      height
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 40,
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "0 14px",
      borderBottom: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement(Dots, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 2
    }
  }, ["Agent", "Editor"].map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 12,
      fontWeight: 500,
      padding: "4px 10px",
      borderRadius: 6,
      color: t === tab ? "var(--ink)" : "var(--fg-2)",
      background: t === tab ? "rgba(0,0,0,0.05)" : "transparent"
    }
  }, t))), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("img", {
    src: "../../assets/devin-mark.svg",
    alt: "",
    style: {
      height: 15,
      opacity: .85
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      height: height ? height - 40 : "auto"
    }
  }, children));
}
const STATUS = {
  working: {
    c: "var(--orange)",
    t: "Working..."
  },
  pr: {
    c: "var(--green)",
    t: "PR is ready"
  },
  ci: {
    c: "var(--blue)",
    t: "Waiting for CI"
  }
};
function SessionRow({
  space,
  title,
  status,
  time,
  head
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 14px",
      borderBottom: "1px solid var(--border-2)"
    }
  }, space && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 11,
      color: "var(--fg-2)",
      marginBottom: 3
    }
  }, space), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 13,
      color: "var(--ink)",
      fontWeight: head ? 600 : 400
    }
  }, title), status && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginTop: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: STATUS[status].c
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 11.5,
      color: "var(--fg-2)"
    }
  }, STATUS[status].t), time && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 11.5,
      color: "var(--fg-3)"
    }
  }, "\xB7 ", time)));
}

/* Kanban / agent command center mock */
function KanbanMock() {
  const col = (title, n, cards) => /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      padding: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "2px 6px 8px",
      fontFamily: "var(--font-ui)",
      fontSize: 12,
      fontWeight: 500
    }
  }, title, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fg-3)"
    }
  }, n)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, cards.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: "#fff",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 6,
      padding: "9px 10px",
      boxShadow: "var(--shadow-xs)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 11,
      color: "var(--fg-2)"
    }
  }, c.space), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 12.5,
      color: "var(--ink)",
      marginTop: 2
    }
  }, c.t), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: STATUS[c.s].c
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 11,
      color: "var(--fg-2)"
    }
  }, c.time || STATUS[c.s].t))))));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      background: "var(--surface-app)",
      overflow: "hidden"
    }
  }, col("Running", 2, [{
    space: "autoresearch",
    t: "Widen the model hidden dimension",
    s: "working"
  }, {
    space: "Learning rate tuning",
    t: "Increase the Muon matrix learning rate",
    s: "working"
  }]), col("Waiting for review", 2, [{
    space: "Learning rate tuning",
    t: "Add a learning rate warmup phase",
    s: "pr"
  }, {
    space: "Learning rate tuning",
    t: "Tune the WSD warmdown ratio",
    s: "ci"
  }]), col("Done", 3, [{
    space: "autoresearch",
    t: "Switch the MLP activation to GELU",
    s: "pr",
    time: "42m ago"
  }, {
    space: "autoresearch",
    t: "Establish the training baseline",
    s: "pr",
    time: "3h ago"
  }]));
}

/* Editor / code mock */
const CODE = [[["kw", "class "], ["fn", "Block"], ["pl", "("], ["ty", "nn.Module"], ["pl", "):"]], [["kw", "  def "], ["fn", "__init__"], ["pl", "(self, config):"]], [["pl", "    self.config = config"]], [["pl", "    self.window_sizes = self."], ["fn", "_compute_window_sizes"], ["pl", "(config)"]], [], [["kw", "  def "], ["fn", "forward"], ["pl", "(self, x, ve, cos_sin, window_size):"]], [["pl", "    x = x + self.attn("], ["fn", "norm"], ["pl", "(x), ve, cos_sin, window_size)"]], [["pl", "    x = x + self.mlp("], ["fn", "norm"], ["pl", "(x))"]], [["kw", "    return "], ["pl", "x"]]];
const TOK = {
  kw: "#af00db",
  fn: "#795e26",
  ty: "#267f99",
  pl: "#191919"
};
function EditorMock() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: "#fcfcfc",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 30,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "0 12px",
      borderBottom: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11.5,
      color: "var(--fg-2)",
      background: "#fff",
      border: "1px solid var(--border)",
      padding: "3px 10px",
      borderRadius: 4
    }
  }, "train.py")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 0",
      fontFamily: "var(--font-mono)",
      fontSize: 12.5,
      lineHeight: "20px",
      overflow: "hidden"
    }
  }, CODE.map((line, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      padding: "0 14px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 26,
      color: "var(--fg-3)",
      flex: "none",
      textAlign: "right",
      marginRight: 14
    }
  }, 116 + i), /*#__PURE__*/React.createElement("span", {
    style: {
      whiteSpace: "pre"
    }
  }, line.map(([t, s], j) => /*#__PURE__*/React.createElement("span", {
    key: j,
    style: {
      color: TOK[t]
    }
  }, s)))))));
}

/* Model picker / agents mock */
function ModelsMock() {
  const Agent = ({
    n,
    sel,
    local
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "9px 12px",
      borderRadius: 7,
      background: sel ? "rgba(49,124,255,0.08)" : "transparent"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 16,
      display: "grid",
      placeItems: "center"
    }
  }, sel && /*#__PURE__*/React.createElement(MIcon, {
    name: "check",
    size: 15,
    color: "var(--blue)"
  })), local ? /*#__PURE__*/React.createElement("img", {
    src: "../../assets/devin-mark.svg",
    alt: "",
    style: {
      width: 16,
      height: 16
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: "var(--fg-3)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 13,
      color: "var(--ink)",
      flex: 1
    }
  }, n), local && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 11,
      color: "var(--fg-2)",
      border: "1px solid var(--border)",
      borderRadius: 4,
      padding: "2px 6px"
    }
  }, "Local"));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: "var(--surface-app)",
      display: "grid",
      placeItems: "center",
      padding: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 320,
      background: "#fff",
      border: "1px solid var(--border)",
      borderRadius: 10,
      boxShadow: "var(--shadow-pop)",
      padding: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 12px",
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: ".04em",
      color: "var(--fg-2)"
    }
  }, "Agents"), /*#__PURE__*/React.createElement(Agent, {
    n: "Devin Cloud"
  }), /*#__PURE__*/React.createElement(Agent, {
    n: "Devin Local",
    sel: true,
    local: true
  }), /*#__PURE__*/React.createElement(Agent, {
    n: "Codex"
  }), /*#__PURE__*/React.createElement(Agent, {
    n: "Claude Agent"
  }), /*#__PURE__*/React.createElement(Agent, {
    n: "OpenCode"
  }), /*#__PURE__*/React.createElement(Agent, {
    n: "Cascade"
  })));
}
Object.assign(window, {
  ProductFrame,
  KanbanMock,
  EditorMock,
  ModelsMock,
  SessionRow
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/marketing-visuals.jsx", error: String((e && e.message) || e) }); }

})();
