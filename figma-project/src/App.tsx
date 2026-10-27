import { useMemo, useState } from "react";

type PopupPage = "home" | "settings" | "whitelist" | "activity" | "about";
type Scenario = "idle" | "normal" | "hazard" | "cuts" | "unsupported";
type ProtectionMode = "Blur" | "Dim" | "Freeze";
type IconName =
  | "shield"
  | "settings"
  | "activity"
  | "info"
  | "chevron"
  | "close"
  | "play"
  | "pause"
  | "check"
  | "warning"
  | "globe"
  | "lock"
  | "refresh"
  | "external";

type ActivityItem = {
  id: number;
  text: string;
  detail: string;
};

const DOMAIN = "example.test";

const initialActivity: ActivityItem[] = [
  { id: 1, text: "Protection enabled", detail: "Ready to inspect accessible videos" },
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    shield: <path d="M12 2.5 4.5 5.8v5.1c0 4.7 3.2 8.9 7.5 10.6 4.3-1.7 7.5-5.9 7.5-10.6V5.8L12 2.5Zm0 3 4.5 2v3.4c0 3.1-1.8 6.1-4.5 7.5-2.7-1.4-4.5-4.4-4.5-7.5V7.5l4.5-2Z" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1-2.8 2.8-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21h-4v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1-2.8-2.8.1-.1A1.6 1.6 0 0 0 4.8 15a1.6 1.6 0 0 0-1.5-1H3v-4h.3a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1 2.8-2.8.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3h4v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1 2.8 2.8-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1h.2v4h-.2a1.6 1.6 0 0 0-1.5 1Z" />
      </>
    ),
    activity: (
      <>
        <path d="M4 5h16M4 12h16M4 19h16" />
        <circle cx="7" cy="5" r="1.4" />
        <circle cx="15" cy="12" r="1.4" />
        <circle cx="10" cy="19" r="1.4" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 10v6M12 7h.01" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    play: <path d="m8 5 11 7-11 7V5Z" />,
    pause: <path d="M8 5h3v14H8zM15 5h3v14h-3z" />,
    check: <path d="m5 12 4 4L19 6" />,
    warning: (
      <>
        <path d="M12 3 2.8 20h18.4L12 3Z" />
        <path d="M12 9v5M12 17h.01" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.3 2.5 3.5 5.5 3.5 9S14.3 18.5 12 21c-2.3-2.5-3.5-5.5-3.5-9S9.7 5.5 12 3Z" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    refresh: <path d="M20 7v5h-5M4 17v-5h5M18.5 9A7 7 0 0 0 6.2 6.2L4 9m16 6-2.2 2.8A7 7 0 0 1 5.5 15" />,
    external: <path d="M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />,
  };
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill={name === "shield" ? "currentColor" : "none"}
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[name]}
      </g>
    </svg>
  );
}

function Button({
  children,
  onClick,
  variant = "secondary",
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={`button button--${variant} ${className}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? "toggle--on" : ""}`}
      onClick={onChange}
      role="switch"
      type="button"
    >
      <span />
    </button>
  );
}

function StatusBadge({
  type,
  children,
}: {
  type: "active" | "off" | "warning" | "neutral";
  children: React.ReactNode;
}) {
  return <span className={`status status--${type}`}>{children}</span>;
}

