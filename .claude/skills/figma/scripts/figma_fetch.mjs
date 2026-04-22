#!/usr/bin/env node

/**
 * Figma REST API — Fetch UI structure tree and rendered images for a given node.
 *
 * Outputs a compact indented tree format with properties directly mappable to CSS.
 *
 * Usage:
 *   node figma_fetch.mjs --url='https://www.figma.com/design/FILE_KEY/NAME?node-id=123-4566'
 *   node figma_fetch.mjs --file-key=FILE_KEY --node-id=123-4566
 *
 * Environment variables:
 *   FIGMA_TOKEN — Figma Personal Access Token (required)
 */

import { parseArgs } from "node:util";

const TOKEN = process.env.FIGMA_TOKEN;
if (!TOKEN) {
  process.stderr.write("Error: FIGMA_TOKEN environment variable is required\n");
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    url: { type: "string" },
    "file-key": { type: "string" },
    "node-id": { type: "string" },
    depth: { type: "string", default: "10" },
  },
  strict: false,
});

// --- Parse arguments ---
let fileKey, nodeId;

if (values.url) {
  const u = new URL(values.url);
  const parts = u.pathname.split("/");
  const idx = parts.findIndex((p) => p === "design" || p === "file");
  if (idx === -1 || !parts[idx + 1]) {
    process.stderr.write("Failed to parse file key from URL\n");
    process.exit(1);
  }
  fileKey = parts[idx + 1];
  nodeId = u.searchParams.get("node-id")?.replaceAll("-", ":");
} else if (values["file-key"]) {
  fileKey = values["file-key"];
  nodeId = values["node-id"];
} else {
  process.stderr.write(
    "Usage:\n" +
      "  node figma_fetch.mjs --url='<figma-url>'\n" +
      "  node figma_fetch.mjs --file-key=<key> --node-id=<id>\n"
  );
  process.exit(1);
}

const depth = parseInt(values.depth, 10);

// --- API ---
const headers = { "X-FIGMA-TOKEN": TOKEN };

async function apiFetch(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Figma API ${res.status}: ${text}`);
  }
  return res.json();
}

// 1. Fetch node data
const nodesUrl = nodeId
  ? `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeId}&depth=${depth}`
  : `https://api.figma.com/v1/files/${fileKey}?depth=${depth}`;

process.stderr.write(`Fetching node data...\n`);
const nodesData = await apiFetch(nodesUrl);

// 2. Fetch rendered image
let imageUrl = null;
if (nodeId) {
  try {
    process.stderr.write(`Fetching rendered image...\n`);
    const imgData = await apiFetch(
      `https://api.figma.com/v1/images/${fileKey}?ids=${nodeId}&format=png&scale=2`
    );
    imageUrl = imgData.images?.[nodeId] ?? null;
  } catch (e) {
    process.stderr.write(`Failed to fetch image: ${e.message}\n`);
  }
}

// 3. Extract components map
const componentsMap = nodeId
  ? nodesData.nodes?.[nodeId]?.components ?? {}
  : {};

// --- Formatting helpers ---

function hexColor(c, alpha) {
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  if (alpha != null && alpha < 1) {
    const a = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, "0");
    return hex + a;
  }
  return hex;
}

function fmtPadding(node) {
  const t = node.paddingTop ?? 0;
  const r = node.paddingRight ?? 0;
  const b = node.paddingBottom ?? 0;
  const l = node.paddingLeft ?? 0;
  if (t === 0 && r === 0 && b === 0 && l === 0) return null;
  if (t === r && r === b && b === l) return `p:${t}`;
  if (t === b && l === r) return `p:${t},${r}`;
  return `p:${t},${r},${b},${l}`;
}

function fmtSize(node) {
  const parts = [];
  const wMode = node.layoutSizingHorizontal;
  const hMode = node.layoutSizingVertical;
  if (wMode === "FILL") parts.push("w:FILL");
  else if (wMode === "HUG") parts.push("w:HUG");
  else if (node.absoluteBoundingBox) parts.push(`w:${Math.round(node.absoluteBoundingBox.width)}`);

  if (hMode === "FILL") parts.push("h:FILL");
  else if (hMode === "HUG") parts.push("h:HUG");
  else if (node.absoluteBoundingBox) parts.push(`h:${Math.round(node.absoluteBoundingBox.height)}`);

  return parts;
}

