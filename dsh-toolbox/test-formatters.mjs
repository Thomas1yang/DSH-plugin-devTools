/**
 * Standalone test of the formatter logic in client.js.
 *
 * The functions below are extracted from client.js at run time, so the test
 * exercises the same code the browser runs rather than a copy that can drift.
 */

import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./client.js', import.meta.url), 'utf8')

/**
 * Pull one named function out of the plugin source.
 *
 * The scan skips string literals, template literals and comments, so a brace
 * inside a message such as `'{count} spaces'` does not end the function early.
 * The returned text is the whole declaration, parameters included, so it can
 * be handed straight to `new Function` as an expression.
 * @param name - the function name.
 * @returns the function declaration source.
 */
function extractSource(name) {
  const start = source.indexOf(`function ${name}(`)
  if (start === -1) throw new Error(`function ${name} not found`)
  const bodyStart = source.indexOf('{', start)
  let depth = 0
  let index = bodyStart
  let quote = null
  while (index < source.length) {
    const char = source[index]
    // Comments are detected before quotes, because a comment may itself
    // contain a quote character (a backtick in a JSDoc example, say) that
    // would otherwise open a string and swallow the rest of the source.
    if (char === '/' && source[index + 1] === '/') {
      const newline = source.indexOf('\n', index)
      index = newline === -1 ? source.length : newline
      continue
    }
    if (char === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index)
      index = end === -1 ? source.length : end + 2
      continue
    }
    if (quote !== null) {
      if (char === '\\') {
        index += 2
        continue
      }
      if (char === quote) quote = null
      index += 1
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      index += 1
      continue
    }
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
    index += 1
  }
  throw new Error(`function ${name} is not closed`)
}

// The extracted functions call each other and close over XML_TOKEN, so they
// are created together inside one scope that holds those names. The helper is
// passed under a different name so it does not collide with the declaration.
const describeJsonError = new Function(`return (${extractSource('describeJsonError')})`)()
const formatJson = new Function(
  'describeJsonErrorHelper',
  `const describeJsonError = describeJsonErrorHelper; return (${extractSource('formatJson')})`,
)(describeJsonError)

// The token regex is a module-level constant; pull it the same way.
const tokenMatch = source.match(/const XML_TOKEN = (\/.*\/[a-z]*)/)
if (tokenMatch === null) throw new Error('XML_TOKEN not found')
const XML_TOKEN = new Function(`return ${tokenMatch[1]}`)()

// formatXml closes over XML_TOKEN, so it is created inside a scope that has it.
const formatXmlWithToken = new Function('XML_TOKEN', `return (${extractSource('formatXml')})`)(XML_TOKEN)

let failures = 0
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) {
    failures += 1
    console.log(`FAIL ${name}\n  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`)
  } else {
    console.log(`ok   ${name}`)
  }
}

// ---- JSON --------------------------------------------------------------

check('json indent 2', formatJson('{"a":1}', 2), { ok: true, text: '{\n  "a": 1\n}' })
check('json indent 4', formatJson('{"a":1}', 4), { ok: true, text: '{\n    "a": 1\n}' })
check('json array', formatJson('[1,2]', 2), { ok: true, text: '[\n  1,\n  2\n]' })
check('json scalar', formatJson('"x"', 2), { ok: true, text: '"x"' })
check('json empty object', formatJson('{}', 2), { ok: true, text: '{}' })
check('json unicode kept', formatJson('{"名":"值"}', 2), { ok: true, text: '{\n  "名": "值"\n}' })
check('json nested', formatJson('{"a":{"b":[1]}}', 2), {
  ok: true,
  text: '{\n  "a": {\n    "b": [\n      1\n    ]\n  }\n}',
})

const bad = formatJson('{"a":}', 2)
check('json invalid ok flag', bad.ok, false)
check('json invalid has message', typeof bad.message === 'string' && bad.message.length > 0, true)
console.log(`     json error message: ${bad.message}`)

const trailing = formatJson('{"a":1} extra', 2)
check('json trailing garbage rejected', trailing.ok, false)
console.log(`     json trailing message: ${trailing.message}`)

// ---- XML ---------------------------------------------------------------

check('xml simple', formatXmlWithToken('<a><b>1</b></a>'), {
  ok: true,
  text: '<a>\n  <b>1</b>\n</a>',
})

check('xml nested', formatXmlWithToken('<r><a><b/></a></r>'), {
  ok: true,
  text: '<r>\n  <a>\n    <b/>\n  </a>\n</r>',
})