export default function App() {
  const [popupOpen, setPopupOpen] = useState(true);
  const [popupPage, setPopupPage] = useState<PopupPage>("home");
  const [protection, setProtection] = useState(true);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [scenario, setScenario] = useState<Scenario>("idle");
  const [mode, setMode] = useState<ProtectionMode>("Blur");
  const [sensitivity, setSensitivity] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [override, setOverride] = useState(false);
  const [confirmOverride, setConfirmOverride] = useState(false);
  const [developerOpen, setDeveloperOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"demo" | "guide">("demo");
  const [checkedCount, setCheckedCount] = useState(0);
  const [incidentCount, setIncidentCount] = useState(0);
  const [activity, setActivity] = useState<ActivityItem[]>(initialActivity);
  const [devLog, setDevLog] = useState<string[]>(["Protection enabled"]);
  const [toast, setToast] = useState("Prototype ready — protection is active.");

  const whitelisted = whitelist.includes(DOMAIN);
  const siteProtected = protection && !whitelisted;
  const interventionActive = scenario === "hazard" && siteProtected && !override;

  const addActivity = (text: string, detail: string) => {
    setActivity((items) => [{ id: items.length + 1, text, detail }, ...items]);
  };

  const toggleProtection = () => {
    const next = !protection;
    setProtection(next);
    setOverride(false);
    setToast(next ? "Protection enabled." : "Protection turned off.");
    addActivity(next ? "Protection enabled" : "Protection disabled", next ? "Monitoring resumed" : "Automatic intervention paused");
    setDevLog((logs) => [`Protection ${next ? "enabled" : "disabled"}`, ...logs]);
  };

  const addCurrentSite = () => {
    if (!whitelisted) setWhitelist((items) => [...items, DOMAIN]);
    setOverride(false);
    setToast(`${DOMAIN} added to whitelist.`);
    addActivity("Website added to whitelist", `${DOMAIN} will not receive automatic intervention`);
    setDevLog((logs) => ["Website excluded from protection", ...logs]);
  };

  const removeSite = (domain: string) => {
    setWhitelist((items) => items.filter((item) => item !== domain));
    setToast(`Protection restored on ${domain}.`);
    addActivity("Website removed from whitelist", `Protection restored on ${domain}`);
    setDevLog((logs) => ["Protection restored", ...logs]);
  };

  const runScenario = (next: Scenario) => {
    setScenario(next);
    setOverride(false);
    setConfirmOverride(false);
    setPlaying(next !== "hazard");
    if (next !== "idle") setCheckedCount((count) => count + 1);

    const common = ["Analyzing sample", "Video discovered"];
    if (next === "normal") {
      setToast("Analysis complete: no hazardous flashing detected.");
      addActivity("Video checked: No hazardous flashing detected", "Normal video remained visible");
      setDevLog((logs) => ["Classified: no hazard", ...common, ...logs]);
    } else if (next === "cuts") {
      setToast("Scene cuts detected, but not classified as hazardous.");
      addActivity("Video checked: Scene changes not classified as hazardous", "No intervention applied");
      setDevLog((logs) => ["Classified: safe scene changes", ...common, ...logs]);
    } else if (next === "unsupported") {
      setToast("Analysis unavailable — this video was not marked safe.");
      addActivity("Video could not be analyzed", "Frame access was unavailable");
      setDevLog((logs) => ["Video analysis unavailable", "Frame access failed", ...common, ...logs]);
    } else if (next === "hazard") {
      setIncidentCount((count) => count + 1);
      if (siteProtected) {
        setToast(`Potential flashing detected. ${mode} protection applied.`);
        addActivity("Potential flashing detected: Protection applied", `${mode} intervention is active`);
        setDevLog((logs) => [`Applying ${mode.toLowerCase()} intervention`, "Potential flash pattern detected", ...common, ...logs]);
      } else {
        const reason = whitelisted ? "website is whitelisted" : "protection is disabled";
        setToast(`Potential flashing simulated, but no intervention was applied because ${reason}.`);
        addActivity("Potential flashing detected: Intervention bypassed", reason);
        setDevLog((logs) => ["Intervention bypassed", "Potential flash pattern detected", ...common, ...logs]);
      }
    }
  };

  const runBypassedHazard = (reason: "disabled" | "whitelisted") => {
    const detail = reason === "disabled" ? "protection is disabled" : "website is whitelisted";
    if (reason === "disabled") {
      setProtection(false);
      setWhitelist((items) => items.filter((item) => item !== DOMAIN));
    } else {
      setProtection(true);
      setWhitelist((items) => items.includes(DOMAIN) ? items : [...items, DOMAIN]);
    }
    setScenario("hazard");
    setOverride(false);
    setConfirmOverride(false);
    setPlaying(true);
    setCheckedCount((count) => count + 1);
    setIncidentCount((count) => count + 1);
    setToast(`Potential flashing simulated, but no intervention was applied because ${detail}.`);
    addActivity("Potential flashing detected: Intervention bypassed", detail);
    setDevLog((logs) => ["Intervention bypassed", "Potential flash pattern detected", "Analyzing sample", "Video discovered", ...logs]);
  };

  const resetDemo = () => {
    setProtection(true);
    setWhitelist([]);
    setScenario("idle");
    setMode("Blur");
    setSensitivity(1);
    setPlaying(false);
    setOverride(false);
    setConfirmOverride(false);
    setCheckedCount(0);
    setIncidentCount(0);
    setActivity(initialActivity);
    setDevLog(["Protection enabled"]);
    setToast("Demo reset — protection is active.");
    setPopupPage("home");
  };

  const statusText = useMemo(() => {
    if (!protection) return "Protection off";
    if (whitelisted) return "Site excluded";
    if (scenario === "unsupported") return "Analysis unavailable";
    if (interventionActive) return "Intervention active";
    return "Monitoring";
  }, [protection, whitelisted, scenario, interventionActive]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="logo-box"><Icon name="shield" size={24} /></div>
          <div>
            <h1>FlashGuard <span>Prototype</span></h1>
            <p>EECS 497 · Interaction testing workspace</p>
          </div>
        </div>
        <nav aria-label="Prototype sections" className="topnav">
          <button className={activeTab === "demo" ? "active" : ""} onClick={() => setActiveTab("demo")} type="button">Demo workspace</button>
          <button className={activeTab === "guide" ? "active" : ""} onClick={() => setActiveTab("guide")} type="button">Peer review guide</button>
        </nav>
        <StatusBadge type="neutral">Low-fidelity v0.1</StatusBadge>
      </header>

      {activeTab === "guide" ? (
        <PeerReviewGuide onStart={() => setActiveTab("demo")} />
      ) : (
        <div className="workspace">
          <section aria-label="Simulated Chrome browser" className="browser">
            <div className="browser-tabs">
              <div className="traffic-lights"><i /><i /><i /></div>
              <div className="browser-tab"><Icon name="globe" size={14} /> Video Library <span>×</span></div>
              <button aria-label="New tab" type="button">+</button>
            </div>
            <div className="browser-toolbar">
              <div className="browser-actions"><button aria-label="Back" type="button">‹</button><button aria-label="Forward" type="button">›</button><button aria-label="Reload" type="button">↻</button></div>
              <div className="address-bar"><Icon name="lock" size={13} /><span>example.test/videos</span></div>
              <button
                aria-label={popupOpen ? "Close FlashGuard extension" : "Open FlashGuard extension"}
                className={`extension-icon ${popupOpen ? "selected" : ""}`}
                onClick={() => setPopupOpen((open) => !open)}
                title="FlashGuard"
                type="button"
              >
                <Icon name="shield" size={21} />
                <span className={`protection-dot ${siteProtected ? "" : "off"}`} />
              </button>
              <div className="browser-menu">⋮</div>
            </div>

            <div className="webpage">
              <nav className="site-nav" aria-label="Sample website">
                <strong>FRAME / STORIES</strong>
                <div><span>Watch</span><span>Stories</span><span>About</span></div>
              </nav>
              <div className="page-content">
                <div className="eyebrow">FEATURED SHORT · 06:24</div>
                <h2>Light, form, and the modern city</h2>
                <p className="dek">A quiet look at how public spaces change from morning to night.</p>

                <div className={`video-frame mode-${mode.toLowerCase()} ${interventionActive ? "intervened" : ""}`}>
                  <div className="video-placeholder" aria-label="Static video placeholder">
                    <div className="building building-a" />
                    <div className="building building-b" />
                    <div className="building building-c" />
                    <div className="sun" />
                    <span>STATIC VIDEO PLACEHOLDER</span>
                  </div>

                  {interventionActive && (
                    <div className="video-overlay protected-overlay" role="alert">
                      <div className="overlay-icon"><Icon name="shield" size={25} /></div>
                      <strong>Flashing content detected</strong>
                      <p>FlashGuard detected a potentially hazardous flashing pattern and reduced exposure to this video.</p>
                      <div className="overlay-mode">{mode} protection applied</div>
                      <div className="overlay-actions">
                        <Button onClick={() => setToast("Protection remains active for this video.")} variant="primary">Keep protection on</Button>
                        <Button onClick={() => setConfirmOverride(true)}>Show anyway</Button>
                      </div>
                    </div>
                  )}

                  {scenario === "unsupported" && (
                    <div className="video-overlay unavailable-overlay" role="alert">
                      <div className="overlay-icon"><Icon name="warning" size={24} /></div>
                      <strong>Unable to analyze this video</strong>
                      <p>FlashGuard could not inspect this video’s frames. Protection may be limited for this content.</p>
                      <div className="overlay-actions">
                        <Button onClick={() => runScenario("idle")} variant="primary">Return to webpage</Button>
                        <Button onClick={() => { setPopupOpen(true); setPopupPage("home"); }}>View protection status</Button>
                      </div>
                    </div>
                  )}

                  {scenario === "hazard" && !siteProtected && (
                    <div className="corner-notice"><Icon name="warning" size={15} /> Intervention off — {whitelisted ? "site excluded" : "protection disabled"}</div>
                  )}
                  {scenario === "hazard" && override && (
                    <div className="corner-notice corner-notice--override"><Icon name="warning" size={15} /> Original view allowed by user</div>
                  )}

                  <div className="video-controls">
                    <button
                      aria-label={playing ? "Pause sample video" : "Play sample video"}
                      onClick={() => { setPlaying((value) => !value); if (!playing && scenario === "idle") runScenario("normal"); }}
                      type="button"
                    >
                      <Icon name={playing ? "pause" : "play"} size={17} />
                    </button>
                    <div className="progress"><i style={{ width: playing ? "36%" : "8%" }} /></div>
                    <span>{playing ? "2:18" : "0:00"} / 6:24</span>
                    {scenario === "hazard" && override && <button className="restore-link" onClick={() => { setOverride(false); addActivity("Protection restored", "Original content obscured again"); setToast("Protection restored for this video."); }} type="button">Restore protection</button>}
                  </div>
                </div>

                <div className="article-grid">
                  <article><span>ABOUT THIS FILM</span><p>This static media sample lets reviewers explore how an extension can respond while preserving the surrounding page.</p></article>
                  <article><span>TRANSCRIPT</span><p>The city wakes slowly. Buildings take shape as daylight moves across their surfaces.</p></article>
                  <aside><strong>Up next</strong><div className="thumbnail" /><span>Designing calmer public spaces</span></aside>
                </div>
              </div>
            </div>

            {popupOpen && (
              <ExtensionPopup
                activity={activity}
                checkedCount={checkedCount}
                incidentCount={incidentCount}
                mode={mode}
                onAddSite={addCurrentSite}
                onClose={() => setPopupOpen(false)}
                onNavigate={setPopupPage}
                onRemoveSite={removeSite}
                onResetSettings={() => { setMode("Blur"); setSensitivity(1); if (!protection) toggleProtection(); setToast("Default settings restored."); }}
                onSetMode={(value) => { setMode(value); setToast(`${value} selected as the protection behavior.`); }}
                onSetSensitivity={setSensitivity}
                onToggleProtection={toggleProtection}
                page={popupPage}
                protection={protection}
                sensitivity={sensitivity}
                statusText={statusText}
                whitelist={whitelist}
                whitelisted={whitelisted}
              />
            )}
          </section>

          <section aria-live="polite" className="feedback-bar">
            <Icon name={siteProtected ? "check" : "info"} size={16} />
            <span>{toast}</span>
          </section>

          <DeveloperPanel
            devLog={devLog}
            mode={mode}
            onReset={resetDemo}
            onRun={runScenario}
            onRunDisabled={() => runBypassedHazard("disabled")}
            onRunWhitelisted={() => runBypassedHazard("whitelisted")}
            onToggle={() => setDeveloperOpen((open) => !open)}
            open={developerOpen}
            protection={protection}
            scenario={scenario}
            siteProtected={siteProtected}
            statusText={statusText}
            whitelisted={whitelisted}
          />
        </div>
      )}

      {confirmOverride && (
        <div aria-modal="true" className="modal-backdrop" role="dialog">
          <div className="confirm-dialog">
            <div className="dialog-symbol"><Icon name="warning" size={26} /></div>
            <h2>Show original video?</h2>
            <p>Displaying the original content may expose you to flashing. FlashGuard cannot determine how this content may affect you.</p>
            <div className="dialog-note"><strong>Protection will be bypassed for this video only.</strong> You can restore it at any time.</div>
            <div className="dialog-actions">
              <Button onClick={() => setConfirmOverride(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  setConfirmOverride(false);
                  setOverride(true);
                  setPlaying(false);
                  setToast("Original video shown by explicit user choice. No flashing is displayed in this prototype.");
                  addActivity("User chose to show original video", "Protection can be restored at any time");
                }}
                variant="danger"
              >
                Show original video
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ExtensionPopup({
  page,
  onNavigate,
  onClose,
  protection,
  onToggleProtection,
  whitelisted,
  onAddSite,
  whitelist,
  onRemoveSite,
  checkedCount,
  incidentCount,
  statusText,
  activity,
  mode,
  onSetMode,
  sensitivity,
  onSetSensitivity,
  onResetSettings,
}: {
  page: PopupPage;
  onNavigate: (page: PopupPage) => void;
  onClose: () => void;
  protection: boolean;
  onToggleProtection: () => void;
  whitelisted: boolean;
  onAddSite: () => void;
  whitelist: string[];
  onRemoveSite: (domain: string) => void;
  checkedCount: number;
  incidentCount: number;
  statusText: string;
  activity: ActivityItem[];
  mode: ProtectionMode;
  onSetMode: (mode: ProtectionMode) => void;
  sensitivity: number;
  onSetSensitivity: (value: number) => void;
  onResetSettings: () => void;
}) {
  const pageTitle: Record<Exclude<PopupPage, "home">, string> = {
    settings: "Settings",
    whitelist: "Website exceptions",
    activity: "Detection activity",
    about: "About FlashGuard",
  };
  const goBack = () => onNavigate(page === "whitelist" ? "settings" : "home");

  return (
    <aside aria-label="FlashGuard extension popup" className="extension-popup">
      <header className="popup-header">
        <div className="popup-brand"><div className="logo-box logo-box--small"><Icon name="shield" size={20} /></div><div><strong>FlashGuard</strong><span>Flash protection for your browser.</span></div></div>
        <button aria-label="Close extension popup" className="icon-button" onClick={onClose} type="button"><Icon name="close" size={18} /></button>
      </header>

      {page !== "home" && (
        <div className="subpage-title">
          <button aria-label="Back" onClick={goBack} type="button">←</button>
          <h2>{pageTitle[page]}</h2>
        </div>
      )}

      <div className="popup-body">
        {page === "home" && (
          <>
            <section className={`protection-card ${protection ? "" : "protection-card--off"}`}>
              <div><span className="section-kicker">PRIMARY CONTROL</span><h2>FlashGuard Protection</h2></div>
              <Toggle checked={protection} label="Toggle FlashGuard protection" onChange={onToggleProtection} />
              <p><Icon name={protection ? "check" : "warning"} size={15} />{protection ? "Protection is active." : "Protection is off. Flashing content will not be filtered."}</p>
            </section>

            <section className="site-card">
              <div className="row-between"><div><span className="section-kicker">CURRENT WEBSITE</span><strong>{DOMAIN}</strong></div><StatusBadge type={whitelisted ? "off" : protection ? "active" : "off"}>{whitelisted ? "Excluded" : protection ? "Protected" : "Off"}</StatusBadge></div>
              {whitelisted ? (
                <><p>Protection is disabled on this website because you added it to your whitelist.</p><Button className="full-width" onClick={() => onRemoveSite(DOMAIN)}>Restore protection</Button></>
              ) : (
                <Button className="full-width" onClick={onAddSite}>Trust this site</Button>
              )}
            </section>

            <section className="activity-summary">
              <div><strong>{checkedCount}</strong><span>Videos checked</span></div>
              <div><strong>{incidentCount}</strong><span>Potential incidents</span></div>
              <div className="current-state"><span>Current status</span><strong>{statusText}</strong></div>
            </section>

            <nav aria-label="FlashGuard pages" className="popup-nav">
              <button onClick={() => onNavigate("settings")} type="button"><Icon name="settings" /><span><strong>Settings</strong><small>Protection behavior and sensitivity</small></span><Icon name="chevron" size={16} /></button>
              <button onClick={() => onNavigate("activity")} type="button"><Icon name="activity" /><span><strong>Detection Activity</strong><small>Recent checks and interventions</small></span><Icon name="chevron" size={16} /></button>
              <button onClick={() => onNavigate("about")} type="button"><Icon name="info" /><span><strong>About FlashGuard</strong><small>Purpose and prototype limits</small></span><Icon name="chevron" size={16} /></button>
            </nav>
          </>
        )}

        {page === "settings" && (
          <div className="settings-page">
            <section>
              <span className="section-kicker">GENERAL PROTECTION</span>
              <div className="settings-toggle"><div><strong>Enable FlashGuard</strong><p>{protection ? "Active and monitoring supported videos." : "Off for all websites."}</p></div><Toggle checked={protection} label="Enable FlashGuard" onChange={onToggleProtection} /></div>
              <p className="helper">Protection is normally enabled automatically when Chrome starts.</p>
            </section>
            <section>
              <span className="section-kicker">PROTECTION BEHAVIOR</span>
              <p className="section-intro">Choose how potentially hazardous content is obscured.</p>
              <div className="mode-options">
                {(["Blur", "Dim", "Freeze"] as ProtectionMode[]).map((item) => (
                  <button className={mode === item ? "selected" : ""} key={item} onClick={() => onSetMode(item)} type="button"><span className={`mode-preview mode-preview--${item.toLowerCase()}`} /><span><strong>{item}</strong><small>{item === "Blur" ? "Obscure visual detail" : item === "Dim" ? "Reduce visible intensity" : "Hold a safe static frame"}</small></span><i>{mode === item ? "✓" : ""}</i></button>
                ))}
              </div>
              <p className="proposal-note">Advanced intervention customization is still being evaluated.</p>
            </section>
            <section>
              <div className="row-between"><span className="section-kicker">SENSITIVITY</span><StatusBadge type="neutral">Proposed feature</StatusBadge></div>
              <input aria-label="Detection sensitivity" className="sensitivity" max="2" min="0" onChange={(event) => onSetSensitivity(Number(event.target.value))} step="1" type="range" value={sensitivity} />
              <div className="range-labels"><span>Low</span><strong>Balanced</strong><span>High</span></div>
              <p className="helper">Higher sensitivity may detect more possible risks, but may also increase false positives.</p>
            </section>
            <section>
              <button className="settings-link" onClick={() => onNavigate("whitelist")} type="button"><span><strong>Website management</strong><small>View and edit trusted websites</small></span><Icon name="chevron" size={16} /></button>
            </section>
            <Button className="full-width" onClick={onResetSettings}><Icon name="refresh" size={16} /> Restore default settings</Button>
          </div>
        )}

        {page === "whitelist" && (
          <div className="whitelist-page">
            <div className="current-site-box"><span className="section-kicker">CURRENT WEBSITE</span><div className="row-between"><strong>{DOMAIN}</strong><StatusBadge type={whitelisted ? "off" : "active"}>{whitelisted ? "Excluded" : "Protected"}</StatusBadge></div><p>{whitelisted ? "Protection is disabled on this website because you added it to your whitelist." : "FlashGuard is active on this website."}</p>{whitelisted ? <Button className="full-width" onClick={() => onRemoveSite(DOMAIN)}>Remove and restore protection</Button> : <Button className="full-width" onClick={onAddSite} variant="primary">Add current website</Button>}</div>
            <div className="warning-note"><Icon name="warning" size={17} /><p>Excluded sites will not receive normal FlashGuard intervention. Only add sites you trust.</p></div>
            <section><span className="section-kicker">SAVED EXCEPTIONS · {whitelist.length}</span>{whitelist.length === 0 ? <div className="empty-state"><Icon name="globe" size={24} /><strong>No saved exceptions</strong><p>Websites you trust will appear here.</p></div> : <div className="exception-list">{whitelist.map((domain) => <div key={domain}><span><Icon name="globe" size={16} /><strong>{domain}</strong></span><Button onClick={() => onRemoveSite(domain)} variant="ghost">Remove</Button></div>)}</div>}</section>
          </div>
        )}

        {page === "activity" && (
          <div className="activity-page">
            <div className="activity-header"><p>Recent events explain what FlashGuard checked and which action it took.</p><StatusBadge type={protection ? "active" : "off"}>{protection ? "Protection active" : "Protection off"}</StatusBadge></div>
            <div className="activity-list">{activity.map((item, index) => <article key={`${item.id}-${index}`}><div className="timeline-mark" /><div><small>EVENT {activity.length - index}</small><strong>{item.text}</strong><p>{item.detail}</p></div></article>)}</div>
          </div>
        )}

        {page === "about" && (
          <div className="about-page">
            <div className="about-symbol"><Icon name="shield" size={35} /></div>
            <h3>Browse with more context and control.</h3>
            <p>FlashGuard is an early-stage university prototype exploring how a Chrome extension could reduce exposure to potentially hazardous flashing in accessible HTML5 videos.</p>
            <div className="limitation"><strong>Prototype limitation</strong><p>This demo uses predefined scenarios. It is not a medical device, does not analyze real video, and cannot guarantee seizure prevention.</p></div>
            <p className="version">University of Michigan · EECS 497<br />Interactive prototype · v0.1</p>
          </div>
        )}
      </div>
      <footer className="popup-footer"><span>Prototype simulation</span><span>No real frame analysis</span></footer>
    </aside>
  );
}

function DeveloperPanel({
  open,
  onToggle,
  onRun,
  onRunDisabled,
  onRunWhitelisted,
  onReset,
  scenario,
  protection,
  whitelisted,
  siteProtected,
  statusText,
  mode,
  devLog,
}: {
  open: boolean;
  onToggle: () => void;
  onRun: (scenario: Scenario) => void;
  onRunDisabled: () => void;
  onRunWhitelisted: () => void;
  onReset: () => void;
  scenario: Scenario;
  protection: boolean;
  whitelisted: boolean;
  siteProtected: boolean;
  statusText: string;
  mode: ProtectionMode;
  devLog: string[];
}) {
  const scenarios: { key: Scenario; label: string; tag: string; description: string }[] = [
    { key: "normal", label: "Normal video", tag: "A", description: "No hazardous flashing" },
    { key: "hazard", label: "Hazardous flashing", tag: "B", description: "Apply selected intervention" },
    { key: "cuts", label: "Scene cuts / fades", tag: "C", description: "Avoid a false positive" },
    { key: "unsupported", label: "Unscannable video", tag: "D", description: "Frame access unavailable" },
  ];
  return (
    <section className={`developer-panel ${open ? "open" : ""}`}>
      <button aria-expanded={open} className="developer-heading" onClick={onToggle} type="button">
        <span><span className="code-icon">{"</>"}</span><span><strong>Developer Demo / Test Scenarios</strong><small>Predefined simulations only — no real video analysis</small></span></span>
        <span>{open ? "Collapse ↑" : "Expand ↓"}</span>
      </button>
      {open && (
        <div className="developer-content">
          <div className="scenario-column">
            <div className="panel-label">RUN A TEST SCENARIO</div>
            <div className="scenario-grid">
              {scenarios.map((item) => <button className={scenario === item.key ? "selected" : ""} key={item.key} onClick={() => onRun(item.key)} type="button"><i>{item.tag}</i><span><strong>{item.label}</strong><small>{item.description}</small></span><Icon name="play" size={15} /></button>)}
              <button className={!protection ? "selected" : ""} onClick={onRunDisabled} type="button"><i>E</i><span><strong>Protection disabled</strong><small>Hazard with filtering off</small></span><Icon name="play" size={15} /></button>
              <button className={whitelisted ? "selected" : ""} onClick={onRunWhitelisted} type="button"><i>F</i><span><strong>Whitelisted website</strong><small>Excluded from intervention</small></span><Icon name="play" size={15} /></button>
            </div>
            <Button className="reset-button" onClick={onReset}><Icon name="refresh" size={15} /> Reset demo</Button>
          </div>
          <div className="pipeline-column">
            <div className="panel-label">SIMULATED DETECTION PIPELINE</div>
            <div className="pipeline">
              {["Find video", "Sample frames", "Compare changes", "Classify", "Respond"].map((step, index) => <div className={scenario !== "idle" && index <= (scenario === "unsupported" ? 1 : 4) ? "complete" : ""} key={step}><i>{index + 1}</i><span>{step}</span>{index < 4 && <b>→</b>}</div>)}
            </div>
            <div className="state-readout">
              <div><span>Global protection</span><strong>{protection ? "Enabled" : "Disabled"}</strong></div>
              <div><span>Current site</span><strong>{whitelisted ? "Whitelisted" : siteProtected ? "Protected" : "Unprotected"}</strong></div>
              <div><span>Intervention</span><strong>{mode}</strong></div>
              <div><span>System state</span><strong>{statusText}</strong></div>
            </div>
            <div className="dev-log"><div><span>SIMULATED STATE LOG</span><small>Newest first</small></div><ol>{devLog.slice(0, 5).map((line, index) => <li key={`${line}-${index}`}><code>{String(index + 1).padStart(2, "0")}</code><span>{line}</span></li>)}</ol></div>
          </div>
          <div className="targets-column">
            <div className="panel-label">PROJECT TARGETS · NOT YET MEASURED</div>
            <div className="target-list">
              <div><span>Hazardous flash detection</span><strong>≥95% <small>target</small></strong></div>
              <div><span>False positive rate</span><strong>≤10% <small>pending confirmation</small></strong></div>
              <div><span>Detection + response</span><strong>≤250ms <small>target</small></strong></div>
              <div><span>Website compatibility</span><strong>≥90% <small>target</small></strong></div>
              <div><span>Undetectable content</span><strong>User notified</strong></div>
            </div>
            <p className="target-note">Planned evaluation: ~40 hazardous cases, ~40 nonhazardous cases, and 20 example websites. The team is investigating gaps in NeuroShield through controlled comparison tests; no benchmark results are claimed.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function PeerReviewGuide({ onStart }: { onStart: () => void }) {
  const tasks = [
    ["01", "Check protection", "Find out whether FlashGuard is active."],
    ["02", "Trigger an intervention", "Run the hazardous-video example and explain what happened."],
    ["03", "Change behavior", "Switch the protection behavior to Dim or Freeze."],
    ["04", "Manage an exception", "Whitelist the example site, then restore protection."],
    ["05", "Explore a limitation", "Run the unscannable-video scenario and interpret the message."],
  ];
  return (
    <section className="review-guide">
      <div className="guide-intro">
        <span className="section-kicker">PEER REVIEW · 10–15 MINUTES</span>
        <h2>Help us test whether FlashGuard feels clear, predictable, and safe.</h2>
        <p>Complete the tasks without presenter guidance. Think aloud about what you expect before each click and whether the outcome matches that expectation.</p>
        <Button onClick={onStart} variant="primary">Open demo workspace <span>→</span></Button>
      </div>
      <div className="guide-content">
        <section>
          <div className="guide-heading"><span>PART 1</span><h3>Reviewer tasks</h3></div>
          <div className="task-list">{tasks.map(([number, title, description]) => <article key={number}><i>{number}</i><div><strong>{title}</strong><p>{description}</p></div><span>□</span></article>)}</div>
        </section>
        <section>
          <div className="guide-heading"><span>PART 2</span><h3>Discussion prompts</h3></div>
          <ul className="question-list">
            <li>Is the extension easy to understand without instructions?</li>
            <li>Is the browser popup easy to navigate?</li>
            <li>Is the hazardous-content warning clear?</li>
            <li>Is it clear what “Show anyway” will do?</li>
            <li>Is protection state obvious when disabled or unavailable?</li>
            <li>Do settings and whitelist controls make sense?</li>
            <li>Did you encounter accessibility barriers or confusing steps?</li>
            <li>Does the prototype communicate the project’s main purpose?</li>
          </ul>
          <div className="review-note"><Icon name="info" size={18} /><p><strong>Reminder:</strong> This is a workflow prototype using safe, static placeholders. It does not analyze real videos and is not a clinically validated medical product.</p></div>
        </section>
      </div>
    </section>
  );
}
