# Toolbox

A DSH bundle that adds a **Toolbox** entry to the left sidebar of the Web GUI. The panel shows the tools as cards; click a card to open that tool.

## What it adds

- **Sidebar entry** — a grid icon labelled *Toolbox* / *工具栏*, placed after the shipped Theme studio entry. It opens this bundle's panel in the main column, like the Plugins and Schedules pages.
- **Card grid** — the panel lists each tool as a card with a title and a one-line description. Clicking a card opens that tool in the same panel; **Back to all tools** returns to the grid.
- **JSON formatter** — pretty-prints a JSON document with a 2- or 4-space indent, and reports the exact position of a syntax error when the input is not valid JSON.
- **XML formatter** — indents an XML document, and reports the exact position of a syntax error when the tags do not nest correctly.

## Usage

1. Open **Toolbox** in the left sidebar.
2. Click **JSON formatter** or **XML formatter**.
3. Paste a document, or press **Load sample** to see the tool at work.
4. Press **Format**. The result appears below, with **Copy** to put it on the clipboard.

## Notes on the formatters

- The **JSON formatter** parses with `JSON.parse` and prints with `JSON.stringify`, so the output is exactly what a JSON reader would accept. A parse failure is shown with the character offset the engine reports.
- The **XML formatter** re-indents the existing token stream instead of rebuilding a tree, so comments, CDATA sections, processing instructions and doctype declarations survive unchanged. An element whose content is only text (`<b>1</b>`) stays on one line; an element with child elements breaks across lines. A closing tag that does not match the innermost open element, or an element left open, is reported as an error.
- The XML formatter checks the tag structure itself; it is not a full XML parser and does not validate attributes, entities or namespaces against a schema.

## Storage and limits

- Everything runs in this browser. No text is uploaded, and nothing is stored between visits: each tool keeps its input in component state only, and it is gone when the panel is closed or the page is reloaded.
- One input accepts up to 500,000 characters.
- Removing or disabling the bundle removes the sidebar entry and the panel immediately; the stylesheet belongs to the plugin.

## Layout

- `index.js` — the Host half. It registers nothing; the bundle exists for its Client module.
- `client.js` — the Client module: dictionaries, the sidebar entry, the card grid, and the two formatters.
- `cordis.patch.yml` — inserts this bundle's plugin row.
- `locale/*.json` — Plugin Manager title and description (English and Simplified Chinese).
- `icon.svg` — the bundle's Plugin Manager icon.
- `test-formatters.mjs` — a standalone test of the formatter logic. It extracts the functions from `client.js` and exercises them, so it tests the code the browser runs:
  ```sh
  node test-formatters.mjs
  ```
