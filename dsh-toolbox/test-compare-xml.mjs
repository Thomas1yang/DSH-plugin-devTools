/**
 * Standalone test of the XML comparison logic in client.js.
 *
 * The functions below are extracted from client.js at run time, so the test
 * exercises the same code the browser runs rather than a copy that can drift.
 */

import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./client.js', import.meta.url), 'utf8')

/**
 * Pull one named function out of the plugin source.
 *
 * The scan skips string literals, template literals, comments and regular
 * expressions, so a brace inside a message such as `'{count} spaces'` or
 * inside a character class such as `/[^>\s/]+/` does not end the function
 * early.
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
    // contain a quote character that would otherwise open a string and swallow
    // the rest of the source.
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
    // A regular expression literal. It is told apart from a division by what
    // came before it: a division follows a value, while a literal follows an
    // operator or an opening bracket. The check comes after the quote check,
    // so a slash inside a string or a template literal is never taken for a
    // literal.
    if (quote === null && char === '/' && isRegexPosition(source, index)) {
      index = skipRegex(source, index)
      continue
    }
    if (quote !== null) {
      if (char === '\\') {
        index += 2
        continue
      }
      // Inside a template literal, `${` opens an expression whose braces are
      // balanced on their own; the braces must not count towards the
      // function's depth.
      if (quote === '`' && char === '$' && source[index + 1] === '{') {
        index = skipInterpolation(source, index + 2)
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

/**
 * The place just past the interpolation that starts at the given place.
 *
 * The expression inside `${...}` is balanced on its own, so its braces are
 * counted apart from the function's.
 * @param text - the whole source.
 * @param index - the place just after the opening brace.
 * @returns the place just past the closing brace.
 */
function skipInterpolation(text, index) {
  let depth = 1
  let position = index
  let quote = null
  while (position < text.length) {
    const char = text[position]
    if (char === '\\') {
      position += 2
      continue
    }
    if (quote !== null) {
      if (char === quote) quote = null
      position += 1
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      position += 1
      continue
    }
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return position + 1
    }
    position += 1
  }
  return position
}

/**
 * Whether the slash at the given place starts a regular expression literal
 * rather than a division.
 * @param text - the whole source.
 * @param index - the place of the slash.
 * @returns whether a literal starts here.
 */
function isRegexPosition(text, index) {
  let position = index - 1
  while (position >= 0 && /\s/.test(text[position])) position -= 1
  if (position < 0) return true
  const before = text[position]
  // After a value, a slash is a division.
  if (/[\w$)\]]/.test(before)) return false
  return true
}

/**
 * The place just past the regular expression literal that starts at the given
 * place.
 * @param text - the whole source.
 * @param index - the place of the opening slash.
 * @returns the place just past the literal.
 */
function skipRegex(text, index) {
  let position = index + 1
  let inClass = false
  while (position < text.length) {
    const char = text[position]
    if (char === '\\') {
      position += 2
      continue
    }
    if (char === '[') inClass = true
    else if (char === ']') inClass = false
    else if (char === '/' && !inClass) {
      position += 1
      // The flags follow the closing slash.
      while (position < text.length && /[a-z]/.test(text[position])) position += 1
      return position
    } else if (char === '\n') {
      return position
    }
    position += 1
  }
  return position
}

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

// The extracted functions call each other and close over the module's own
// constants, so they are created together inside one scope that holds those
// names under the names the extracted source uses.
const scope = {
  XML_TOKEN: null,
  xmlTagName: null,
  xmlAttributes: null,
  xmlPathText: null,
  parseXml: null,
  compareXmlNodes: null,
  MAX_XML_DEPTH: null,
  MAX_XML_DIFFERENCES: null,
}

/**
 * Build one helper inside a scope that holds the module's own names.
 *
 * The helper is turned into a declaration rather than an expression, so that
 * a recursive call inside it reaches the helper itself and not a name of the
 * same name in the surrounding scope.
 * @param name - the function name.
 * @returns the function.
 */
function makeHelper(name) {
  const keys = Object.keys(scope)
  const values = keys.map((key) => scope[key])
  return new Function(...keys, `${extractSource(name)}; return ${name}`)(...values)
}

