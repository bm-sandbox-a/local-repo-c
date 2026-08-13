'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { parse, toRecords } = require('../src/parse')
const { asNumber, summarise, summariseAll, format } = require('../src/stats')

const read = text => toRecords(parse(text))

test('asNumber takes the shapes a number comes in', () => {
  assert.strictEqual(asNumber('42'), 42)
  assert.strictEqual(asNumber('-3.5'), -3.5)
  assert.strictEqual(asNumber('+7'), 7)
  assert.strictEqual(asNumber('.5'), 0.5)
  assert.strictEqual(asNumber('1e3'), 1000)
  assert.strictEqual(asNumber('  8  '), 8)
  assert.strictEqual(asNumber('1,200'), 1200)
})

test('asNumber refuses what is not one', () => {
  // Every one of these is 0 or NaN through `Number()`, and a blank counted as
  // zero is the failure that matters: it moves a mean.
  assert.strictEqual(asNumber(''), null)
  assert.strictEqual(asNumber('   '), null)
  assert.strictEqual(asNumber('abc'), null)
  assert.strictEqual(asNumber('12abc'), null)
  assert.strictEqual(asNumber('0x1f'), null)
  assert.strictEqual(asNumber('Infinity'), null)
})

test('a column of numbers is summarised as numbers', () => {
  const stat = summarise(read('n\n1\n2\n3\n4\n').records, 'n')
  assert.strictEqual(stat.type, 'number')
  assert.strictEqual(stat.min, 1)
  assert.strictEqual(stat.max, 4)
  assert.strictEqual(stat.mean, 2.5)
  assert.strictEqual(stat.median, 2.5)
})

test('the median of an odd count is the middle value', () => {
  assert.strictEqual(summarise(read('n\n1\n5\n100\n').records, 'n').median, 5)
})

test('one outlier moves the mean and not the median', () => {
  const stat = summarise(read('n\n1\n2\n3\n1000\n').records, 'n')
  assert.strictEqual(stat.median, 2.5)
  assert.ok(stat.mean > 200, 'the mean is the one that should have moved')
})

test('one non-number makes the whole column text', () => {
  const stat = summarise(read('n\n1\n2\n00-417\n').records, 'n')
  assert.strictEqual(stat.type, 'text', 'averaging the rest would summarise a subset')
  assert.strictEqual(stat.mean, undefined)
})

test('blanks are counted, not treated as zero', () => {
  const stat = summarise(read('n\n1\n\n3\n').records, 'n')
  assert.strictEqual(stat.rows, 3)
  assert.strictEqual(stat.empty, 1)
  assert.strictEqual(stat.type, 'number')
  assert.strictEqual(stat.mean, 2, 'a blank counted as 0 would make this 1.333')
})

test('a column that is entirely blank is text, not an empty number column', () => {
  const stat = summarise(read('n\n\n\n').records, 'n')
  assert.strictEqual(stat.type, 'text')
  assert.strictEqual(stat.empty, 2)
})

test('unique counts distinct values and ignores blanks', () => {
  const stat = summarise(read('c\na\nb\na\n\n').records, 'c')
  assert.strictEqual(stat.unique, 2)
  assert.strictEqual(stat.empty, 1)
})

test('a text column reports lengths and the commonest value', () => {
  const stat = summarise(read('c\nred\nblue\nred\n').records, 'c')
  assert.strictEqual(stat.type, 'text')
  assert.strictEqual(stat.shortest, 3)
  assert.strictEqual(stat.longest, 4)
  assert.deepStrictEqual(stat.most, { value: 'red', count: 2 })
})

test('every column is summarised, in the order of the header', () => {
  const stats = summariseAll(read('name,age\nada,36\ngrace,45\n'))
  assert.deepStrictEqual(stats.map(s => s.column), ['name', 'age'])
  assert.deepStrictEqual(stats.map(s => s.type), ['text', 'number'])
})

test('the table has a row per column and lines up', () => {
  const out = format(summariseAll(read('name,age\nada,36\ngrace,45\n')))
  const lines = out.trimEnd().split('\n')
  assert.strictEqual(lines.length, 4, 'header, rule, and one row per column')
  assert.match(lines[0], /^column/)
  assert.ok(lines[2].startsWith('name'))
  assert.ok(lines[3].startsWith('age'))
})

test('long values do not break the columns', () => {
  const out = format(summariseAll(read('a_very_long_column_name,x\n1,2\n')))
  const lines = out.trimEnd().split('\n')
  // The rule under the header is as wide as the widest cell, which is what
  // makes a table with one long name still readable.
  assert.strictEqual(lines[1].split('  ')[0].length, 'a_very_long_column_name'.length)
})

test('no columns says so instead of printing an empty table', () => {
  assert.match(format([]), /no columns/)
})

test('a mean is rounded to something a person reads', () => {
  const stat = summarise(read('n\n1\n2\n4\n').records, 'n')
  assert.match(format([stat]), /2\.333/)
  assert.ok(!format([stat]).includes('2.3333333'))
})
