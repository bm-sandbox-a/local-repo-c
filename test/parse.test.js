'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { parse, toRecords } = require('../src/parse')

test('a plain file is rows of fields', () => {
  assert.deepStrictEqual(parse('a,b\n1,2\n'), [['a', 'b'], ['1', '2']])
})

test('a last line without a newline is still a row', () => {
  assert.deepStrictEqual(parse('a,b\n1,2'), [['a', 'b'], ['1', '2']])
})

test('a trailing newline does not invent an empty row', () => {
  assert.strictEqual(parse('a,b\n1,2\n').length, 2)
})

test('CRLF is a line ending, not a field', () => {
  assert.deepStrictEqual(parse('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']])
})

test('a lone CR is a line ending too', () => {
  assert.deepStrictEqual(parse('a,b\r1,2'), [['a', 'b'], ['1', '2']])
})

test('a comma inside quotes belongs to the field', () => {
  assert.deepStrictEqual(parse('a,b\n"one, two",3'), [['a', 'b'], ['one, two', '3']])
})

test('a newline inside quotes belongs to the field', () => {
  assert.deepStrictEqual(parse('a,b\n"one\ntwo",3'), [['a', 'b'], ['one\ntwo', '3']])
})

test('two quotes inside a quoted field are one quote', () => {
  assert.deepStrictEqual(parse('a\n"she said ""hi"""'), [['a'], ['she said "hi"']])
})

test('a backslash is not an escape, because CSV has none', () => {
  assert.deepStrictEqual(parse('path\n"C:\\temp\\x"'), [['path'], ['C:\\temp\\x']])
})

test('empty fields are kept, including at the end', () => {
  assert.deepStrictEqual(parse('a,b,c\n1,,3\n'), [['a', 'b', 'c'], ['1', '', '3']])
  assert.deepStrictEqual(parse('a,b,c\n1,2,\n'), [['a', 'b', 'c'], ['1', '2', '']])
})

test('an empty quoted field is a field', () => {
  assert.deepStrictEqual(parse('a,b\n"",2'), [['a', 'b'], ['', '2']])
})

test('a byte-order mark is not part of the first header', () => {
  const rows = parse('\ufeffname,age\nada,36')
  assert.strictEqual(rows[0][0], 'name', 'a BOM here silently breaks every lookup by name')
})

test('a quote in the middle of a bare field is just a character', () => {
  assert.deepStrictEqual(parse('a\n5" pipe'), [['a'], ['5" pipe']])
})

test('records are keyed by the header', () => {
  const { columns, records } = toRecords(parse('name,age\nada,36\ngrace,45\n'))
  assert.deepStrictEqual(columns, ['name', 'age'])
  assert.deepStrictEqual(records, [{ name: 'ada', age: '36' }, { name: 'grace', age: '45' }])
})

test('a short row is padded rather than refused', () => {
  const { records, problems } = toRecords(parse('a,b,c\n1,2\n'))
  assert.deepStrictEqual(records, [{ a: '1', b: '2', c: '' }])
  assert.deepStrictEqual(problems, [])
})

test('a long row is reported with its line number', () => {
  const { problems } = toRecords(parse('a,b\n1,2,3\n'))
  assert.strictEqual(problems.length, 1)
  assert.match(problems[0], /line 2/)
})

test('an empty file is no columns and no records', () => {
  assert.deepStrictEqual(toRecords(parse('')), { columns: [], records: [] })
})

test('a header with no rows under it is still a header', () => {
  const { columns, records } = toRecords(parse('a,b\n'))
  assert.deepStrictEqual(columns, ['a', 'b'])
  assert.deepStrictEqual(records, [])
})
