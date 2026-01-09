// Playground parser for xmlui-pg codefences
// Extracted from /Users/jonudell/xmlui/xmlui/src/components/Markdown/utils.ts

// Base64 encoding utilities
function uint8ArrayToBase64(bytes) {
  const base64abc = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
    "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
    "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "/"
  ];

  let result = '';
  let i;
  const l = bytes.length;

  for (i = 2; i < l; i += 3) {
    result += base64abc[bytes[i - 2] >> 2];
    result += base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
    result += base64abc[((bytes[i - 1] & 0x0f) << 2) | (bytes[i] >> 6)];
    result += base64abc[bytes[i] & 0x3f];
  }

  if (i === l + 1) {
    result += base64abc[bytes[i - 2] >> 2];
    result += base64abc[(bytes[i - 2] & 0x03) << 4];
    result += "==";
  }

  if (i === l) {
    result += base64abc[bytes[i - 2] >> 2];
    result += base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
    result += base64abc[(bytes[i - 1] & 0x0f) << 2];
    result += "=";
  }

  return result;
}

function encodeToBase64(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const valueToString = typeof value === "object" ? JSON.stringify(value) : value.toString();
  const encoder = new TextEncoder();
  const data = encoder.encode(valueToString);
  return uint8ArrayToBase64(data);
}

function observePlaygroundPattern(content) {
  const startPattern = "```xmlui-pg";
  const endPattern = "```";

  const startIndex = content.indexOf(startPattern);
  if (startIndex === -1) {
    return null;
  }

  const startContentIndex = content.indexOf("\n", startIndex);
  if (startContentIndex === -1) {
    return null;
  }

  let endIndex = startContentIndex;
  while (endIndex !== -1) {
    endIndex = content.indexOf(endPattern, endIndex + 1);
    if (endIndex !== -1) {
      const precedingChar = content[endIndex - 1];
      if (precedingChar !== "\\") {
        return [
          startIndex,
          endIndex + endPattern.length,
          content.substring(startIndex, endIndex + endPattern.length),
        ];
      }
    }
  }

  return null;
}

