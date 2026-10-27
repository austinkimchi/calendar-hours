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
    active.button.setAttribute("aria-expanded", "false");
    active = null;
  }
  function position() {
    if (!active) return;
    const {button, panel} = active;
    const anchor = button.getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    const margin = 16;
    const left = Math.max(margin, Math.min(anchor.left, innerWidth - box.width - margin));
    const below = anchor.bottom + 8;
    const top = below + box.height <= innerHeight - margin ? below : Math.max(margin, anchor.top - box.height - 8);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }
  function show(button, panel) {
    cancelClose();
    if (active?.button === button && !panel.hidden) return;
    close();
    active = {button, panel};
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    position();
  }
  function scheduleClose() {
    cancelClose();
    closeTimer = setTimeout(() => {
      if (!active) return;
      const {button, panel} = active;
      if (button.matches(":hover") || panel.matches(":hover") || document.activeElement === button) return;
      close();
    }, 150);
  }
  for (const button of document.querySelectorAll(".info-button[aria-controls]")) {
    const panel = document.getElementById(button.getAttribute("aria-controls"));
    if (!panel) continue;
    button.setAttribute("aria-describedby", panel.id);
    panel.setAttribute("role", "tooltip");
    button.addEventListener("mouseenter", () => show(button, panel));
    button.addEventListener("focus", () => show(button, panel));
    button.addEventListener("mouseleave", scheduleClose);
    button.addEventListener("blur", scheduleClose);
    panel.addEventListener("mouseenter", cancelClose);
    panel.addEventListener("mouseleave", scheduleClose);
    button.addEventListener("click", () => {
      // A first tap focuses the button before click. Keep that tooltip open;
      // a second tap dismisses it. Hover and keyboard focus need no click.
      if (active?.button === button && active.tapped) close();
      else { show(button, panel); active.tapped = true; }
    });
  }
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") close();
  });
  document.addEventListener("click", event => {
    if (active && !active.button.contains(event.target) && !active.panel.contains(event.target)) close();
  });
  window.addEventListener("resize", position);
  window.addEventListener("scroll", position, true);
})();
