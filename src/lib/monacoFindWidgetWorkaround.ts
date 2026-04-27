/**
 * Monaco Find Widget tooltip flicker workaround.
 *
 * Upstream context:
 * - https://github.com/microsoft/monaco-editor/issues/5177
 * - https://github.com/microsoft/monaco-editor/issues/5208
 *
 * In some embeddings, hovering buttons in the find widget (Close / Find in Selection)
 * triggers a tooltip that becomes multi-line and overlaps the button, causing a hover
 * enter/leave loop (flicker) and making the button unclickable.
 *
 * This helper:
 * - Removes native `title` tooltips within `.find-widget`
 * - Toggles `body.find-widget-open` while the widget is visible so CSS can apply scoped fixes
 */
export function installMonacoFindWidgetWorkaround(root: HTMLElement): () => void {
  const stripTitlesInFindWidget = () => {
    const fw = root.querySelector(".find-widget");
    if (!fw) return;
    if (fw.hasAttribute("title")) fw.removeAttribute("title");
    fw.querySelectorAll("[title]").forEach((el) => {
      el.removeAttribute("title");
    });
  };

  const setFindOpenClass = () => {
    const open = !!root.querySelector(".find-widget.visible");
    document.body.classList.toggle("find-widget-open", open);
  };

  const stripTitlesFromTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return;
    const fw = target.closest(".find-widget");
    if (!fw) return;
    if (target.hasAttribute("title")) target.removeAttribute("title");
    let p: Element | null = target.parentElement;
    while (p && p !== fw.parentElement) {
      if (p.hasAttribute("title")) p.removeAttribute("title");
      if (p === fw) break;
      p = p.parentElement;
    }
  };

  const onMouseOverCapture = (e: Event) => {
    stripTitlesFromTarget(e.target);
    stripTitlesInFindWidget();
  };
  const onFocusInCapture = (e: Event) => {
    stripTitlesFromTarget(e.target);
    stripTitlesInFindWidget();
  };
  const onMouseMoveCapture = (e: Event) => {
    // More reliable than mouseover: keeps titles suppressed while hovering.
    stripTitlesFromTarget(e.target);
    stripTitlesInFindWidget();
    // Keep body class in sync even if visibility toggles without title mutations.
    setFindOpenClass();
  };

  const isFindWidgetMutation = (m: MutationRecord) => {
    if (!(m.target instanceof Element)) return false;
    // Find widget becomes visible by toggling a class; capture that.
    if (m.type === "attributes" && m.attributeName === "class") {
      return (
        m.target.classList.contains("find-widget") ||
        !!m.target.closest(".find-widget")
      );
    }
    if (m.target.closest(".find-widget")) return true;
    if (m.type !== "childList") return false;
    for (const n of m.addedNodes) {
      if (!(n instanceof Element)) continue;
      if (n.classList.contains("find-widget") || n.querySelector(".find-widget")) {
        return true;
      }
    }
    return false;
  };

  stripTitlesInFindWidget();
  setFindOpenClass();

  const mo = new MutationObserver((records) => {
    if (records.some(isFindWidgetMutation)) {
      stripTitlesInFindWidget();
      setFindOpenClass();
    }
  });
  mo.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["title", "class"],
  });

  root.addEventListener("mouseover", onMouseOverCapture, true);
  root.addEventListener("focusin", onFocusInCapture, true);
  root.addEventListener("mousemove", onMouseMoveCapture, true);

  return () => {
    mo.disconnect();
    root.removeEventListener("mouseover", onMouseOverCapture, true);
    root.removeEventListener("focusin", onFocusInCapture, true);
    root.removeEventListener("mousemove", onMouseMoveCapture, true);
    document.body.classList.remove("find-widget-open");
  };
}

