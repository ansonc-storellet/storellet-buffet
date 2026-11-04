// Presentational only. Scoring and the extra bite stay in the game controller.
const DURATION = 6600;
const REDUCED_DURATION = 3400;
const REVEALS = [0, 2000, 3800];

export function createAwakening(screen, skip) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const panels = [...screen.querySelectorAll("[data-wake-panel]")];
  const title = screen.querySelector("#wakeCause");
  const taste = screen.querySelector("#wakeTasteLine");
  const foodArt = screen.querySelector("#wakeFoodArt");
  const diner = screen.querySelector("#wakeDiner");
  const reward = screen.querySelector("#wakeReward");
  let playing = null;

  return function show({ food, foods = food ? [food] : [], preview = false, bonusMoves = 1, thumbnail } = {}) {
    if (playing) return playing;
    if (document.hidden) return Promise.resolve();

    const name = food?.name || "至愛美食";
    const drink = food?.category === "drink";
    const kind = drink ? (food.temperature === "hot" ? "hot" : "cold") : "eat";
    const verb = drink ? "飲" : "食";
    const duration = reduced.matches ? REDUCED_DURATION : DURATION;
    screen.dataset.food = food?.id || "";
    screen.dataset.category = drink ? "drink" : "food";
    screen.dataset.kind = kind;
    screen.dataset.temperature = food?.temperature || "ambient";
    screen.dataset.preview = String(preview);
    screen.dataset.reduced = String(reduced.matches);
    screen.dataset.stage = "0";
    screen.style.setProperty("--wake-duration", `${duration}ms`);
    screen.setAttribute("aria-label", `Storellet仔${verb}到至愛${name}，用埋 Storellet 優惠，幸福爆燈`);
    if (title) title.textContent = name;
    if (taste) {
      const foodName = document.createElement("b");
      foodName.textContent = name;
      taste.replaceChildren(document.createTextNode(`我真係好鍾意${verb}`), document.createElement("br"), foodName, document.createTextNode("呀！"));
    }
    if (foodArt) foodArt.replaceChildren(...(thumbnail ? [thumbnail] : []));
    if (diner) diner.src = `assets/wake-${kind}.webp`;
    if (reward) reward.textContent = preview ? "幸福爆燈預覽" : `幸福爆燈 · 獎勵 ${bonusMoves} 啖`;
    // Keep all triggering favourites available to accessible inspection, without
    // adding crowded copy to the comic or pretending they are the pictured food.
    screen.dataset.foods = foods.map(entry => entry.id).join(",");
    for (const panel of panels) {
      panel.dataset.shown = "false";
      panel.setAttribute("aria-hidden", "true");
    }

    const focus = document.activeElement;
    const behind = [...screen.parentElement.children].filter(node => node !== screen && node.id !== "live" && !node.inert);
    screen.hidden = false;
    screen.setAttribute("aria-hidden", "false");
    for (const node of behind) node.inert = true;
    skip.focus({ preventScroll: true });

    playing = new Promise(resolve => {
      let finished = false;
      const timers = [];
      const capture = { capture: true };
      function reveal(index) {
        if (finished) return;
        screen.dataset.stage = String(index + 1);
        const panel = panels[index];
        if (panel) {
          panel.dataset.shown = "true";
          panel.setAttribute("aria-hidden", "false");
        }
      }
      function finish() {
        if (finished) return;
        finished = true;
        for (const timer of timers) clearTimeout(timer);
        skip.removeEventListener("click", finish);
        document.removeEventListener("keydown", keyboard, capture);
        document.removeEventListener("visibilitychange", visibility);
        window.removeEventListener("pagehide", finish);
        screen.hidden = true;
        screen.setAttribute("aria-hidden", "true");
        for (const node of behind) node.inert = false;
        if (focus?.isConnected && !focus.disabled && !focus.inert) focus.focus({ preventScroll: true });
        playing = null;
        resolve();
      }
      function keyboard(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          finish();
        } else if (event.key === "Tab") {
          // Skip is the only interactive control in this short automatic scene.
          event.preventDefault();
          skip.focus({ preventScroll: true });
        }
      }
      function visibility() { if (document.hidden) finish(); }
      skip.addEventListener("click", finish);
      document.addEventListener("keydown", keyboard, capture);
      document.addEventListener("visibilitychange", visibility);
      window.addEventListener("pagehide", finish);
      if (reduced.matches) {
        panels.forEach((_, index) => reveal(index));
      } else {
        reveal(0);
        REVEALS.slice(1).forEach((delay, index) => timers.push(setTimeout(() => reveal(index + 1), delay)));
      }
      timers.push(setTimeout(finish, duration));
    });
    return playing;
  };
}