function parseSegmentProps(input) {
  const segment = {};

  if (/\bdisplay\b/.test(input)) {
    segment.display = true;
  }
  if (/\bcopy\b/.test(input)) {
    segment.copy = true;
  }
  if (/\bnoPopup\b/.test(input)) {
    segment.noPopup = true;
  }
  if (/\bnoFrame\b/.test(input)) {
    segment.noFrame = true;
  }
  if (/\bimmediate\b/.test(input)) {
    segment.immediate = true;
  }
  if (/\bwithSplashScreen\b/.test(input)) {
    segment.withSplashScreen = true;
  }
  if (/\bnoHeader\b/.test(input)) {
    segment.noHeader = true;
  }
  if (/\bsplitView\b/.test(input)) {
    segment.splitView = true;
  }
  if (/\binitiallyShowCode\b/.test(input)) {
    segment.initiallyShowCode = true;
  }

  const highlightsMatch = input.match(/\{([^\}]+)\}/);
  if (highlightsMatch) {
    const highlights = highlightsMatch[1].split(",").map((range) => {
      if (range.includes("-")) {
        const [start, end] = range.split("-").map(Number);
        return [start, end];
      }
      return Number(range);
    });
    segment.highlights = highlights;
  }

  const filenameMatch = input.match(/\bfilename="([^"]+)"/);
  if (filenameMatch) {
    segment.filename = filenameMatch[1];
  }

  const nameMatch = input.match(/\bname="([^"]+)"/);
  if (nameMatch) {
    segment.name = nameMatch[1];
  }

  const heightMatch = input.match(/\bheight="([^"]+)"/);
  if (heightMatch) {
    segment.height = heightMatch[1];
  }

  const popOutUrlMatch = input.match(/\bpopOutUrl="([^"]+)"/);
  if (popOutUrlMatch) {
    segment.popOutUrl = popOutUrlMatch[1];
  }

  const patternMatches = input.match(/\/([^\/]+)\//g);
  if (patternMatches) {
    segment.patterns = patternMatches.map((pattern) =>
      pattern.substring(1, pattern.length - 1),
    );
  }

  const borderedPatternMatches = input.match(/!\/(.[^\/]+)\//g);
  if (borderedPatternMatches) {
    segment.borderedPatterns = borderedPatternMatches.map((pattern) =>
      pattern.substring(2, pattern.length - 1),
    );
  }

  return segment;
}

function extractAppAttributes(appContent) {
  if (!appContent) return {};

  const result = {};
  const appTagMatch = appContent.match(/<App\s+([^>]+)>/);
  if (!appTagMatch) return result;

  const attributes = appTagMatch[1];

  const toneMatch = attributes.match(/defaultTone=["']?([^"'\s/>]+)["']?/);
  if (toneMatch) {
    result.defaultTone = toneMatch[1];
  }

  const themeMatch = attributes.match(/defaultTheme=["']?([^"'\s/>]+)["']?/);
  if (themeMatch) {
    result.defaultTheme = themeMatch[1];
  }

  return result;
}

function parsePlaygroundPattern(content) {
  const pattern = {};
  const match = observePlaygroundPattern(content);

  if (!match) {
    return pattern;
  }

  const [_startIndex, _endIndex, patternContent] = match;
  const lines = patternContent.split("\n");
  pattern.default = parseSegmentProps(lines[0].trim());

  let segmentContent = "";
  let currentMode = "";
  let foundSegment = false;
  let order = 0;

  for (let i = 1; i < lines.length - 1; i++) {
    const line = lines[i];
    if (line.startsWith("---app")) {
      const appSegment = parseSegmentProps(line);
      pattern.app = { ...appSegment };
      closeCurrentMode("app");
    } else if (line.startsWith("---comp")) {
      closeCurrentMode("comp");
      const compSegment = parseSegmentProps(line);
      pattern.components = pattern.components || [];
      pattern.components.push(compSegment);
    } else if (line.startsWith("---config")) {
      const configSegment = parseSegmentProps(line);
      pattern.config = pattern.config || { ...configSegment };
      closeCurrentMode("config");
    } else if (line.startsWith("---api")) {
      const apiSegment = parseSegmentProps(line);
      pattern.api = pattern.api || { ...apiSegment };
      closeCurrentMode("api");
    } else if (line.startsWith("---desc")) {
      closeCurrentMode("desc");
      const descSegment = parseSegmentProps(line);
      pattern.descriptions = pattern.descriptions || [];
      pattern.descriptions.push(descSegment);
    } else {
      segmentContent += line + "\n";
    }
  }

  if (foundSegment) {
    closeCurrentMode("");
  } else {
    pattern.app = {
      ...pattern.default,
      content: segmentContent,
      order,
    };
  }

  return pattern;

  function closeCurrentMode(newMode) {
    foundSegment = true;
    switch (currentMode) {
      case "app":
        pattern.app.content = segmentContent;
        pattern.app.order = order++;
        break;
      case "comp":
        pattern.components[pattern.components.length - 1].content = segmentContent;
        pattern.components[pattern.components.length - 1].order = order++;
        break;
      case "config":
        pattern.config.content = segmentContent;
        pattern.config.order = order++;
        break;
      case "api":
        pattern.api.content = segmentContent;
        pattern.api.order = order++;
        break;
      case "desc":
        pattern.descriptions[pattern.descriptions.length - 1].content = segmentContent;
        pattern.descriptions[pattern.descriptions.length - 1].order = order++;
        break;
    }
    segmentContent = "";
    currentMode = newMode;
  }
}

function convertPlaygroundPatternToMarkdown(content) {
  const pattern = parsePlaygroundPattern(content);

  let maxOrder = 0;
  if (pattern.app?.order > maxOrder) {
    maxOrder = pattern.app.order;
  }
  if (pattern.config?.order > maxOrder) {
    maxOrder = pattern.config.order;
  }
  if (pattern.api?.order > maxOrder) {
    maxOrder = pattern.api.order;
  }
  if (pattern.descriptions) {
    pattern.descriptions.forEach((desc) => {
      if (desc.order > maxOrder) {
        maxOrder = desc.order;
      }
    });
  }
  if (pattern.components) {
    pattern.components.forEach((comp) => {
      if (comp.order > maxOrder) {
        maxOrder = comp.order;
      }
    });
  }

  let markdownContent = "";
  const pgContent = {
    noPopup: pattern.default?.noPopup,
    noFrame: pattern.default?.noFrame,
    noHeader: pattern.default?.noHeader,
    splitView: pattern.default?.splitView,
    initiallyShowCode: pattern.default?.initiallyShowCode,
    popOutUrl: pattern.default?.popOutUrl,
    immediate: pattern.default?.immediate,
    withSplashScreen: pattern.default?.withSplashScreen,
  };

  if (pattern.default.height) {
    pgContent.height = pattern.default.height;
  }
  if (pattern.default.name) {
    pgContent.name = pattern.default.name;
  }
  if (pattern.default.popOutUrl) {
    pgContent.popOutUrl = pattern.default.popOutUrl;
  }

  for (let i = 0; i <= maxOrder; i++) {
    let segment;
    let type = "";
    if (pattern.app?.order === i) {
      segment = pattern.app;
      type = "app";
    } else if (pattern.config?.order === i) {
      segment = pattern.config;
      type = "config";
    } else if (pattern.api?.order === i) {
      segment = pattern.api;
      type = "api";
    }
    if (!segment && pattern.descriptions) {
      const descSegment = pattern.descriptions.find((desc) => desc.order === i);
      if (descSegment) {
        segment = descSegment;
        type = "desc";
      }
    }
    if (!segment && pattern.components) {
      const compSegment = pattern.components.find((comp) => comp.order === i);
      if (compSegment) {
        segment = compSegment;
        type = "comp";
      }
    }
    if (segment === undefined) {
      continue;
    }

    let segmentAttrs =
      `${segment.copy ? "copy" : ""} ` +
      `${segment.filename ? `filename="${segment.filename}"` : ""} ` +
      `${segment.name ? `name="${segment.name}"` : ""} ` +
      `${segment.popOutUrl ? `popOutUrl="${segment.popOutUrl}"` : ""}`;
    if (segment.highlights && segment.highlights.length > 0) {
      const highlights = segment.highlights
        .map((highlight) =>
          Array.isArray(highlight) ? `${highlight[0]}-${highlight[1]}` : highlight,
        )
        .join(",");
      segmentAttrs += `{${highlights}}`;
    }
    if (segment.patterns && segment.patterns.length > 0) {
      segmentAttrs += " " + segment.patterns.map((p) => `/${p}/`).join(" ");
    }
    if (segment.borderedPatterns && segment.borderedPatterns.length > 0) {
      segmentAttrs += " " + segment.borderedPatterns.map((p) => `!/` + p + `/`).join(" ");
    }
    segmentAttrs = segmentAttrs.trim().replace(/\s+/g, " ");

    switch (type) {
      case "app":
        if (segment.display) {
          markdownContent += "```xmlui " + segmentAttrs + "\n" + segment.content + "```\n\n";
        }
        pgContent.app = segment.content;

        const appAttrs = extractAppAttributes(segment.content);
        if (appAttrs.defaultTone) {
          pgContent.activeTone = appAttrs.defaultTone;
        }
        if (appAttrs.defaultTheme) {
          pgContent.activeTheme = appAttrs.defaultTheme;
        }
        break;
      case "config":
        if (segment.display) {
          markdownContent += "```json " + segmentAttrs + "\n" + segment.content + "```\n\n";
        }
        pgContent.config = segment.content;
        break;
      case "api":
        pgContent.api = segment.content;
        break;
      case "comp":
        if (segment.display) {
          markdownContent += "```xmlui " + segmentAttrs + "\n" + segment.content + "```\n\n";
        }
        pgContent.components = pgContent.components || [];
        pgContent.components.push(segment.content);
        break;
      case "desc":
        markdownContent += segment.content + "\n";
        break;
    }
  }

  const jsonString = JSON.stringify(pgContent);
  const base64ContentString = encodeToBase64(jsonString);
  const base64MarkdownString = encodeToBase64(markdownContent);
  return (
    '<samp data-pg-content="' +
    base64ContentString +
    '" data-pg-markdown="' +
    base64MarkdownString +
    '"></samp>\n\n'
  );
}

// Preprocess markdown content to convert xmlui-pg codefences
function preprocessMarkdown(content) {
  if (!content) return content;

  let result = content;
  let match;

  while ((match = observePlaygroundPattern(result)) !== null) {
    const [startIndex, endIndex, playgroundContent] = match;
    const converted = convertPlaygroundPatternToMarkdown(playgroundContent);
    result = result.substring(0, startIndex) + converted + result.substring(endIndex);
  }

  return result;
}

// Export for use in XMLUI
window.preprocessMarkdown = preprocessMarkdown;