const tokenMatch = source.match(/const XML_TOKEN = (\/.*\/[a-z]*)/)
if (tokenMatch === null) throw new Error('XML_TOKEN not found')
scope.XML_TOKEN = new Function(`return ${tokenMatch[1]}`)()
scope.MAX_XML_DEPTH = Number(source.match(/const MAX_XML_DEPTH = (\d+)/)[1])
scope.MAX_XML_DIFFERENCES = Number(source.match(/const MAX_XML_DIFFERENCES = (\d+)/)[1])

scope.xmlTagName = makeHelper('xmlTagName')
scope.xmlAttributes = makeHelper('xmlAttributes')
scope.xmlPathText = makeHelper('xmlPathText')

const xmlTagName = scope.xmlTagName
const xmlAttributes = scope.xmlAttributes
const xmlPathText = scope.xmlPathText

const parseXml = makeHelper('parseXml')
// The caller needs the parser, so it goes into the scope now that it is
// built.
scope.parseXml = parseXml
scope.compareXmlNodes = makeHelper('compareXmlNodes')
const compareXml = makeHelper('compareXml')

// ---- attributes ---------------------------------------------------------

check('attributes: one pair', xmlAttributes('<a id="1">'), [{ name: 'id', value: '1' }])
check('attributes: two pairs', xmlAttributes('<a id="1" name="x">'), [
  { name: 'id', value: '1' },
  { name: 'name', value: 'x' },
])
check('attributes: single quotes', xmlAttributes("<a id='1'>"), [{ name: 'id', value: '1' }])
check('attributes: no attributes', xmlAttributes('<a>'), [])
check('attributes: a self-closing tag', xmlAttributes('<a id="1"/>'), [{ name: 'id', value: '1' }])
check('attributes: a valueless attribute', xmlAttributes('<a flag>'), [{ name: 'flag', value: '' }])
check('attributes: the order they were written', xmlAttributes('<a b="2" a="1">').map((a) => a.name), ['b', 'a'])

// ---- parsing ------------------------------------------------------------

const parsed = parseXml('<root><a id="1">text</a></root>')
check('parse: it works', parsed.ok, true)
check('parse: one root', parsed.roots.length, 1)
check('parse: the root name', parsed.roots[0].name, 'root')
check('parse: one child', parsed.roots[0].children.length, 1)
check('parse: the child name', parsed.roots[0].children[0].name, 'a')
check('parse: the child text', parsed.roots[0].children[0].text, 'text')
check('parse: the child attributes', parsed.roots[0].children[0].attributes, [{ name: 'id', value: '1' }])

check('parse: a self-closing element has no children', parseXml('<a/>').roots[0].children.length, 0)
check('parse: a declaration is kept', parseXml('<?xml version="1.0"?><a/>').roots.length, 2)
check('parse: a comment is kept', parseXml('<a><!-- note --></a>').roots[0].children.length, 1)
check('parse: a comment keeps its text', parseXml('<a><!-- note --></a>').roots[0].children[0].value, '<!-- note -->')
check('parse: a CDATA section keeps its text', parseXml('<a><![CDATA[x]]></a>').roots[0].children[0].value, 'x')
check('parse: nested elements', parseXml('<a><b><c/></b></a>').roots[0].children[0].children[0].name, 'c')

check('parse: no element is an error', parseXml('just text').ok, false)
check('parse: no element says so', parseXml('just text').message, 'no element found')
check('parse: a mismatched closing tag is an error', parseXml('<a></b>').ok, false)
check('parse: a mismatched closing tag says so', parseXml('<a></b>').message, 'unexpected closing tag </b>')
check('parse: an unclosed element is an error', parseXml('<a><b></a>').ok, false)
check('parse: an unclosed element says so', parseXml('<a>').message, 'unclosed element <a>')

// ---- equality -----------------------------------------------------------

check('same documents', compareXml('<a><b>1</b></a>', '<a><b>1</b></a>').equal, true)
check('same documents report no differences', compareXml('<a><b>1</b></a>', '<a><b>1</b></a>').differences, [])
check('whitespace between tags does not matter', compareXml('<a>\n  <b>1</b>\n</a>', '<a><b>1</b></a>').equal, true)
check('attribute order does not matter', compareXml('<a x="1" y="2"/>', '<a y="2" x="1"/>').equal, true)
check('a declaration is reported when one side has it', compareXml('<?xml version="1.0"?><a/>', '<a/>').differences.length, 1)
check('a declaration is reported as removed', compareXml('<?xml version="1.0"?><a/>', '<a/>').differences[0].kind, 'removed')
check('two documents with the same declaration are the same', compareXml('<?xml version="1.0"?><a/>', '<?xml version="1.0"?><a/>').equal, true)
check('two documents with different declarations are not the same', compareXml('<?xml version="1.0"?><a/>', '<?xml version="2.0"?><a/>').equal, false)