const withDecl = formatXmlWithToken('<?xml version="1.0"?>\n<!-- note -->\n<r><a>1</a></r>')
check('xml decl+comment ok', withDecl.ok, true)
check('xml decl kept', withDecl.text.split('\n')[0], '<?xml version="1.0"?>')
check('xml comment kept', withDecl.text.includes('<!-- note -->'), true)

const cdata = formatXmlWithToken('<r><a><![CDATA[<not/>]]></a></r>')
check('xml cdata ok', cdata.ok, true)
check('xml cdata kept', cdata.text.includes('<![CDATA[<not/>]]>'), true)

check('xml self closing', formatXmlWithToken('<r><a/></r>'), { ok: true, text: '<r>\n  <a/>\n</r>' })
check('xml text content', formatXmlWithToken('<a>hello</a>'), { ok: true, text: '<a>hello</a>' })
check('xml doctype kept', formatXmlWithToken('<!DOCTYPE r>\n<r><a>1</a></r>').text.includes('<!DOCTYPE r>'), true)

check('xml no element', formatXmlWithToken('hello'), { ok: false, message: 'no element found' })
const unbalanced = formatXmlWithToken('<a><b></a></b>')
check('xml mismatched nesting rejected', unbalanced.ok, false)
console.log(`     xml mismatched message: ${unbalanced.message}`)

const unclosed = formatXmlWithToken('<a><b>1</b>')
check('xml unclosed rejected', unclosed.ok, false)
console.log(`     xml unclosed message: ${unclosed.message}`)

const once = formatXmlWithToken('<r><a><b>1</b></a></r>')
const twice = formatXmlWithToken(once.text)
check('xml idempotent', twice.text, once.text)

// A realistic document keeps its shape.
const realistic = formatXmlWithToken(
  '<?xml version="1.0" encoding="UTF-8"?>\n<catalog>\n<book id="1"><title>First</title><author>Ada</author></book>\n</catalog>',
)
check('xml realistic ok', realistic.ok, true)
check(
  'xml realistic shape',
  realistic.text,
  '<?xml version="1.0" encoding="UTF-8"?>\n<catalog>\n  <book id="1">\n    <title>First</title>\n    <author>Ada</author>\n  </book>\n</catalog>',
)

// Attributes are kept verbatim on the tag.
check('xml attributes kept', formatXmlWithToken('<a id="1" x="2"/>').text, '<a id="1" x="2"/>')
check('xml attribute on parent', formatXmlWithToken('<a k="v"><b/></a>').text, '<a k="v">\n  <b/>\n</a>')
// Namespaced names are matched by their full name.
check('xml namespace prefix', formatXmlWithToken('<ns:r xmlns:ns="u"><ns:c/></ns:r>'), {
  ok: true,
  text: '<ns:r xmlns:ns="u">\n  <ns:c/>\n</ns:r>',
})

// Entities in text content survive.
check('xml entity kept', formatXmlWithToken('<a>x &amp; y</a>').text, '<a>x &amp; y</a>')

// An element with both text and a child keeps the text on the opening line.
check('xml mixed content', formatXmlWithToken('<a>text<b/></a>').text, '<a>text\n  <b/>\n</a>')

// Empty elements and the root alone.
check('xml root only', formatXmlWithToken('<r/>').text, '<r/>')
check('xml root with attrs', formatXmlWithToken('<r a="1"/>').text, '<r a="1"/>')

// A document with a leading comment keeps the comment on its own line.
check('xml leading comment', formatXmlWithToken('<!-- c -->\n<r/>').text, '<!-- c -->\n<r/>')

// Whitespace between tags is dropped, so the result is stable under a second
// pass.
const messy = formatXmlWithToken('<r>\n\n   <a>  1  </a>\n\n</r>')
check('xml whitespace normalised', messy.text, '<r>\n  <a>1</a>\n</r>')
check('xml stable on second pass', formatXmlWithToken(messy.text).text, messy.text)

// A tag whose name carries a hyphen or an underscore is matched correctly.
check('xml hyphenated name', formatXmlWithToken('<my-el><sub-item>1</sub-item></my-el>'), {
  ok: true,
  text: '<my-el>\n  <sub-item>1</sub-item>\n</my-el>',
})

// A closing tag with attributes is not valid XML but must not crash.
const oddClose = formatXmlWithToken('<a></a x="1">')
check('xml odd closing tag handled', oddClose.ok === true || oddClose.ok === false, true)

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
