---
name: "figma"
description: "Fetch node UI structure tree and rendered images from a Figma design URL, outputting a compact indented tree format with properties directly mappable to CSS."
---

# figma — Figma Design Fetcher

Fetch node tree structure, CSS-level style properties, and rendered images from a Figma URL, output in indented tree format.

## Output Format

One node per line, indentation represents hierarchy, properties use shorthand:

```
[FRAME] "card" w:361 h:HUG bg:#fff radius:12 shadow:0,2,8,0,#0000001a flex:col p:16 gap:12 clip
  [TEXT] "Title" "Hello" font:Inter/14/500 color:#666 align:center lh:20
  [FRAME] "row" w:FILL h:HUG flex:row justify:between items:center
    [INSTANCE] "btn" (ButtonPrimary) w:HUG h:36 bg:#0066ff radius:8 flex:row justify:center items:center
```

Property reference:
- Size: `w:360` `h:HUG` `w:FILL` `grow:1`
- Fill: `bg:#fff` `bg:linear(#fff,#000)` `bg:image`
- Border radius: `radius:12` `radius:12,12,0,0`
- Stroke: `border:1,#e0e0e0`
- Shadow: `shadow:x,y,blur,spread,#color` `inset-shadow:...`
- Blur: `blur:8` `bg-blur:10`
- Layout: `flex:row` `flex:col` `justify:between` `items:center` `gap:12` `wrap`
- Padding: `p:16` `p:16,24` `p:16,24,16,24`
- Opacity: `opacity:0.5`
- Clip: `clip`
- Text: `font:Inter/14/500` `color:#333` `align:center` `lh:20` `ls:1` `decoration:underline` `case:uppercase`
- Component: INSTANCE nodes show `(ComponentName)`

## Usage

Pass a Figma design URL:

```
/figma https://www.figma.com/design/abc-def/xxx?node-id=123-4566&m=dev
```

Also supports file key + node id:

```
/figma abc-def 123-4566
```

## Execution Steps

1. Parse user input:
   - If Figma URL: extract file key and node-id
   - If two arguments: first is file key, second is node-id

2. Run script:

```bash
# URL mode
node .claude/skills/figma/scripts/figma_fetch.mjs \
  --url='https://www.figma.com/design/abc-def/xxx?node-id=123-4566&m=dev'

# file key + node id mode
node .claude/skills/figma/scripts/figma_fetch.mjs \
  --file-key=abc-def \
  --node-id=123-4566
```

3. Script outputs indented tree to stdout, present directly to the user.