function fmtFills(fills) {
  if (!fills?.length) return [];
  const parts = [];
  for (const f of fills) {
    if (f.visible === false) continue;
    if (f.type === "SOLID") {
      parts.push(`bg:${hexColor(f.color, f.opacity)}`);
    } else if (f.type === "GRADIENT_LINEAR" && f.gradientStops?.length) {
      const stops = f.gradientStops.map((s) => hexColor(s.color, s.color.a)).join(",");
      parts.push(`bg:linear(${stops})`);
    } else if (f.type === "GRADIENT_RADIAL" && f.gradientStops?.length) {
      const stops = f.gradientStops.map((s) => hexColor(s.color, s.color.a)).join(",");
      parts.push(`bg:radial(${stops})`);
    } else if (f.type === "IMAGE") {
      parts.push("bg:image");
    }
  }
  return parts;
}

function fmtEffects(effects) {
  if (!effects?.length) return [];
  const parts = [];
  for (const e of effects) {
    if (e.visible === false) continue;
    if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
      const prefix = e.type === "INNER_SHADOW" ? "inset-shadow" : "shadow";
      const x = Math.round(e.offset?.x ?? 0);
      const y = Math.round(e.offset?.y ?? 0);
      const blur = Math.round(e.radius ?? 0);
      const spread = Math.round(e.spread ?? 0);
      const color = e.color ? hexColor(e.color, e.color.a) : "#000";
      parts.push(`${prefix}:${x},${y},${blur},${spread},${color}`);
    } else if (e.type === "LAYER_BLUR") {
      parts.push(`blur:${Math.round(e.radius ?? 0)}`);
    } else if (e.type === "BACKGROUND_BLUR") {
      parts.push(`bg-blur:${Math.round(e.radius ?? 0)}`);
    }
  }
  return parts;
}

function fmtRadius(node) {
  const radii = node.rectangleCornerRadii;
  if (radii) {
    const [tl, tr, br, bl] = radii.map(Math.round);
    if (tl === tr && tr === br && br === bl) {
      return tl > 0 ? `radius:${tl}` : null;
    }
    return `radius:${tl},${tr},${br},${bl}`;
  }
  if (node.cornerRadius) return `radius:${Math.round(node.cornerRadius)}`;
  return null;
}

function fmtStroke(node) {
  if (!node.strokes?.length) return null;
  const visible = node.strokes.filter((s) => s.visible !== false && s.type === "SOLID");
  if (!visible.length) return null;
  const s = visible[0];
  const w = node.strokeWeight ?? 1;
  return `border:${w},${hexColor(s.color, s.opacity)}`;
}

function fmtLayout(node) {
  const parts = [];
  if (node.layoutMode === "HORIZONTAL") parts.push("flex:row");
  else if (node.layoutMode === "VERTICAL") parts.push("flex:col");
  else return parts;

  // justify (primaryAxisAlignItems)
  const justifyMap = {
    MIN: "start",
    CENTER: "center",
    MAX: "end",
    SPACE_BETWEEN: "between",
  };
  if (node.primaryAxisAlignItems && node.primaryAxisAlignItems !== "MIN") {
    parts.push(`justify:${justifyMap[node.primaryAxisAlignItems] ?? node.primaryAxisAlignItems}`);
  }

  // items (counterAxisAlignItems)
  const itemsMap = { MIN: "start", CENTER: "center", MAX: "end", BASELINE: "baseline" };
  if (node.counterAxisAlignItems && node.counterAxisAlignItems !== "MIN") {
    parts.push(`items:${itemsMap[node.counterAxisAlignItems] ?? node.counterAxisAlignItems}`);
  }

  if (node.itemSpacing) parts.push(`gap:${node.itemSpacing}`);
  if (node.layoutWrap === "WRAP") parts.push("wrap");

  return parts;
}

