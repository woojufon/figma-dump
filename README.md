# figma-dump

The most token-efficient and accurate Figma export skill for coding agents.

Export Figma designs as a compact, indented **UI structure tree** with CSS-mappable properties — optimized for LLM context windows. One API call, zero fluff.

[中文文档](./README.zh-CN.md)

## Why

The official Figma MCP integration consumes **4,159,799 tokens** per design fetch, requiring multiple tool calls to coordinate.

`figma-dump` does the same job in **749,008 tokens** — a single call, single script.

> **82% fewer tokens. 5.6× more efficient.**

```
[FRAME] "card" w:361 h:HUG bg:#fff radius:12 shadow:0,2,8,0,#0000001a flex:col p:16 gap:12 clip
  [TEXT] "Title" "Hello" font:Inter/14/500 color:#666 align:center lh:20
  [FRAME] "row" w:FILL h:HUG flex:row justify:between items:center
    [INSTANCE] "btn" (ButtonPrimary) w:HUG h:36 bg:#0066ff radius:8
```

Every property maps 1:1 to CSS. No intermediate JSON. No wasted tokens.

| | Official Figma MCP | figma-dump |
|---|---|---|
| Tokens per fetch | 4,159,799 | 749,008 |
| Tool calls needed | Multiple MCP tools | 1 script call |
| Output format | Raw JSON | CSS-ready tree |
| Token savings | — | **82%** |

Want to compare yourself? Set up the official MCP and try the same design:

```bash
# Claude Code
claude mcp add --transport http figma-remote-mcp https://mcp.figma.com/mcp

# Codex
codex mcp add figma-remote-mcp --url https://mcp.figma.com/mcp
```

## Features

- **Compact tree output** — one node per line, indentation = hierarchy
- **CSS-ready properties** — `flex:row`, `p:16`, `radius:12`, `bg:#fff` — copy straight to code
- **Component awareness** — INSTANCE nodes show their component name: `(ButtonPrimary)`
- **Rendered image** — fetches a 2× PNG screenshot alongside the tree
- **Zero dependencies** — single Node.js script, no install step

## Install

### Claude Code

```bash
# Project-level (current repo only)
git clone https://github.com/anthropics/figma-dump.git .claude/skills/figma

# Global (available in all projects)
git clone https://github.com/anthropics/figma-dump.git ~/.claude/skills/figma
```

### Codex

```bash
# Project-level (current repo only)
git clone https://github.com/anthropics/figma-dump.git .codex/skills/figma

# Global (available in all projects)
git clone https://github.com/anthropics/figma-dump.git ~/.codex/skills/figma
```

### Set your Figma token

```bash
export FIGMA_TOKEN="your-figma-personal-access-token"
```

## Usage

### As a Claude Code skill

```
/figma https://www.figma.com/design/XPACZRSwWV297aqyeltAEc/MyApp?node-id=371-5024
```

### As a standalone script

```bash
# From URL
node .claude/skills/figma/scripts/figma_fetch.mjs \
  --url='https://www.figma.com/design/FILE_KEY/NAME?node-id=371-5024'

# From file key + node ID
node .claude/skills/figma/scripts/figma_fetch.mjs \
  --file-key=FILE_KEY --node-id=371-5024
```

## Output Format

Every line follows: `[TYPE] "name" (Component) "text content" ...properties`

| Property | Example | CSS equivalent |
|---|---|---|
| Size | `w:360` `h:HUG` `w:FILL` | `width: 360px` / `auto` / `100%` |
| Fill | `bg:#fff` `bg:linear(#fff,#000)` | `background` |
| Radius | `radius:12` `radius:12,12,0,0` | `border-radius` |
| Stroke | `border:1,#e0e0e0` | `border` |
| Shadow | `shadow:0,2,8,0,#0000001a` | `box-shadow` |
| Blur | `blur:8` `bg-blur:10` | `filter` / `backdrop-filter` |
| Layout | `flex:row` `justify:between` `gap:12` | `display:flex` + props |
| Padding | `p:16` `p:16,24` `p:16,24,16,24` | `padding` |
| Text | `font:Inter/14/500` `color:#333` `lh:20` | `font` / `color` / `line-height` |
| Misc | `opacity:0.5` `clip` `grow:1` | `opacity` / `overflow:hidden` / `flex-grow` |

## How it works

1. Parses the Figma URL to extract file key and node ID
2. Calls `GET /v1/files/:key/nodes` to fetch the node tree
3. Calls `GET /v1/images/:key` to get a rendered PNG
4. Walks the tree and serializes each node into the compact format

## License

MIT
