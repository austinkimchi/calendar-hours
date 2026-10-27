/* Floating help on hover or keyboard focus, with tap support. */
(function () {
  "use strict";
  let active = null;
  let closeTimer = null;
  const cancelClose = () => { clearTimeout(closeTimer); };
  function close() {
    cancelClose();
    if (!active) return;
    active.panel.hidden = true;
    if (active.trigger.matches(".info-button")) active.trigger.setAttribute("aria-expanded", "false");
    active = null;
  }
  function position() {
    if (!active) return;
    const {trigger, panel} = active;
    const anchor = trigger.getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    const margin = 16;
    const left = Math.max(margin, Math.min(anchor.left, innerWidth - box.width - margin));
    const below = anchor.bottom + 8;
    const top = below + box.height <= innerHeight - margin ? below : Math.max(margin, anchor.top - box.height - 8);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }
  function show(trigger, panel, focusTarget) {
    cancelClose();
    if (active?.trigger === trigger && !panel.hidden) return;
    close();
    active = {trigger, panel, focusTarget};
    panel.hidden = false;
    if (trigger.matches(".info-button")) trigger.setAttribute("aria-expanded", "true");
    position();
  }
  function scheduleClose() {
    cancelClose();
    closeTimer = setTimeout(() => {
      if (!active) return;
      const {trigger, panel, focusTarget} = active;
      if (trigger.matches(":hover") || panel.matches(":hover") || document.activeElement === focusTarget) return;
      close();
    }, 150);
  }
  for (const trigger of document.querySelectorAll(".info-button[aria-controls], .help-label[data-help]")) {
    const panel = document.getElementById(trigger.getAttribute("aria-controls") || trigger.dataset.help);
    if (!panel) continue;
    // Labels keep their normal focus/toggle behavior. Reuse the associated
    // control for keyboard help instead of adding another stop to the form.
    const focusTarget = trigger.control || trigger;
    for (const element of new Set([trigger, focusTarget])) {
      const descriptions = new Set((element.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
      descriptions.add(panel.id);
      element.setAttribute("aria-describedby", [...descriptions].join(" "));
    }
    panel.setAttribute("role", "tooltip");
    trigger.addEventListener("mouseenter", () => show(trigger, panel, focusTarget));
    focusTarget.addEventListener("focus", () => show(trigger, panel, focusTarget));
    trigger.addEventListener("mouseleave", scheduleClose);
    focusTarget.addEventListener("blur", scheduleClose);
    panel.addEventListener("mouseenter", cancelClose);
    panel.addEventListener("mouseleave", scheduleClose);
    if (trigger.matches(".info-button")) trigger.addEventListener("click", () => {
      // A first tap focuses the button before click. Keep that tooltip open;
      // a second tap dismisses it. Hover and keyboard focus need no click.
      if (active?.trigger === trigger && active.tapped) close();
      else { show(trigger, panel, focusTarget); active.tapped = true; }
    });
  }
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") close();
  });
  document.addEventListener("click", event => {
    if (active && !active.trigger.contains(event.target) && !active.focusTarget.contains(event.target) && !active.panel.contains(event.target)) close();
  });
  window.addEventListener("resize", position);
  window.addEventListener("scroll", position, true);
})();