// ---- values that changed ------------------------------------------------

const textChanged = compareXml('<a><b>1</b></a>', '<a><b>2</b></a>')
check('a changed text is not equal', textChanged.equal, false)
check('a changed text reports one difference', textChanged.differences.length, 1)
check('a changed text reports the path', textChanged.differences[0].path, '/a/b/text()')
check('a changed text reports both sides', [textChanged.differences[0].left, textChanged.differences[0].right], ['1', '2'])

const attrChanged = compareXml('<a id="1"/>', '<a id="2"/>')
check('a changed attribute is not equal', attrChanged.equal, false)
check('a changed attribute reports the path', attrChanged.differences[0].path, '/a/@id')
check('a changed attribute reports both sides', [attrChanged.differences[0].left, attrChanged.differences[0].right], ['1', '2'])

const nameChanged = compareXml('<a><b/></a>', '<a><c/></a>')
check('a changed element name is not equal', nameChanged.equal, false)
check('a changed element name reports the path', nameChanged.differences[0].path, '/a/b')

// ---- attributes added and removed ---------------------------------------

const attrAdded = compareXml('<a/>', '<a id="1"/>')
check('an added attribute is not equal', attrAdded.equal, false)
check('an added attribute reports the kind', attrAdded.differences[0].kind, 'added')
check('an added attribute reports the path', attrAdded.differences[0].path, '/a/@id')
check('an added attribute reports only the right side', [attrAdded.differences[0].left, attrAdded.differences[0].right], ['', '1'])

const attrRemoved = compareXml('<a id="1"/>', '<a/>')
check('a removed attribute reports the kind', attrRemoved.differences[0].kind, 'removed')
check('a removed attribute reports only the left side', [attrRemoved.differences[0].left, attrRemoved.differences[0].right], ['1', ''])

// ---- children added and removed -----------------------------------------

const childAdded = compareXml('<a><b/></a>', '<a><b/><c/></a>')
check('an added child is not equal', childAdded.equal, false)
check('an added child reports the kind', childAdded.differences[0].kind, 'added')
check('an added child reports the path', childAdded.differences[0].path, '/a/c[1]')

const childRemoved = compareXml('<a><b/><c/></a>', '<a><b/></a>')
check('a removed child reports the kind', childRemoved.differences[0].kind, 'removed')

// ---- comments and CDATA -------------------------------------------------

const commentChanged = compareXml('<a><!-- one --></a>', '<a><!-- two --></a>')
check('a changed comment is not equal', commentChanged.equal, false)
check('a changed comment reports the path', commentChanged.differences[0].path, '/a/comment')

const cdataChanged = compareXml('<a><![CDATA[x]]></a>', '<a><![CDATA[y]]></a>')
check('changed CDATA is not equal', cdataChanged.equal, false)

// ---- invalid input ------------------------------------------------------

const badLeft = compareXml('<a>', '<b/>')
check('an invalid first document is reported', badLeft.ok, false)
check('an invalid first document names the side', badLeft.side, 'left')
check('an invalid first document has a message', typeof badLeft.message === 'string' && badLeft.message.length > 0, true)

const badRight = compareXml('<b/>', '<a></b>')
check('an invalid second document is reported', badRight.ok, false)
check('an invalid second document names the side', badRight.side, 'right')

// ---- the whole pair -----------------------------------------------------

const pair = compareXml(
  '<catalog><book id="1"><title>First</title></book></catalog>',
  '<catalog><book id="1"><title>Second</title></book><book id="2"/></catalog>',
)
check('a whole pair is not equal', pair.equal, false)
check('a whole pair reports two differences', pair.differences.length, 2)
check('a whole pair reports the text path', pair.differences[0].path, '/catalog/book/title/text()')
check('a whole pair reports the added path', pair.differences[1].path, '/catalog/book[1]')

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
