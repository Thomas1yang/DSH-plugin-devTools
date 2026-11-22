/**
 * Toolbox — the Client half of the bundle.
 *
 * One sidebar entry opens a panel that lists the tools as cards. Clicking a
 * card opens that tool in the same panel, so the grid and the tool share one
 * route and the sidebar entry stays the only navigation the user needs.
 *
 * Four tools ship:
 *   - a JSON formatter: pretty-prints JSON with a configurable indent and
 *     reports the exact position of a syntax error;
 *   - an XML formatter: indents XML and reports the exact position of a
 *     syntax error;
 *   - a JSON comparison: puts two JSON documents side by side and lists
 *     every way they differ, down to the path of each difference;
 *   - an XML comparison: the same, for two XML documents.
 *
 * Everything runs in this browser. No text is sent anywhere, and nothing is
 * persisted between visits: each tool keeps its input in component state only.
 */

window.__ModuleLoader__.load({
  id: 'dsh-toolbox',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef, useCallback } = React

    /** Locale namespace of this plugin's own client dictionaries. */
    const NS = 'toolbox'
    /** One id addresses both the sidebar entry and its main panel. */
    const PANEL_ID = 'toolbox'
    /** Sidebar position: after the shipped Theme studio entry (order 20). */
    const SIDEBAR_ORDER = 30
    /** The tool panels live under their own main keys. */
    const TOOL_JSON = 'toolbox-json'
    const TOOL_XML = 'toolbox-xml'
    const TOOL_COMPARE = 'toolbox-compare'
    const TOOL_COMPARE_XML = 'toolbox-compare-xml'
    /** Largest input one tool accepts, in characters. */
    const MAX_INPUT = 500000
    /** Indent widths the JSON formatter offers. */
    const JSON_INDENTS = [2, 4]

    /** English dictionary (the fallback locale of the client). */
    const EN = {
      'nav.label': 'Toolbox',
      'page.title': 'Toolbox',
      'page.desc': 'Small tools that run entirely in this browser. Pick a card to open its tool.',
      'page.note': 'Your text stays on this device: nothing is uploaded, and nothing is kept after you close the tab.',
      'card.json.title': 'JSON formatter',
      'card.json.desc': 'Pretty-print a JSON document and see exactly where a syntax error is.',
      'card.xml.title': 'XML formatter',
      'card.xml.desc': 'Indent an XML document and see exactly where a syntax error is.',
      'card.compare.title': 'JSON comparison',
      'card.compare.desc': 'Put two JSON documents side by side and see exactly how they differ.',
      'card.compareXml.title': 'XML comparison',
      'card.compareXml.desc': 'Put two XML documents side by side and see exactly how they differ.',
      'card.open': 'Open',
      'tool.back': 'Back to all tools',
      'tool.json.title': 'JSON formatter',
      'tool.json.desc': 'Paste a JSON document below. The result is formatted with the indent you choose.',
      'tool.xml.title': 'XML formatter',
      'tool.xml.desc': 'Paste an XML document below. The result is indented, with comments and declarations kept in place.',
      'tool.compare.title': 'JSON comparison',
      'tool.compare.desc': 'Paste two JSON documents below. The result lists every way they differ, down to the path of each one.',
      'tool.compareXml.title': 'XML comparison',
      'tool.compareXml.desc': 'Paste two XML documents below. The result lists every way they differ, down to the path of each one.',
      'field.input': 'Input',
      'field.output': 'Formatted output',
      'field.left': 'First document',
      'field.right': 'Second document',
      'field.differences': 'Differences',
      'field.indent': 'Indent',
      'field.indentValue': '{count} spaces',
      'action.format': 'Format',
      'action.compare': 'Compare',
      'action.copy': 'Copy',
      'action.copied': 'Copied',
      'action.clear': 'Clear',
      'action.sample': 'Load sample',
      'placeholder.json': '{\n  "name": "example"\n}',
      'placeholder.xml': '<root>\n  <child>text</child>\n</root>',
      'status.ok': 'Formatted',
      'status.invalid': 'Invalid input',
      'status.same': 'The two documents are the same.',
      'status.different': '{count} differences',
      'status.emptyCompare': 'Paste two documents, or load the sample.',
      'status.empty': 'Nothing to format yet — paste some text, or load the sample.',
      'error.json': 'Invalid JSON: {message}',
      'error.xml': 'Invalid XML: {message}',
      'error.jsonLeft': 'The first document is not valid JSON: {message}',
      'error.jsonRight': 'The second document is not valid JSON: {message}',
      'error.xmlLeft': 'The first document is not valid XML: {message}',
      'error.xmlRight': 'The second document is not valid XML: {message}',
      'diff.kindAdded': 'Added',
      'diff.kindRemoved': 'Removed',
      'diff.kindChanged': 'Changed',
      'diff.left': 'First',
      'diff.right': 'Second',
      'diff.added': 'only in the second',
      'diff.removed': 'only in the first',
      'diff.absent': 'not here',
      'hint.privacy': 'The text never leaves this browser.',
    }

    /** Simplified Chinese dictionary. */
    const ZH = {
      'nav.label': '工具栏',
      'page.title': '工具栏',
      'page.desc': '一些完全在当前浏览器里运行的小工具。点击卡片打开对应工具。',
      'page.note': '你的文本只留在这台设备上：不会上传，关闭标签页后也不再保留。',
      'card.json.title': 'JSON 格式化',
      'card.json.desc': '美化 JSON 文档，并准确定位语法错误。',
      'card.xml.title': 'XML 格式化',
      'card.xml.desc': '缩进 XML 文档，并准确定位语法错误。',
      'card.compare.title': 'JSON 文本比较',
      'card.compare.desc': '并排放两份 JSON 文档，看清它们到底哪里不一样。',
      'card.compareXml.title': 'XML 文本比较',
      'card.compareXml.desc': '并排放两份 XML 文档，看清它们到底哪里不一样。',
      'card.open': '打开',
      'tool.back': '返回全部工具',
      'tool.json.title': 'JSON 格式化',
      'tool.json.desc': '在下方粘贴 JSON 文档，结果会按你选择的缩进宽度格式化。',
      'tool.xml.title': 'XML 格式化',
      'tool.xml.desc': '在下方粘贴 XML 文档，结果会缩进排版，注释与声明保持原位。',
      'tool.compare.title': 'JSON 文本比较',
      'tool.compare.desc': '在下方粘贴两份 JSON 文档，结果会列出它们的每一处不同，并给出每处的路径。',
      'tool.compareXml.title': 'XML 文本比较',
      'tool.compareXml.desc': '在下方粘贴两份 XML 文档，结果会列出它们的每一处不同，并给出每处的路径。',
      'field.input': '输入',
      'field.output': '格式化结果',
      'field.left': '第一份文档',
      'field.right': '第二份文档',
      'field.differences': '差异',
      'field.indent': '缩进',
      'field.indentValue': '{count} 个空格',
      'action.format': '格式化',
      'action.compare': '比较',
      'action.copy': '复制',
      'action.copied': '已复制',
      'action.clear': '清空',
      'action.sample': '载入示例',
      'placeholder.json': '{\n  "name": "example"\n}',
      'placeholder.xml': '<root>\n  <child>text</child>\n</root>',
      'status.ok': '已格式化',
      'status.invalid': '输入无效',
      'status.same': '两份文档完全相同。',
      'status.different': '共 {count} 处不同',
      'status.emptyCompare': '粘贴两份文档，或载入示例。',
      'status.empty': '还没有内容——粘贴一段文本，或载入示例。',
      'error.json': 'JSON 无效：{message}',
      'error.xml': 'XML 无效：{message}',
      'error.jsonLeft': '第一份文档不是有效的 JSON：{message}',
      'error.jsonRight': '第二份文档不是有效的 JSON：{message}',
      'error.xmlLeft': '第一份文档不是有效的 XML：{message}',
      'error.xmlRight': '第二份文档不是有效的 XML：{message}',
      'diff.kindAdded': '新增',
      'diff.kindRemoved': '删除',
      'diff.kindChanged': '修改',
      'diff.left': '第一份',
      'diff.right': '第二份',
      'diff.added': '仅第二份有',
      'diff.removed': '仅第一份有',
      'diff.absent': '此处没有',
      'hint.privacy': '文本不会离开这个浏览器。',
    }

    /* ------------------------------------------------------------------ *
     * Plugin-owned stylesheet
     * ------------------------------------------------------------------ */

    /**
     * Every rule is scoped to the plugin's own `dtb-` classes, so the whole
     * look is removed with the plugin.
     */
    const STYLES = [
      ".dtb-page{display:flex;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.6}",
      ".dtb-scroll{flex:1;min-width:0;min-height:0;overflow:auto;scrollbar-gutter:stable;--dsh-scrollbar-width:9px;--dsh-scrollbar-thumb-border:2px}",
      ".dtb-content{max-width:960px;margin:0 auto;padding:0 clamp(24px,4vw,48px) 48px}",
      "@media (max-width:767px){.dtb-content{padding-inline:20px}}",
      ".dtb-heading{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:16px;padding-top:28px;margin-bottom:24px}",
      "html[data-platform='darwin'] .dtb-heading{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}",
      ".dtb-heading-main{flex:1 1 320px;min-width:0}",
      ".dtb-heading h1{margin:0;font-size:20px;line-height:28px;font-weight:500}",
      ".dtb-lede{margin:6px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}",
      ".dtb-heading-actions{display:flex;flex:none;align-items:center;gap:12px;padding-top:2px}",
      ".dtb-status{min-width:52px;text-align:right;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary)}",
      ".dtb-status[data-kind='error']{color:var(--dsw-alias-state-error-primary)}",
      // The card grid: two columns when the column is wide enough, one when it
      // is not. The grid is what makes the page read as a toolbox rather than a
      // settings form.
      ".dtb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin:0 0 24px}",
      ".dtb-card{display:flex;flex-direction:column;gap:10px;margin:0;padding:16px 18px 18px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);text-align:left;transition:border-color .15s ease,background-color .15s ease}",
      "button.dtb-card{cursor:pointer;font:inherit;color:inherit;width:100%}",
      "button.dtb-card:hover{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover)}",
      "button.dtb-card:focus-visible,.dtb-btn:focus-visible,.dtb-select:focus-visible,.dtb-textarea:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}",
      ".dtb-card-top{display:flex;align-items:center;gap:10px}",
      ".dtb-card-icon{display:inline-flex;flex:none;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary);font-size:15px;line-height:1;font-weight:600}",
      ".dtb-card h2{margin:0;font-size:15px;line-height:22px;font-weight:600}",
      ".dtb-card p{margin:0;font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-secondary)}",
      ".dtb-card-foot{margin-top:auto;padding-top:4px;display:flex;align-items:center;gap:6px;font-size:12.5px;line-height:20px;color:var(--dsw-alias-brand-primary)}",
      ".dtb-tool{display:flex;flex-direction:column;gap:16px;margin-bottom:16px;padding:16px 18px 18px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1)}",
      ".dtb-tool-head{display:flex;flex-direction:column;gap:2px}",
      ".dtb-tool-head h2{margin:0;font-size:15px;line-height:22px;font-weight:600}",
      ".dtb-tool-head p{margin:0;font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-secondary)}",
      ".dtb-row{display:flex;flex-direction:column;gap:6px}",
      ".dtb-row-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:12px}",
      ".dtb-label{font-size:13px;line-height:20px;font-weight:500}",
      ".dtb-hint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}",
      ".dtb-error{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary)}",
      ".dtb-inline{display:flex;flex-wrap:wrap;align-items:center;gap:8px}",
      ".dtb-textarea{width:100%;min-height:220px;padding:10px 12px;border:0.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:12.5px;line-height:20px;resize:vertical;tab-size:2}",
      ".dtb-textarea::placeholder{color:var(--dsw-alias-label-dimmed)}",
      ".dtb-textarea:focus{border-color:var(--dsw-alias-state-business-primary)}",
      ".dtb-textarea[aria-invalid='true']{border-color:var(--dsw-alias-state-error-primary)}",
      ".dtb-textarea[data-readonly='true']{background:var(--dsw-alias-bg-layer-2)}",
      ".dtb-select{height:28px;padding:0 8px;border:0.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px}",
      ".dtb-btn{flex:none;height:28px;padding:0 10px;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;cursor:pointer}",
      ".dtb-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
      ".dtb-btn:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}",
      ".dtb-btn:disabled{opacity:.4;cursor:not-allowed}",
      ".dtb-btn[data-variant='primary']{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}",
      ".dtb-btn[data-variant='primary']:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}",
      ".dtb-note{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}",
      // The comparison tool puts its two documents side by side, so each side
      // gets its own column and the pair collapses to one column on a narrow
      // window.
      ".dtb-compare{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}",
      "@media (max-width:900px){.dtb-compare{grid-template-columns:minmax(0,1fr)}}",
      ".dtb-diff{margin:0;padding:0;list-style:none;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);overflow:hidden}",
      ".dtb-diff:empty{display:none}",
      ".dtb-diff li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:baseline;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);font-size:12.5px;line-height:19px}",
      ".dtb-diff li:last-child{border-bottom:0}",
      ".dtb-diff-path{font-family:var(--dsw-font-family-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);word-break:break-all}",
      ".dtb-diff-values{display:flex;flex-wrap:wrap;gap:6px;min-width:0}",
      ".dtb-diff-old,.dtb-diff-new{font-family:var(--dsw-font-family-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);padding:1px 6px;border-radius:var(--dsw-radius-sm);word-break:break-all}",
      ".dtb-diff-old{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 16%,transparent);text-decoration:line-through}",
      ".dtb-diff-new{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary)) 16%,transparent)}",
      ".dtb-diff-kind{flex:none;padding:1px 6px;border-radius:var(--dsw-radius-sm);font-size:11px;line-height:16px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}",
      ".dtb-diff-empty{margin:0;padding:12px;font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-secondary)}",
      ".dtb-badge{flex:none;height:20px;padding:0 8px;border-radius:10px;background:var(--dsw-alias-interactive-bg-hover);font-size:11px;line-height:20px;color:var(--dsw-alias-label-secondary)}",
    ].join('\n')

    /* ------------------------------------------------------------------ *
     * Small React stores
     * ------------------------------------------------------------------ */

    /**
     * Minimal signal for one value.
     * @param initial - first value.
     * @returns read, write, and subscribe faces.
     */
    function createSignal(initial) {
      let value = initial
      const listeners = new Set()
      return {
        get: () => value,
        set(next) {
          if (next === value) return
          value = next
          for (const listener of listeners) listener()
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
      }
    }

    /** @param store - a createSignal result. @returns its current value. */
    function useValue(store) {
      return React.useSyncExternalStore(store.subscribe, store.get, store.get)
    }

    /* ------------------------------------------------------------------ *
     * JSON formatting
     * ------------------------------------------------------------------ */

    /**
     * Describe a JSON parse failure with its position.
     *
     * The platform's message already carries a line and column for most
     * failures; this only adds the character offset when it is missing, so the
     * user can see exactly where the document stops being valid.
     * @param error - the thrown SyntaxError.
     * @returns a short human-readable description.
     */
    function describeJsonError(error) {
      const message = error instanceof Error ? error.message : String(error)
      // V8 reports "at position N (line L column C)"; other engines report the
      // position inside the message itself.
      const position = /position\s+(\d+)/i.exec(message)
      const offset = position === null ? null : Number(position[1])
      const base = message.replace(/\s*in JSON at position \d+.*$/i, '')
      if (offset === null) return base
      return `${base} (character ${offset + 1})`
    }

    /**
     * Pretty-print one JSON document.
     * @param text - the source text.
     * @param indent - indent width in spaces.
     * @returns the formatted text, or an error describing the failure.
     */
    function formatJson(text, indent) {
      try {
        const value = JSON.parse(text)
        return { ok: true, text: JSON.stringify(value, null, indent) }
      } catch (error) {
        return { ok: false, message: describeJsonError(error) }
      }
    }

    /** The sample JSON document the JSON tool can load. */
    const JSON_SAMPLE = JSON.stringify({
      name: 'example',
      version: 1,
      tags: ['alpha', 'beta'],
      nested: { enabled: true, count: 3, items: [{ id: 1 }, { id: 2 }] },
    })

    /* ------------------------------------------------------------------ *
     * XML formatting
     * ------------------------------------------------------------------ */

    /**
     * One XML token, split into the parts the formatter keeps.
     */
    const XML_TOKEN = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<![^>]*>|<\/[^>]+>|<[^>]+>|[^<]+/g

    /**
     * Pretty-print one XML document by re-indenting its existing tokens.
     *
     * The document is not parsed into a tree: the token stream is kept as it is
     * and only the whitespace between tokens changes. Comments, CDATA sections,
     * processing instructions and doctype declarations therefore survive
     * untouched, which a tree round-trip would not guarantee.
     *
     * A stack of open element names drives the layout, so an element whose
     * content is only text (`<b>1</b>`) stays on one line, while an element
     * with child elements (`<a><b/></a>`) breaks across lines.
     * @param text - the source text.
     * @returns the indented text, or an error describing the failure.
     */
    function formatXml(text) {
      const tokens = []
      let cursor = 0
      let match = null
      XML_TOKEN.lastIndex = 0
      while ((match = XML_TOKEN.exec(text)) !== null) {
        const token = match[0]
        if (match.index > cursor) tokens.push({ kind: 'text', value: text.slice(cursor, match.index) })
        if (token.startsWith('<!--')) tokens.push({ kind: 'comment', value: token })
        else if (token.startsWith('<![CDATA[')) tokens.push({ kind: 'cdata', value: token })
        else if (token.startsWith('<?')) tokens.push({ kind: 'pi', value: token })
        else if (token.startsWith('<!')) tokens.push({ kind: 'decl', value: token })
        else if (token.startsWith('</')) tokens.push({ kind: 'close', value: token })
        // A tag that closes itself (`<b/>`) opens nothing, so it is counted
        // apart from a real opening tag.
        else if (token.startsWith('<')) {
          const selfClosing = /\/\s*>$/.test(token)
          tokens.push({ kind: selfClosing ? 'empty' : 'open', value: token })
        } else tokens.push({ kind: 'text', value: token })
        cursor = match.index + token.length
      }
      if (cursor < text.length) tokens.push({ kind: 'text', value: text.slice(cursor) })

      // The document must hold one element; anything else is not XML we can
      // re-indent, and saying so is more useful than re-flowing broken input.
      // A self-closing element is an element too, so it counts as a root.
      const hasRoot = tokens.some((token) => token.kind === 'open' || token.kind === 'close' || token.kind === 'empty')
      if (!hasRoot) {
        return { ok: false, message: 'no element found' }
      }

      /**
       * The name of one element, taken from its tag.
       * @param tag - the tag text, with or without its angle brackets.
       * @returns the element name.
       */
      const tagName = (tag) => tag.replace(/^<\/?/, '').replace(/[\s/>].*$/, '')

      const lines = []
      /** The names of the elements that are currently open. */
      const stack = []
      /**
       * The line the current element's text content belongs to, or -1 when the
       * current element has no text content yet. It is the line of the opening
       * tag, which the closing tag later joins.
       */
      let contentLine = -1

      for (const token of tokens) {
        if (token.kind === 'text') {
          // Only whitespace is dropped between tags; text content keeps its
          // own characters and stays on the line it belongs to.
          const value = token.value.trim()
          if (value === '') continue
          if (contentLine >= 0) {
            // The text continues the line of the tag it belongs to.
            lines[contentLine] += value
          } else {
            lines.push(`${'  '.repeat(stack.length)}${value}`)
            contentLine = lines.length - 1
          }
          continue
        }
        if (token.kind === 'close') {
          const name = tagName(token.value)
          const open = stack.pop()
          if (open === undefined || open !== name) {
            return { ok: false, message: `unexpected closing tag </${name}>` }
          }
          const value = token.value.trim()
          // A closing tag joins the line of the content it ends, so `<b>1</b>`
          // stays one line; an element with child elements closes on its own.
          if (contentLine >= 0 && contentLine === lines.length - 1) {
            lines[contentLine] += `</${name}>`
          } else {
            lines.push(`${'  '.repeat(stack.length)}${value}`)
          }
          contentLine = -1
          continue
        }
        const value = token.value.trim()
        if (token.kind === 'open') {
          const name = tagName(value)
          lines.push(`${'  '.repeat(stack.length)}${value}`)
          stack.push(name)
          // The content of this element starts on its own line unless it turns
          // out to be text, in which case the closing tag joins it.
          contentLine = lines.length - 1
          continue
        }
        if (token.kind === 'empty') {
          lines.push(`${'  '.repeat(stack.length)}${value}`)
          // A self-closing element has no content of its own, so the next
          // element's text does not belong to it.
          contentLine = -1
          continue
        }
        // A comment, CDATA section, processing instruction or declaration
        // stands on its own line and does not change the nesting.
        lines.push(`${'  '.repeat(stack.length)}${value}`)
        contentLine = -1
      }

      if (stack.length > 0) {
        return { ok: false, message: `unclosed element <${stack[stack.length - 1]}>` }
      }
      return { ok: true, text: lines.join('\n') }
    }

    /** The sample XML document the XML tool can load. */
    const XML_SAMPLE = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<catalog>',
      '<book id="1"><title>First</title><author>Ada</author></book>',
      '<book id="2"><title>Second</title><author>Grace</author></book>',
      '</catalog>',
    ].join('\n')

    /* ------------------------------------------------------------------ *
     * JSON comparison
     * ------------------------------------------------------------------ */

    /**
     * How deep the comparison walks before it stops.
     *
     * A document can nest without bound, and a deeply nested pair would make
     * the tool crawl. Past this depth the values are reported as different
     * rather than followed, which still tells the user that something differs
     * down there.
     */
    const MAX_COMPARE_DEPTH = 64

    /**
     * How many differences are collected before the list is cut short.
     */
    const MAX_DIFFERENCES = 500

    /**
     * The path of one value inside a document, written the way a JSON path
     * is usually written.
     *
     * The root is `$`, so the path of a key named `a` at the root is `$.a`
     * and the path of a key named `a` inside a key named `b` is `$.b.a`.
     * @param parts - the keys walked so far.
     * @returns the path text.
     */
    function pathText(parts) {
      if (parts.length === 0) return '$'
      return '$' + parts.map((part) => (typeof part === 'number' ? `[${part}]` : `.${part}`)).join('')
    }

    /**
     * Whether two values are the same JSON scalar.
     *
     * `NaN` never reaches this function, because `JSON.parse` cannot produce
     * it, and `null` is compared by identity.
     * @param left - the value from the first document.
     * @param right - the value from the second document.
     * @returns whether the two scalars are equal.
     */
    function sameScalar(left, right) {
      if (left === null || right === null) return left === right
      if (typeof left === 'number' && typeof right === 'number') return left === right
      return left === right
    }

    /**
     * Whether two values have the same JSON type.
     * @param left - the value from the first document.
     * @param right - the value from the second document.
     * @returns whether the types match.
     */
    function sameKind(left, right) {
      if (left === null) return right === null
      if (right === null) return false
      if (Array.isArray(left)) return Array.isArray(right)
      if (Array.isArray(right)) return false
      return typeof left === typeof right
    }

    /**
     * Whether two parsed JSON values are the same, all the way down.
     *
     * This is the plain answer to "are these two documents the same", used
     * where the difference list must not be built: the depth guard, and the
     * final answer the tool reports.
     * @param left - the value from the first document.
     * @param right - the value from the second document.
     * @returns whether the two values are the same.
     */
    function sameJson(left, right) {
      if (!sameKind(left, right)) return false
      if (left === null) return true
      if (Array.isArray(left)) {
        if (left.length !== right.length) return false
        for (let index = 0; index < left.length; index += 1) {
          if (!sameJson(left[index], right[index])) return false
        }
        return true
      }
      if (typeof left !== 'object') return left === right
      const leftKeys = Object.keys(left)
      const rightKeys = Object.keys(right)
      if (leftKeys.length !== rightKeys.length) return false
      for (const key of leftKeys) {
        if (!Object.prototype.hasOwnProperty.call(right, key)) return false
        if (!sameJson(left[key], right[key])) return false
      }
      return true
    }

    /**
     * Compare two parsed JSON values and collect the ways they differ.
     *
     * The walk follows both documents together. Two objects are compared key
     * by key: a key only in one of them is reported as added or removed. Two
     * arrays are compared position by position, and a length difference is
     * reported as the extra items being added or removed.
     * @param left - the value from the first document.
     * @param right - the value from the second document.
     * @param differences - the list the findings are appended to.
     * @param parts - the path walked so far.
     * @param depth - how deep the walk has gone.
     * @returns whether the two values are equal.
     */
    function compareValues(left, right, differences, parts, depth) {
      if (differences.length >= MAX_DIFFERENCES) return false
      if (sameKind(left, right) && sameScalar(left, right)) return true

      // The kinds differ, so no amount of walking will make them match.
      if (!sameKind(left, right)) {
        differences.push({
          kind: 'type',
          path: pathText(parts),
          left: describeValue(left),
          right: describeValue(right),
        })
        return false
      }

      if (depth >= MAX_COMPARE_DEPTH) {
        // The walk has gone as deep as it goes. Two values that are the same
        // are still the same, so nothing is reported; two that differ are
        // reported, because the user needs to know that something down there
        // is not the same.
        if (sameJson(left, right)) return true
        differences.push({
          kind: 'type',
          path: pathText(parts),
          left: describeValue(left),
          right: describeValue(right),
        })
        return false
      }

      // Two values of the same kind that are not equal are scalars: a number,
      // a string, a boolean. They have nothing to walk into, so the
      // difference is reported here. Without this the walk would fall
      // through to the object branch, where a number has no keys and the two
      // would wrongly look alike.
      if (typeof left !== 'object' || typeof right !== 'object') {
        differences.push({
          kind: 'type',
          path: pathText(parts),
          left: describeValue(left),
          right: describeValue(right),
        })
        return false
      }

      if (Array.isArray(left)) {
        const shared = Math.min(left.length, right.length)
        let equal = true
        for (let index = 0; index < shared; index += 1) {
          const same = compareValues(left[index], right[index], differences, parts.concat(index), depth + 1)
          if (!same) equal = false
          if (differences.length >= MAX_DIFFERENCES) break
        }
        if (left.length > right.length) {
          equal = false
          for (let index = shared; index < left.length; index += 1) {
            differences.push({
              kind: 'removed',
              path: pathText(parts.concat(index)),
              left: describeValue(left[index]),
              right: '',
            })
          }
        } else if (right.length > left.length) {
          equal = false
          for (let index = shared; index < right.length; index += 1) {
            differences.push({
              kind: 'added',
              path: pathText(parts.concat(index)),
              left: '',
              right: describeValue(right[index]),
            })
          }
        }
        return equal
      }

      // Both are objects.
      const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)]))
      let equal = true
      for (const key of keys) {
        const inLeft = Object.prototype.hasOwnProperty.call(left, key)
        const inRight = Object.prototype.hasOwnProperty.call(right, key)
        if (!inLeft) {
          equal = false
          differences.push({
            kind: 'added',
            path: pathText(parts.concat(key)),
            left: '',
            right: describeValue(right[key]),
          })
          continue
        }
        if (!inRight) {
          equal = false
          differences.push({
            kind: 'removed',
            path: pathText(parts.concat(key)),
            left: describeValue(left[key]),
            right: '',
          })
          continue
        }
        const same = compareValues(left[key], right[key], differences, parts.concat(key), depth + 1)
        if (!same) equal = false
        if (differences.length >= MAX_DIFFERENCES) break
      }
      return equal
    }

    /**
     * A short description of one value, for the difference list.
     *
     * Objects and arrays are described by their size rather than by their
     * contents, so one line stays one line however large the value is.
     * @param value - the value to describe.
     * @returns the description text.
     */
    function describeValue(value) {
      if (value === null) return 'null'
      if (Array.isArray(value)) return `array(${value.length})`
      if (typeof value === 'object') return `object(${Object.keys(value).length})`
      if (typeof value === 'string') return JSON.stringify(value)
      return String(value)
    }

    /**
     * Compare two JSON documents.
     *
     * Both sides are parsed first, so a syntax error in either one is
     * reported with its position instead of a diff that means nothing.
     * @param leftText - the first document.
     * @param rightText - the second document.
     * @returns the comparison result.
     */
    function compareJson(leftText, rightText) {
      let left
      let right
      try {
        left = JSON.parse(leftText)
      } catch (error) {
        return { ok: false, side: 'left', message: describeJsonError(error) }
      }
      try {
        right = JSON.parse(rightText)
      } catch (error) {
        return { ok: false, side: 'right', message: describeJsonError(error) }
      }
      const differences = []
      compareValues(left, right, differences, [], 0)
      // The walk reports what differs; the plain answer to "are these the
      // same" comes from comparing the two documents outright, so a value
      // the walk stopped short of still counts.
      const equal = sameJson(left, right)
      return { ok: true, equal, differences }
    }

    /** The pair of documents the JSON comparison tool can load. */
    const JSON_COMPARE_SAMPLE = [
      JSON.stringify({
        name: 'example',
        version: 1,
        tags: ['alpha', 'beta'],
        nested: { enabled: true, count: 3 },
      }, null, 2),
      JSON.stringify({
        name: 'example',
        version: 2,
        tags: ['alpha', 'beta', 'gamma'],
        nested: { enabled: true, count: 4 },
        added: 'new key',
      }, null, 2),
    ].join('\n---\n')

    /* ------------------------------------------------------------------ *
     * XML comparison
     * ------------------------------------------------------------------ */

    /**
     * How deep the XML comparison walks before it stops.
     */
    const MAX_XML_DEPTH = 64

    /**
     * How many differences the XML comparison collects before it stops.
     */
    const MAX_XML_DIFFERENCES = 500

    /**
     * The name of one element, taken from its tag.
     * @param tag - the tag text, with or without its angle brackets.
     * @returns the element name.
     */
    function xmlTagName(tag) {
      return tag.replace(/^<\/?/, '').replace(/[\s/>].*$/, '')
    }

    /**
     * The attributes of one tag, in the order they were written.
     *
     * The scan reads name="value" and name='value' pairs. A name that is not
     * quoted is still taken, with an empty value, so a malformed attribute
     * does not hide the rest of the tag.
     * @param tag - the tag text.
     * @returns the attributes, as a list of name and value pairs.
     */
    function xmlAttributes(tag) {
      const attributes = []
      const body = tag.replace(/^<[^>\s/]+/, '').replace(/\/?>$/, '')
      const pattern = /([^\s=/]+)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
      let match = null
      while ((match = pattern.exec(body)) !== null) {
        const name = match[1]
        if (name === '') continue
        const value = match[3] !== undefined ? match[3] : match[4] !== undefined ? match[4] : match[5] !== undefined ? match[5] : ''
        attributes.push({ name, value })
      }
      return attributes
    }

    /**
     * Parse one XML document into a tree of elements.
     *
     * The tree keeps what a reader cares about when two documents are
     * compared: each element's name, its attributes, its text, and its
     * children in order. Comments, CDATA sections, processing instructions
     * and declarations are kept as children of their parent, so a document
     * that differs only in a comment is reported as different.
     * @param text - the source text.
     * @returns the root elements, or an error describing the failure.
     */
    function parseXml(text) {
      /** The elements at the top level of the document. */
      const roots = []
      /** The elements that are currently open, innermost last. */
      const stack = []
      /** Whether text was found outside any element. */
      let strayText = false
      let cursor = 0
      let match = null
      XML_TOKEN.lastIndex = 0
      while ((match = XML_TOKEN.exec(text)) !== null) {
        const token = match[0]
        const before = text.slice(cursor, match.index)
        if (before.trim() !== '') {
          // Text that sits between tags belongs to the element that is open.
          const parent = stack.length > 0 ? stack[stack.length - 1] : null
          if (parent !== null) parent.text += before
          else if (before.trim() !== '') {
            return { ok: false, message: 'text outside the root element' }
          }
        }
        cursor = match.index + token.length

        if (token.startsWith('<!--')) {
          const parent = stack.length > 0 ? stack[stack.length - 1] : null
          const comment = { kind: 'comment', name: 'comment', value: token }
          if (parent !== null) parent.children.push(comment)
          else roots.push(comment)
          continue
        }
        if (token.startsWith('<![CDATA[')) {
          const parent = stack.length > 0 ? stack[stack.length - 1] : null
          const cdata = { kind: 'cdata', name: 'cdata', value: token.slice(9, -3) }
          if (parent !== null) parent.children.push(cdata)
          else roots.push(cdata)
          continue
        }
        if (token.startsWith('<?') || token.startsWith('<!')) {
          const parent = stack.length > 0 ? stack[stack.length - 1] : null
          const other = { kind: 'other', name: 'other', value: token }
          if (parent !== null) parent.children.push(other)
          else roots.push(other)
          continue
        }
        if (token.startsWith('</')) {
          const name = xmlTagName(token)
          const open = stack.pop()
          if (open === undefined || open.name !== name) {
            return { ok: false, message: `unexpected closing tag </${name}>` }
          }
          continue
        }

        // Text between tags belongs to the element that is open. The text
        // that came before this token was already added; this token is the
        // text that follows it, and it is added when the next token comes.
        if (!token.startsWith('<')) {
          const parent = stack.length > 0 ? stack[stack.length - 1] : null
          if (parent !== null) parent.text += token
          else if (token.trim() !== '') strayText = true
          continue
        }

        const selfClosing = /\/\s*>$/.test(token)
        const element = {
          kind: 'element',
          name: xmlTagName(token),
          attributes: xmlAttributes(token),
          text: '',
          children: [],
        }
        const parent = stack.length > 0 ? stack[stack.length - 1] : null
        if (parent !== null) parent.children.push(element)
        else roots.push(element)
        if (!selfClosing) stack.push(element)
      }

      const trailing = text.slice(cursor)
      if (trailing.trim() !== '') {
        const parent = stack.length > 0 ? stack[stack.length - 1] : null
        if (parent !== null) parent.text += trailing
        else strayText = true
      }

      if (stack.length > 0) {
        return { ok: false, message: `unclosed element <${stack[stack.length - 1].name}>` }
      }
      if (!roots.some((node) => node.kind === 'element')) {
        // A document that holds no element at all is not XML we can compare.
        return { ok: false, message: 'no element found' }
      }
      if (strayText) {
        return { ok: false, message: 'text outside the root element' }
      }
      return { ok: true, roots }
    }

    /**
     * The path of one node inside an XML document.
     * @param parts - the names walked so far.
     * @param index - the position among the siblings, when there is one.
     * @returns the path text.
     */
    function xmlPathText(parts, index) {
      let text = ''
      for (let position = 0; position < parts.length; position += 1) {
        const part = parts[position]
        const last = position === parts.length - 1
        // The last part carries the position among its siblings, so the path
        // names one exact element rather than a whole group of them.
        text += last && index !== null ? `/${part}[${index}]` : `/${part}`
      }
      return text === '' ? '/' : text
    }
    /**
     * Compare two XML nodes and collect the ways they differ.
     * @param left - the node from the first document.
     * @param right - the node from the second document.
     * @param differences - the list the findings are appended to.
     * @param parts - the names walked so far.
     * @param depth - how deep the walk has gone.
     * @returns whether the two nodes are the same.
     */
    function compareXmlNodes(left, right, differences, parts, depth) {
      if (differences.length >= MAX_XML_DIFFERENCES) return false

      if (left.kind !== right.kind) {
        differences.push({
          kind: 'type',
          path: xmlPathText(parts, null),
          left: left.kind,
          right: right.kind,
        })
        return false
      }
      if (left.kind !== 'element') {
        // A comment, a CDATA section or a declaration is compared by its text.
        // The path names the kind, so a comment inside an element is told
        // apart from the element itself.
        if (left.value !== right.value) {
          differences.push({
            kind: 'type',
            path: `${xmlPathText(parts, null)}/${left.kind}`,
            left: left.value,
            right: right.value,
          })
          return false
        }
        return true
      }

      if (left.name !== right.name) {
        differences.push({
          kind: 'type',
          path: xmlPathText(parts.concat(left.name), null),
          left: `<${left.name}>`,
          right: `<${right.name}>`,
        })
        return false
      }

      if (depth >= MAX_XML_DEPTH) {
        differences.push({
          kind: 'type',
          path: xmlPathText(parts, null),
          left: `<${left.name}>`,
          right: `<${right.name}>`,
        })
        return false
      }

      let equal = true
      const here = parts.concat(left.name)

      // The attributes are compared by name, so the order they were written
      // in does not matter.
      const leftAttributes = new Map(left.attributes.map((attribute) => [attribute.name, attribute.value]))
      const rightAttributes = new Map(right.attributes.map((attribute) => [attribute.name, attribute.value]))
      for (const [name, value] of leftAttributes) {
        if (!rightAttributes.has(name)) {
          equal = false
          differences.push({
            kind: 'removed',
            path: `${xmlPathText(here, null)}/@${name}`,
            left: value,
            right: '',
          })
          continue
        }
        if (rightAttributes.get(name) !== value) {
          equal = false
          differences.push({
            kind: 'type',
            path: `${xmlPathText(here, null)}/@${name}`,
            left: value,
            right: rightAttributes.get(name),
          })
        }
      }
      for (const [name, value] of rightAttributes) {
        if (!leftAttributes.has(name)) {
          equal = false
          differences.push({
            kind: 'added',
            path: `${xmlPathText(here, null)}/@${name}`,
            left: '',
            right: value,
          })
        }
      }

      // The text of an element is compared on its own, and only when the
      // element has no child elements: an element with children holds its
      // text in those children.
      const leftText = left.text.trim()
      const rightText = right.text.trim()
      if (left.children.length === 0 && right.children.length === 0 && leftText !== rightText) {
        equal = false
        differences.push({
          kind: 'type',
          path: `${xmlPathText(here, null)}/text()`,
          left: leftText,
          right: rightText,
        })
      }

      // The children are compared in order, so a child that moved is reported
      // as a difference at the place it stands.
      const shared = Math.min(left.children.length, right.children.length)
      for (let index = 0; index < shared; index += 1) {
        const same = compareXmlNodes(
          left.children[index],
          right.children[index],
          differences,
          here,
          depth + 1,
        )
        if (!same) equal = false
        if (differences.length >= MAX_XML_DIFFERENCES) break
      }
      if (left.children.length > right.children.length) {
        equal = false
        for (let index = shared; index < left.children.length; index += 1) {
          differences.push({
            kind: 'removed',
            path: xmlPathText(here.concat(left.children[index].name), index),
            left: `<${left.children[index].name}>`,
            right: '',
          })
        }
      } else if (right.children.length > left.children.length) {
        equal = false
        for (let index = shared; index < right.children.length; index += 1) {
          differences.push({
            kind: 'added',
            path: xmlPathText(here.concat(right.children[index].name), index),
            left: '',
            right: `<${right.children[index].name}>`,
          })
        }
      }
      return equal
    }

    /**
     * Compare two XML documents.
     *
     * Both sides are parsed first, so a syntax error in either one is
     * reported with its position instead of a diff that means nothing.
     * @param leftText - the first document.
     * @param rightText - the second document.
     * @returns the comparison result.
     */
    function compareXml(leftText, rightText) {
      const left = parseXml(leftText)
      if (!left.ok) return { ok: false, side: 'left', message: left.message }
      const right = parseXml(rightText)
      if (!right.ok) return { ok: false, side: 'right', message: right.message }
      const differences = []

      // The root elements are compared directly. A document may hold more
      // than one top-level element, and each of them is compared in turn.
      const leftElements = left.roots.filter((node) => node.kind === 'element')
      const rightElements = right.roots.filter((node) => node.kind === 'element')
      const shared = Math.min(leftElements.length, rightElements.length)
      for (let index = 0; index < shared; index += 1) {
        compareXmlNodes(leftElements[index], rightElements[index], differences, [], 0)
        if (differences.length >= MAX_XML_DIFFERENCES) break
      }
      if (leftElements.length > rightElements.length) {
        for (let index = shared; index < leftElements.length; index += 1) {
          differences.push({
            kind: 'removed',
            path: `/${leftElements[index].name}[${index}]`,
            left: `<${leftElements[index].name}>`,
            right: '',
          })
        }
      } else if (rightElements.length > leftElements.length) {
        for (let index = shared; index < rightElements.length; index += 1) {
          differences.push({
            kind: 'added',
            path: `/${rightElements[index].name}[${index}]`,
            left: '',
            right: `<${rightElements[index].name}>`,
          })
        }
      }

      // The declarations, comments and CDATA sections that sit outside the
      // root element are compared on their own. They are the same kind of
      // thing in the same order, so a difference among them is reported at
      // the place it stands.
      const leftExtras = left.roots.filter((node) => node.kind !== 'element')
      const rightExtras = right.roots.filter((node) => node.kind !== 'element')
      const extraShared = Math.min(leftExtras.length, rightExtras.length)
      for (let index = 0; index < extraShared; index += 1) {
        compareXmlNodes(leftExtras[index], rightExtras[index], differences, [], 0)
      }
      if (leftExtras.length > rightExtras.length) {
        for (let index = extraShared; index < leftExtras.length; index += 1) {
          differences.push({
            kind: 'removed',
            path: `/${leftExtras[index].kind}[${index}]`,
            left: leftExtras[index].value,
            right: '',
          })
        }
      } else if (rightExtras.length > leftExtras.length) {
        for (let index = extraShared; index < rightExtras.length; index += 1) {
          differences.push({
            kind: 'added',
            path: `/${rightExtras[index].kind}[${index}]`,
            left: '',
            right: rightExtras[index].value,
          })
        }
      }
      return { ok: true, equal: differences.length === 0, differences }
    }

    /** The pair of documents the XML comparison tool can load. */
    const XML_COMPARE_SAMPLE = [
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<catalog>',
        '  <book id="1"><title>First</title><author>Ada</author></book>',
        '  <book id="2"><title>Second</title><author>Grace</author></book>',
        '</catalog>',
      ].join('\n'),
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<catalog>',
        '  <book id="1"><title>First</title><author>Ada</author></book>',
        '  <book id="2"><title>Second Edition</title><author>Grace</author></book>',
        '  <book id="3"><title>Third</title><author>Alan</author></book>',
        '</catalog>',
      ].join('\n'),
    ].join('\n---\n')

    /* ------------------------------------------------------------------ *
     * Components
     * ------------------------------------------------------------------ */

    /**
     * The grid glyph: the sidebar entry and the plugin's own mark.
     * @param props.size - square edge in pixels.
     * @returns decorative grid of squares.
     */
    function GridGlyph({ size }) {
      const edge = typeof size === 'number' && size > 0 ? size : 18
      return h('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        width: edge,
        height: edge,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': true,
        focusable: 'false',
        style: { display: 'block' },
      },
      h('rect', { x: 3, y: 3, width: 8, height: 8, rx: 2, stroke: 'currentColor', strokeWidth: 1.6 }),
      h('rect', { x: 13, y: 3, width: 8, height: 8, rx: 2, stroke: 'currentColor', strokeWidth: 1.6 }),
      h('rect', { x: 3, y: 13, width: 8, height: 8, rx: 2, stroke: 'currentColor', strokeWidth: 1.6 }),
      h('rect', { x: 13, y: 13, width: 8, height: 8, rx: 2, stroke: 'currentColor', strokeWidth: 1.6 }))
    }

    /**
     * Copy text to the clipboard, falling back to a hidden textarea when the
     * async clipboard API is unavailable or refused.
     * @param text - the text to copy.
     * @returns whether the copy succeeded.
     */
    async function copyText(text) {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text)
          return true
        }
      } catch {
        // Fall through to the manual path below.
      }
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', 'true')
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.append(area)
        area.select()
        const ok = document.execCommand('copy')
        area.remove()
        return ok
      } catch {
        return false
      }
    }

    /**
     * One tool card: an icon, a title, a description and an open affordance.
     * @param props.t - localized text.
     * @param props.title - card title.
     * @param props.desc - card description.
     * @param props.badge - short mark shown in the icon slot.
     * @param props.onOpen - opens the tool.
     * @returns the card element.
     */
    function ToolCard({ t, title, desc, badge, onOpen }) {
      return h('button', {
        type: 'button',
        className: 'dtb-card',
        onClick: onOpen,
        'aria-label': `${t('card.open')}: ${title}`,
      },
      h('div', { className: 'dtb-card-top' },
        h('span', { className: 'dtb-card-icon', 'aria-hidden': true }, badge),
        h('h2', null, title)),
      h('p', null, desc),
      h('span', { className: 'dtb-card-foot' }, t('card.open'), ' →'))
    }

    /**
     * The toolbox panel: the card grid, or one tool when one is open.
     * @param props.t - localized text.
     * @param props.toolState - the signal holding the open tool's id.
     * @param props.selectTool - opens one tool.
     * @param props.back - returns to the grid.
     * @returns the panel page.
     */
    function ToolboxPage({ t, toolState, selectTool, back }) {
      const openTool = useValue(toolState)
      const heading = h('div', { className: 'dtb-heading' },
        h('div', { className: 'dtb-heading-main' },
          h('h1', null, t('page.title')),
          h('p', { className: 'dtb-lede' }, t('page.desc'))),
        h('div', { className: 'dtb-heading-actions' },
          openTool === null
            ? null
            : h('button', {
              type: 'button',
              className: 'dtb-btn',
              onClick: back,
            }, `← ${t('tool.back')}`)))

      if (openTool === TOOL_JSON) {
        return h('section', { className: 'dtb-page', 'aria-label': t('tool.json.title') },
          h('div', { className: 'dtb-scroll' },
            h('div', { className: 'dtb-content' },
              heading,
              h(FormatterTool, {
                t,
                kind: 'json',
                title: t('tool.json.title'),
                desc: t('tool.json.desc'),
              }))))
      }
      if (openTool === TOOL_XML) {
        return h('section', { className: 'dtb-page', 'aria-label': t('tool.xml.title') },
          h('div', { className: 'dtb-scroll' },
            h('div', { className: 'dtb-content' },
              heading,
              h(FormatterTool, {
                t,
                kind: 'xml',
                title: t('tool.xml.title'),
                desc: t('tool.xml.desc'),
              }))))
      }
      if (openTool === TOOL_COMPARE) {
        return h('section', { className: 'dtb-page', 'aria-label': t('tool.compare.title') },
          h('div', { className: 'dtb-scroll' },
            h('div', { className: 'dtb-content' },
              heading,
              h(CompareTool, {
                t,
                kind: 'json',
                title: t('tool.compare.title'),
                desc: t('tool.compare.desc'),
              }))))
      }
      if (openTool === TOOL_COMPARE_XML) {
        return h('section', { className: 'dtb-page', 'aria-label': t('tool.compareXml.title') },
          h('div', { className: 'dtb-scroll' },
            h('div', { className: 'dtb-content' },
              heading,
              h(CompareTool, {
                t,
                kind: 'xml',
                title: t('tool.compareXml.title'),
                desc: t('tool.compareXml.desc'),
              }))))
      }

      return h('section', { className: 'dtb-page', 'aria-label': t('page.title') },
        h('div', { className: 'dtb-scroll' },
          h('div', { className: 'dtb-content' },
            heading,
            h('div', { className: 'dtb-grid' },
              h(ToolCard, {
                t,
                title: t('card.json.title'),
                desc: t('card.json.desc'),
                badge: '{ }',
                onOpen: () => { selectTool(TOOL_JSON) },
              }),
              h(ToolCard, {
                t,
                title: t('card.xml.title'),
                desc: t('card.xml.desc'),
                badge: '< >',
                onOpen: () => { selectTool(TOOL_XML) },
              }),
              h(ToolCard, {
                t,
                title: t('card.compare.title'),
                desc: t('card.compare.desc'),
                badge: '= ≠',
                onOpen: () => { selectTool(TOOL_COMPARE) },
              }),
              h(ToolCard, {
                t,
                title: t('card.compareXml.title'),
                desc: t('card.compareXml.desc'),
                badge: '< > ≠',
                onOpen: () => { selectTool(TOOL_COMPARE_XML) },
              })),
            h('p', { className: 'dtb-note' }, t('page.note')))))
    }

    /**
     * One formatter: an input, an output, and the controls that connect them.
     * @param props.t - localized text.
     * @param props.kind - 'json' or 'xml'.
     * @param props.title - the tool title.
     * @param props.desc - the tool description.
     * @returns the tool element.
     */
    function FormatterTool({ t, kind, title, desc }) {
      const [input, setInput] = useState('')
      const [output, setOutput] = useState('')
      const [error, setError] = useState('')
      const [indent, setIndent] = useState(2)
      const [copied, setCopied] = useState(false)
      const copyTimer = useRef(null)

      useEffect(() => {
        return () => {
          if (copyTimer.current !== null) clearTimeout(copyTimer.current)
        }
      }, [])

      const run = useCallback(() => {
        const source = input.trim()
        if (source === '') {
          setOutput('')
          setError('')
          return
        }
        const result = kind === 'json' ? formatJson(source, indent) : formatXml(source)
        if (result.ok) {
          setOutput(result.text)
          setError('')
        } else {
          setOutput('')
          setError(kind === 'json' ? t('error.json', { message: result.message }) : t('error.xml', { message: result.message }))
        }
      }, [input, indent, kind, t])

      const copy = async () => {
        if (output === '') return
        const ok = await copyText(output)
        if (!ok) return
        setCopied(true)
        if (copyTimer.current !== null) clearTimeout(copyTimer.current)
        copyTimer.current = setTimeout(() => {
          copyTimer.current = null
          setCopied(false)
        }, 1800)
      }

      const sample = kind === 'json' ? JSON_SAMPLE : XML_SAMPLE
      const placeholder = kind === 'json' ? t('placeholder.json') : t('placeholder.xml')
      const statusText = error !== ''
        ? t('status.invalid')
        : output !== '' ? t('status.ok') : t('status.empty')

      return h('section', { className: 'dtb-tool' },
        h('div', { className: 'dtb-tool-head' },
          h('h2', null, title),
          h('p', null, desc)),
        h('div', { className: 'dtb-row' },
          h('div', { className: 'dtb-row-head' },
            h('label', { className: 'dtb-label', htmlFor: `dtb-input-${kind}` }, t('field.input')),
            kind === 'json'
              ? h('div', { className: 'dtb-inline' },
                h('label', { className: 'dtb-label', htmlFor: 'dtb-indent' }, t('field.indent')),
                h('select', {
                  id: 'dtb-indent',
                  className: 'dtb-select',
                  value: String(indent),
                  onChange: (event) => { setIndent(Number(event.target.value)) },
                }, JSON_INDENTS.map((size) => h('option', { key: size, value: String(size) },
                  t('field.indentValue', { count: String(size) })))),
                h('button', {
                  type: 'button',
                  className: 'dtb-btn',
                  onClick: () => { setInput(sample); setOutput(''); setError('') },
                }, t('action.sample')))
              : h('button', {
                type: 'button',
                className: 'dtb-btn',
                onClick: () => { setInput(sample); setOutput(''); setError('') },
              }, t('action.sample'))),
          h('textarea', {
            id: `dtb-input-${kind}`,
            className: 'dtb-textarea',
            spellCheck: false,
            placeholder,
            value: input,
            'aria-invalid': error === '' ? undefined : 'true',
            onChange: (event) => { setInput(event.target.value.slice(0, MAX_INPUT)) },
          }),
          h('div', { className: 'dtb-inline' },
            h('button', {
              type: 'button',
              className: 'dtb-btn',
              'data-variant': 'primary',
              disabled: input.trim() === '',
              onClick: run,
            }, t('action.format')),
            h('button', {
              type: 'button',
              className: 'dtb-btn',
              disabled: input.trim() === '',
              onClick: () => { setInput(''); setOutput(''); setError('') },
            }, t('action.clear')),
            h('span', { className: 'dtb-badge' }, t('hint.privacy')))),
        h('div', { className: 'dtb-row' },
          h('div', { className: 'dtb-row-head' },
            h('span', { className: 'dtb-label' }, t('field.output')),
            h('div', { className: 'dtb-inline' },
              h('span', {
                className: 'dtb-status',
                'data-kind': error === '' ? 'idle' : 'error',
                role: 'status',
              }, statusText),
              h('button', {
                type: 'button',
                className: 'dtb-btn',
                disabled: output === '',
                onClick: copy,
              }, copied ? t('action.copied') : t('action.copy')))),
          error === ''
            ? null
            : h('p', { className: 'dtb-error', role: 'alert' }, error),
          h('textarea', {
            className: 'dtb-textarea',
            'data-readonly': 'true',
            readOnly: true,
            spellCheck: false,
            value: output,
            'aria-label': t('field.output'),
          })))
    }

    /**
     * The JSON comparison tool: two documents side by side and the list of
     * the ways they differ.
     *
     * The comparison runs when the user asks for it, not on every keystroke:
     * a large document takes a moment to walk, and doing that on each
     * character would make the page crawl.
     * @param props.t - localized text.
     * @param props.title - the tool title.
     * @param props.desc - the tool description.
     * @returns the tool element.
     */
    function CompareTool({ t, kind, title, desc }) {
      const [left, setLeft] = useState('')
      const [right, setRight] = useState('')
      const [result, setResult] = useState(null)
      const [error, setError] = useState('')

      const run = useCallback(() => {
        const leftText = left.trim()
        const rightText = right.trim()
        if (leftText === '' || rightText === '') {
          setResult(null)
          setError('')
          return
        }
        const outcome = kind === 'json' ? compareJson(leftText, rightText) : compareXml(leftText, rightText)
        if (!outcome.ok) {
          setResult(null)
          const key = kind === 'json'
            ? (outcome.side === 'left' ? 'error.jsonLeft' : 'error.jsonRight')
            : (outcome.side === 'left' ? 'error.xmlLeft' : 'error.xmlRight')
          setError(t(key, { message: outcome.message }))
          return
        }
        setResult(outcome)
        setError('')
      }, [left, right, t])

      const clear = useCallback(() => {
        setLeft('')
        setRight('')
        setResult(null)
        setError('')
      }, [])

      const loadSample = useCallback(() => {
        const sample = kind === 'json' ? JSON_COMPARE_SAMPLE : XML_COMPARE_SAMPLE
        const [sampleLeft, sampleRight] = sample.split('\n---\n')
        setLeft(sampleLeft)
        setRight(sampleRight)
        setResult(null)
        setError('')
      }, [kind])

      const differences = result === null ? [] : result.differences
      const statusText = error !== ''
        ? t('status.invalid')
        : result === null
          ? t('status.emptyCompare')
          : result.equal ? t('status.same') : t('status.different', { count: String(differences.length) })

      const sideLabel = (kind, side) => {
        if (kind === 'added') return side === 'left' ? t('diff.absent') : t('diff.added')
        if (kind === 'removed') return side === 'left' ? t('diff.removed') : t('diff.absent')
        return side === 'left' ? t('diff.left') : t('diff.right')
      }

      return h('section', { className: 'dtb-tool' },
        h('div', { className: 'dtb-tool-head' },
          h('h2', null, title),
          h('p', null, desc)),
        h('div', { className: 'dtb-compare' },
          h('div', { className: 'dtb-row' },
            h('div', { className: 'dtb-row-head' },
              h('label', { className: 'dtb-label', htmlFor: `dtb-compare-left-${kind}` }, t('field.left'))),
            h('textarea', {
              id: `dtb-compare-left-${kind}`,
              className: 'dtb-textarea',
              spellCheck: false,
              value: left,
              'aria-invalid': error !== '' ? 'true' : undefined,
              onChange: (event) => { setLeft(event.target.value) },
            })),
          h('div', { className: 'dtb-row' },
            h('div', { className: 'dtb-row-head' },
              h('label', { className: 'dtb-label', htmlFor: `dtb-compare-right-${kind}` }, t('field.right'))),
            h('textarea', {
              id: `dtb-compare-right-${kind}`,
              className: 'dtb-textarea',
              spellCheck: false,
              value: right,
              'aria-invalid': error !== '' ? 'true' : undefined,
              onChange: (event) => { setRight(event.target.value) },
            }))),
        h('div', { className: 'dtb-row' },
          h('div', { className: 'dtb-row-head' },
            h('span', { className: 'dtb-label' }, t('field.differences')),
            h('div', { className: 'dtb-inline' },
              h('span', {
                className: 'dtb-status',
                'data-kind': error !== '' ? 'error' : 'idle',
                role: 'status',
              }, statusText),
              h('button', {
                type: 'button',
                className: 'dtb-btn',
                'data-variant': 'primary',
                disabled: left.trim() === '' || right.trim() === '',
                onClick: run,
              }, t('action.compare')),
              h('button', {
                type: 'button',
                className: 'dtb-btn',
                onClick: loadSample,
              }, t('action.sample')),
              h('button', {
                type: 'button',
                className: 'dtb-btn',
                disabled: left === '' && right === '',
                onClick: clear,
              }, t('action.clear')))),
          error === ''
            ? null
            : h('p', { className: 'dtb-error', role: 'alert' }, error),
          result !== null && differences.length === 0
            ? h('p', { className: 'dtb-diff-empty' }, t('status.same'))
            : null,
          differences.length === 0
            ? null
            : h('ul', { className: 'dtb-diff' },
              differences.map((difference, index) => h('li', { key: `${difference.path}-${index}` },
                h('span', { className: 'dtb-diff-kind' },
                  t(difference.kind === 'added' ? 'diff.kindAdded' : difference.kind === 'removed' ? 'diff.kindRemoved' : 'diff.kindChanged')),
                h('div', { className: 'dtb-diff-values' },
                  h('span', { className: 'dtb-diff-path' }, difference.path),
                  difference.kind === 'type'
                    ? h(React.Fragment, null,
                      h('span', { className: 'dtb-diff-old' }, difference.left),
                      h('span', { className: 'dtb-diff-new' }, difference.right))
                    : h(React.Fragment, null,
                      h('span', { className: 'dtb-diff-old' }, sideLabel(difference.kind, 'left')),
                      h('span', { className: 'dtb-diff-new' }, sideLabel(difference.kind, 'right')))))))))
    }

    /* ------------------------------------------------------------------ *
     * Plugin
     * ------------------------------------------------------------------ */

    return {
      inject: ['slots', 'locale', 'layout'],

      /**
       * Install the dictionaries, the sidebar entry, the card grid and the
       * two formatters.
       * @param ctx - Client root context.
       */
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'en', EN), 'toolbox: English dictionary')
        ctx.effect(() => ctx.locale.register(NS, 'zh', ZH), 'toolbox: Chinese dictionary')
        const t = ctx.locale.bind(NS)

        // The plugin's own stylesheet: the page, the card grid and the tools
        // are class-scoped here, so one element carries them all.
        ctx.effect(() => {
          const sheet = document.createElement('style')
          sheet.setAttribute('data-plugin', 'dsh-toolbox')
          sheet.setAttribute('data-dsh-toolbox', 'styles')
          sheet.textContent = STYLES
          document.head.append(sheet)
          return () => { sheet.remove() }
        }, 'toolbox: stylesheet')

        // Which tool the panel shows. The grid is the default; a card opens one
        // tool and "back" returns to the grid. The state lives in a signal so
        // the panel re-renders when it changes.
        const toolState = createSignal(null)

        const selectTool = (toolId) => {
          toolState.set(toolId)
          ctx.layout.selectPanel(PANEL_ID)
        }

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: SIDEBAR_ORDER,
          locale: NS,
          label: () => t('nav.label'),
        }, GridGlyph))

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          // The signal is handed over, not its value: the panel reads it with
          // `useValue` inside its own render, where the hook belongs.
          inject: () => ({
            t,
            toolState,
            selectTool,
            back: () => { toolState.set(null) },
          }),
        }, ToolboxPage))
      },
    }
  },
})
