/**
 * Standalone test of the JSON comparison logic in client.js.
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
  describeJsonError: null,
  sameScalar: null,
  sameKind: null,
  sameJson: null,
  describeValue: null,
  pathText: null,
  MAX_COMPARE_DEPTH: null,
  MAX_DIFFERENCES: null,
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

const depthMatch = source.match(/const MAX_COMPARE_DEPTH = (\d+)/)
const limitMatch = source.match(/const MAX_DIFFERENCES = (\d+)/)
scope.MAX_COMPARE_DEPTH = Number(depthMatch[1])
scope.MAX_DIFFERENCES = Number(limitMatch[1])

scope.describeJsonError = makeHelper('describeJsonError')
scope.sameScalar = makeHelper('sameScalar')
scope.sameKind = makeHelper('sameKind')
scope.sameJson = makeHelper('sameJson')
scope.describeValue = makeHelper('describeValue')
scope.pathText = makeHelper('pathText')
const sameJson = scope.sameJson
const compareValues = makeHelper('compareValues')
// The caller needs the walker, and the walker recurses into itself. Both are
// satisfied by putting the walker in the scope now that it is built: inside
// the walker the declaration's own name wins, and the caller finds it here.
scope.compareValues = compareValues

const compareJson = makeHelper('compareJson')

// ---- equality ----------------------------------------------------------

check('same documents', compareJson('{"a":1}', '{"a":1}').equal, true)
check('same documents report no differences', compareJson('{"a":1}', '{"a":1}').differences, [])
check('key order does not matter', compareJson('{"a":1,"b":2}', '{"b":2,"a":1}').equal, true)
check('whitespace does not matter', compareJson('{\n "a" : 1\n}', '{"a":1}').equal, true)
check('two empty objects', compareJson('{}', '{}').equal, true)
check('two empty arrays', compareJson('[]', '[]').equal, true)
check('nested structures', compareJson('{"a":{"b":[1,2]}}', '{"a":{"b":[1,2]}}').equal, true)

// ---- values that changed ------------------------------------------------

const changed = compareJson('{"a":1}', '{"a":2}')
check('changed value is not equal', changed.equal, false)
check('changed value reports one difference', changed.differences.length, 1)
check('changed value reports the path', changed.differences[0].path, '$.a')
check('changed value reports the kind', changed.differences[0].kind, 'type')
check('changed value reports both sides', [changed.differences[0].left, changed.differences[0].right], ['1', '2'])

check('a string change', compareJson('{"a":"x"}', '{"a":"y"}').differences[0].right, '"y"')
check('a boolean change', compareJson('{"a":true}', '{"a":false}').differences[0].right, 'false')
check('null against a value', compareJson('{"a":null}', '{"a":1}').differences[0].kind, 'type')
check('null against null', compareJson('{"a":null}', '{"a":null}').equal, true)

// ---- keys added and removed ---------------------------------------------

const added = compareJson('{"a":1}', '{"a":1,"b":2}')
check('added key is not equal', added.equal, false)
check('added key reports one difference', added.differences.length, 1)
check('added key reports the kind', added.differences[0].kind, 'added')
check('added key reports the path', added.differences[0].path, '$.b')
check('added key reports only the right side', [added.differences[0].left, added.differences[0].right], ['', '2'])

const removed = compareJson('{"a":1,"b":2}', '{"a":1}')
check('removed key reports the kind', removed.differences[0].kind, 'removed')
check('removed key reports the path', removed.differences[0].path, '$.b')
check('removed key reports only the left side', [removed.differences[0].left, removed.differences[0].right], ['2', ''])

// ---- arrays -------------------------------------------------------------

const longer = compareJson('[1,2]', '[1,2,3]')
check('a longer array is not equal', longer.equal, false)
check('a longer array reports one difference', longer.differences.length, 1)
check('a longer array reports the kind', longer.differences[0].kind, 'added')
check('a longer array reports the index path', longer.differences[0].path, '$[2]')

const shorter = compareJson('[1,2,3]', '[1,2]')
check('a shorter array reports the kind', shorter.differences[0].kind, 'removed')

const itemChanged = compareJson('[1,2,3]', '[1,9,3]')
check('a changed item reports its index', itemChanged.differences[0].path, '$[1]')
check('a changed item reports the kind', itemChanged.differences[0].kind, 'type')

// ---- types --------------------------------------------------------------

check('an object against an array', compareJson('{"a":1}', '[1]').differences[0].kind, 'type')
check('an array against an object', compareJson('[1]', '{"a":1}').differences[0].kind, 'type')
check('a number against a string', compareJson('{"a":1}', '{"a":"1"}').differences[0].kind, 'type')

// ---- nested paths -------------------------------------------------------

check('a nested path', compareJson('{"a":{"b":{"c":1}}}', '{"a":{"b":{"c":2}}}').differences[0].path, '$.a.b.c')
check('a nested added path', compareJson('{"a":{"b":1}}', '{"a":{"b":1,"c":2}}').differences[0].path, '$.a.c')
check('an array inside an object', compareJson('{"a":[1,2]}', '{"a":[1,3]}').differences[0].path, '$.a[1]')

// ---- descriptions -------------------------------------------------------

check('an object is described by its size', compareJson('{"a":1}', '{"a":1,"b":{"x":1,"y":2}}').differences[0].right, 'object(2)')
check('an array is described by its length', compareJson('{"a":1}', '{"a":[1,2,3]}').differences[0].right, 'array(3)')
check('a string is described in quotes', compareJson('{"a":1}', '{"a":"x"}').differences[0].right, '"x"')
check('null is described plainly', compareJson('{"a":1}', '{"a":null}').differences[0].right, 'null')

// ---- invalid input ------------------------------------------------------

const badLeft = compareJson('{oops}', '{"a":1}')
check('an invalid first document is reported', badLeft.ok, false)
check('an invalid first document names the side', badLeft.side, 'left')
check('an invalid first document has a message', typeof badLeft.message === 'string' && badLeft.message.length > 0, true)

const badRight = compareJson('{"a":1}', '{oops}')
check('an invalid second document is reported', badRight.ok, false)
check('an invalid second document names the side', badRight.side, 'right')

// ---- limits -------------------------------------------------------------

const many = { list: [] }
for (let index = 0; index < 600; index += 1) many.list.push(index)
const manyChanged = { list: [] }
for (let index = 0; index < 600; index += 1) manyChanged.list.push(index + 1)
const limited = compareJson(JSON.stringify(many), JSON.stringify(manyChanged))
check('the difference list is capped', limited.differences.length <= scope.MAX_DIFFERENCES, true)

// A document nested past the depth limit is reported rather than followed.
let deep = '{"a":'
for (let index = 0; index < 80; index += 1) deep += '{"a":'
deep += '1'
for (let index = 0; index < 81; index += 1) deep += '}'
const deepResult = compareJson(deep, deep)
check('a very deep document does not hang', deepResult.ok, true)
check('a very deep document that matches has no differences', deepResult.differences, [])

// ---- the plain equality answer -----------------------------------------

check('sameJson: two equal objects', sameJson({ a: 1 }, { a: 1 }), true)
check('sameJson: two different objects', sameJson({ a: 1 }, { a: 2 }), false)
check('sameJson: key order does not matter', sameJson({ a: 1, b: 2 }, { b: 2, a: 1 }), true)
check('sameJson: an extra key', sameJson({ a: 1 }, { a: 1, b: 2 }), false)
check('sameJson: two equal arrays', sameJson([1, 2], [1, 2]), true)
check('sameJson: arrays of different length', sameJson([1, 2], [1, 2, 3]), false)
check('sameJson: an array against an object', sameJson([1], { 0: 1 }), false)
check('sameJson: two nulls', sameJson(null, null), true)
check('sameJson: null against a value', sameJson(null, 0), false)
check('sameJson: deeply nested equal values', sameJson({ a: { b: { c: [1, { d: 2 }] } } }, { a: { b: { c: [1, { d: 2 }] } } }), true)
check('sameJson: deeply nested different values', sameJson({ a: { b: { c: [1, { d: 2 }] } } }, { a: { b: { c: [1, { d: 3 }] } } }), false)

// The tool's answer to "are these the same" must agree with the difference
// list: no differences reported means the same.
for (const [left, right] of [
  ['{"a":1}', '{"a":1}'],
  ['{"a":1}', '{"a":2}'],
  ['{"a":{"b":[1,2]}}', '{"a":{"b":[1,3]}}'],
  ['{"a":1}', '{"a":1,"b":2}'],
  ['[1,2]', '[1,2,3]'],
  ['{"a":null}', '{"a":null}'],
]) {
  const outcome = compareJson(left, right)
  check(
    `the answer and the list agree for ${left} vs ${right}`,
    outcome.equal === (outcome.differences.length === 0),
    true,
  )
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
