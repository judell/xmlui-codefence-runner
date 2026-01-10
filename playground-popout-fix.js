(function () {
  "use strict";

  const PLAYGROUND_PREFIX = "https://playground.xmlui.org/#/playground";
  const originalOpen = window.open;

  function uint8ArrayToBase64(bytes) {
    let binary = "";
    const len = bytes.length;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function decompressToString(bytes) {
    if (!("DecompressionStream" in window)) {
      return null;
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const reader = stream.getReader();
    const chunks = [];
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      chunks.push(result.value);
    }
    const blob = new Blob(chunks);
    return await blob.text();
  }

  async function compressString(value) {
    if (!("CompressionStream" in window)) {
      return null;
    }
    const stream = new Blob([value]).stream().pipeThrough(new CompressionStream("gzip"));
    const reader = stream.getReader();
    const chunks = [];
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      chunks.push(result.value);
    }
    const blob = new Blob(chunks);
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
  }

  function tryParseApiString(apiString) {
    if (typeof apiString !== "string") {
      return null;
    }
    try {
      return JSON.parse(apiString.replaceAll("\n", " "));
    } catch (error) {
      console.warn("Failed to parse api string for popout override.", error);
      return null;
    }
  }

  async function rewritePlaygroundUrl(url) {
    if (typeof url !== "string") return url;
    if (!url.startsWith(PLAYGROUND_PREFIX)) return url;

    const hashIndex = url.lastIndexOf("#");
    if (hashIndex === -1 || hashIndex === url.length - 1) return url;

    const encoded = url.slice(hashIndex + 1);
    let decoded;
    try {
      decoded = decodeURIComponent(encoded);
    } catch (error) {
      console.warn("Failed to decode playground payload.", error);
      return url;
    }

    const bytes = base64ToUint8Array(decoded);
    const jsonString = await decompressToString(bytes);
    if (!jsonString) return url;

    let payload;
    try {
      payload = JSON.parse(jsonString);
    } catch (error) {
      console.warn("Failed to parse playground payload.", error);
      return url;
    }

    if (payload?.standalone?.api) {
      if (typeof payload.standalone.api === "string") {
        const apiObj = tryParseApiString(payload.standalone.api);
        if (apiObj) {
          apiObj.useWorker = false;
          payload.standalone.api = JSON.stringify(apiObj);
        }
      } else if (typeof payload.standalone.api === "object") {
        payload.standalone.api.useWorker = false;
      }
    }

    const updatedJson = JSON.stringify(payload);
    const compressed = await compressString(updatedJson);
    if (!compressed) return url;

    const updatedBase64 = uint8ArrayToBase64(compressed);
    return url.slice(0, hashIndex + 1) + encodeURIComponent(updatedBase64);
  }

  window.open = function (url, target, features) {
    if (typeof url !== "string" || !url.startsWith(PLAYGROUND_PREFIX)) {
      return originalOpen.call(window, url, target, features);
    }

    const win = originalOpen.call(window, "about:blank", target, features);
    void (async () => {
      const rewritten = await rewritePlaygroundUrl(url);
      if (win && !win.closed) {
        win.location.href = rewritten;
      } else {
        originalOpen.call(window, rewritten, target, features);
      }
    })();
    return win;
  };
})();
