(() => {
  const SOURCE_ID = "xmlui-virtual-source";
  const SOURCE_URL = "Main.xmlui";

  const normalizeContent = (content) => (content == null ? "" : String(content));

  const sanitizeContent = (content) => content.replace(/\*\//g, "* /");

  window.registerXmluiSource = (content) => {
    const text = sanitizeContent(normalizeContent(content));
    const existing = document.getElementById(SOURCE_ID);
    if (existing) {
      existing.remove();
    }

    const script = document.createElement("script");
    script.id = SOURCE_ID;
    script.type = "application/javascript";
    script.textContent = `/*\n${text}\n*/\n//# sourceURL=${SOURCE_URL}\n`;
    document.head.appendChild(script);
  };
})();