function fmtText(node) {
  const s = node.style;
  if (!s) return [];
  const parts = [];
  const font = [s.fontFamily, s.fontSize, s.fontWeight].filter(Boolean).join("/");
  if (font) parts.push(`font:${font}`);

  // text color from fills
  if (node.fills?.length) {
    const solid = node.fills.find((f) => f.type === "SOLID" && f.visible !== false);
    if (solid) parts.push(`color:${hexColor(solid.color, solid.opacity)}`);
  }

  if (s.textAlignHorizontal && s.textAlignHorizontal !== "LEFT") {
    parts.push(`align:${s.textAlignHorizontal.toLowerCase()}`);
  }
  if (s.lineHeightPx) parts.push(`lh:${Math.round(s.lineHeightPx)}`);
  if (s.letterSpacing && s.letterSpacing !== 0) parts.push(`ls:${s.letterSpacing}`);
  if (s.textDecoration && s.textDecoration !== "NONE") {
    parts.push(`decoration:${s.textDecoration.toLowerCase()}`);
  }
  if (s.textCase && s.textCase !== "ORIGINAL") {
    parts.push(`case:${s.textCase.toLowerCase()}`);
  }
  return parts;
}

// --- Render node tree ---
const lines = [];

function renderNode(node, indent = 0) {
  // Skip invisible nodes
  if (node.visible === false) return;

  const type = node.type || "UNKNOWN";
  const prefix = "  ".repeat(indent);
  const attrs = [];

  // Component name (INSTANCE)
  let componentLabel = "";
  if (type === "INSTANCE" && node.componentId) {
    const comp = componentsMap[node.componentId];
    if (comp?.name) componentLabel = ` (${comp.name})`;
  }

  // Size
  attrs.push(...fmtSize(node));

  // Fills
  if (type !== "TEXT") {
    attrs.push(...fmtFills(node.fills));
  }

  // Border radius
  const radius = fmtRadius(node);
  if (radius) attrs.push(radius);

  // Stroke
  const stroke = fmtStroke(node);
  if (stroke) attrs.push(stroke);

  // Shadow/blur
  attrs.push(...fmtEffects(node.effects));

  // Layout
  attrs.push(...fmtLayout(node));

  // Padding
  const padding = fmtPadding(node);
  if (padding) attrs.push(padding);

  // grow
  if (node.layoutGrow === 1) attrs.push("grow:1");

  // opacity
  if (node.opacity != null && node.opacity < 1) {
    attrs.push(`opacity:${node.opacity}`);
  }

  // clip
  if (node.clipsContent) attrs.push("clip");

  // Text properties
  if (type === "TEXT") {
    attrs.push(...fmtText(node));
  }

  // Node name
  const name = node.name ? `"${node.name}"` : "";
  const characters = type === "TEXT" && node.characters ? ` "${node.characters}"` : "";

  const attrStr = attrs.length ? " " + attrs.join(" ") : "";
  lines.push(`${prefix}[${type}] ${name}${componentLabel}${characters}${attrStr}`);

  // Recurse children
  if (node.children) {
    for (const child of node.children) {
      renderNode(child, indent + 1);
    }
  }
}

// --- Output ---
const fileName = nodesData.name || fileKey;

if (imageUrl) {
  lines.push(`IMAGE: ${imageUrl}`);
  lines.push("");
}

lines.push(`FILE: ${fileName}`);
lines.push("");

if (nodeId) {
  const nodeData = nodesData.nodes?.[nodeId];
  if (nodeData?.document) {
    renderNode(nodeData.document);
  } else {
    lines.push("Specified node not found.");
  }
} else {
  if (nodesData.document) {
    renderNode(nodesData.document);
  }
}

console.log(lines.join("\n"));

// --- Print raw Figma API data ---
// console.log("\n\n--- RAW FIGMA DATA ---\n");
// console.log(JSON.stringify(nodesData, null, 2));
