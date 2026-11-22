# Toolbox

A DSH bundle that adds a **Toolbox** entry to the left sidebar of the Web GUI. The panel shows the tools as cards; click a card to open that tool.

## What it adds

- **Sidebar entry** — a grid icon labelled *Toolbox* / *工具栏*, placed after the shipped Theme studio entry. It opens this bundle's panel in the main column, like the Plugins and Schedules pages.
- **Card grid** — the panel lists each tool as a card with a title and a one-line description. Clicking a card opens that tool in the same panel; **Back to all tools** returns to the grid.
- **JSON formatter** — pretty-prints a JSON document with a 2- or 4-space indent, and reports the exact position of a syntax error when the input is not valid JSON.
- **XML formatter** — indents an XML document, and reports the exact position of a syntax error when the tags do not nest correctly.
- **JSON comparison** — puts two JSON documents side by side and lists every way they differ, each with the path of the difference.
- **XML comparison** — the same for two XML documents: the elements, the attributes, the text and the comments, each with the path of the difference.

## Usage

1. Open **Toolbox** in the left sidebar.
2. Click **JSON formatter** or **XML formatter**.
3. Paste a document, or press **Load sample** to see the tool at work.
4. Press **Format**. The result appears below, with **Copy** to put it on the clipboard.

For either comparison, paste a document into each of the two boxes and press **Compare**. The differences appear below, each with its kind (changed, added or removed), its path, and the value on each side.

## Notes on the formatters

- The **JSON formatter** parses with `JSON.parse` and prints with `JSON.stringify`, so the output is exactly what a JSON reader would accept. A parse failure is shown with the character offset the engine reports.
- The **XML formatter** re-indents the existing token stream instead of rebuilding a tree, so comments, CDATA sections, processing instructions and doctype declarations survive unchanged. An element whose content is only text (`<b>1</b>`) stays on one line; an element with child elements breaks across lines. A closing tag that does not match the innermost open element, or an element left open, is reported as an error.
- The XML formatter checks the tag structure itself; it is not a full XML parser and does not validate attributes, entities or namespaces against a schema.

## Notes on the comparison

- The two documents are parsed first, so a syntax error in either one is reported with its position and names the side it came from, rather than a diff that would mean nothing.
- The comparison walks both documents together. Objects are compared key by key, so a key only in one of them is reported as added or removed. Arrays are compared position by position, and a length difference is reported as the extra items being added or removed.
- The path of a difference is a JSON path: `$` is the root, `.name` is a key and `[2]` is an array index, so `$.nested.items[2].id` names one exact value.
- Key order and whitespace do not matter: two documents that hold the same values are the same however they are written.
- The walk stops 64 levels deep so a deeply nested pair cannot make the page crawl. Past that depth the values are reported as different rather than followed.
- The difference list is cut short at 500 entries, so a pair of very different documents produces a long list rather than an endless one.

## Notes on the XML comparison

- Both documents are parsed into a tree of elements first, so a syntax error in either one is reported with its position and names the side it came from, rather than a diff that would mean nothing.
- The path of a difference is an XPath-like path: `/catalog/book[2]/title/text()` names one exact value, and `/catalog/book[2]/@id` names one attribute.
- The attributes are compared by name, so the order they were written in does not matter.
- The children of an element are compared in order, so a child that moved is reported at the place it stands rather than as a whole subtree changing.
- Comments, CDATA sections, processing instructions and declarations are kept as part of the tree, so a document that differs only in a comment is reported as different.
- The parser checks the tag structure itself; it is not a full XML parser and does not validate attributes, entities or namespaces against a schema. A closing tag that does not match the innermost open element, or an element left open, is reported as an error.

## Storage and limits

- Everything runs in this browser. No text is uploaded, and nothing is stored between visits: each tool keeps its input in component state only, and it is gone when the panel is closed or the page is reloaded.
- One input accepts up to 500,000 characters.
- Removing or disabling the bundle removes the sidebar entry and the panel immediately; the stylesheet belongs to the plugin.

## Layout

- `index.js` — the Host half. It registers nothing; the bundle exists for its Client module.
- `client.js` — the Client module: dictionaries, the sidebar entry, the card grid, the two formatters, and the two comparisons.
- `cordis.patch.yml` — inserts this bundle's plugin row.
- `locale/*.json` — Plugin Manager title and description (English and Simplified Chinese).
- `icon.svg` — the bundle's Plugin Manager icon.
- `test-formatters.mjs` — a standalone test of the formatter logic. It extracts the functions from `client.js` and exercises them, so it tests the code the browser runs:
  ```sh
  node test-formatters.mjs
  ```
- `test-compare.mjs` — a standalone test of the JSON comparison logic, in the same style:
  ```sh
  node test-compare.mjs
  ```
- `test-compare-xml.mjs` — a standalone test of the XML comparison logic:
  ```sh
  node test-compare-xml.mjs
  ```
