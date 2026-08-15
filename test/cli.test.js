'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const BIN = path.join(__dirname, '..', 'bin', 'csvstat.js')

// The command is run rather than its `main` imported. Exit codes and which
// stream a line went to are most of what a command promises, and calling the
// function directly tests neither.
function run (args = [], input) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    input: input === undefined ? '' : input,
    encoding: 'utf8'
  })
  return { code: result.status, out: result.stdout, err: result.stderr }
}

function csv (t, text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csvstat-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'in.csv')
  fs.writeFileSync(file, text)
  return file
}

test('a file is summarised and the exit code is 0', t => {
  const { code, out } = run([csv(t, 'name,age\nada,36\ngrace,45\n')])
  assert.strictEqual(code, 0)
  assert.match(out, /^column/)
  assert.match(out, /\bage\b/)
})

test('standard input is read when there is no file', () => {
  const { code, out } = run([], 'name,age\nada,36\n')
  assert.strictEqual(code, 0)
  assert.match(out, /\bname\b/)
})

test('a dash means standard input as well', () => {
  const { code, out } = run(['-'], 'name,age\nada,36\n')
  assert.strictEqual(code, 0)
  assert.match(out, /\bname\b/)
})

test('--json prints json and nothing else on stdout', t => {
  const { code, out } = run(['--json', csv(t, 'n\n1\n2\n')])
  assert.strictEqual(code, 0)
  const parsed = JSON.parse(out)
  assert.strictEqual(parsed.length, 1)
  assert.strictEqual(parsed[0].type, 'number')
  assert.strictEqual(parsed[0].mean, 1.5)
})

test('a warning goes to stderr so that redirected json still parses', t => {
  const { code, out, err } = run(['--json', csv(t, 'a,b\n1,2,3\n')])
  assert.strictEqual(code, 0)
  assert.doesNotThrow(() => JSON.parse(out), 'stdout must stay parseable')
  assert.match(err, /line 2/)
})

test('an unknown option is refused rather than ignored', t => {
  const { code, err } = run(['--jsno', csv(t, 'n\n1\n')])
  assert.strictEqual(code, 2)
  assert.match(err, /unknown option --jsno/)
})

test('a file that is not there exits 1 and says which', () => {
  const { code, err } = run(['/no/such/file.csv'])
  assert.strictEqual(code, 1)
  assert.match(err, /cannot read \/no\/such\/file\.csv/)
})

test('two files are refused', t => {
  const one = csv(t, 'n\n1\n')
  const { code, err } = run([one, one])
  assert.strictEqual(code, 2)
  assert.match(err, /one file at a time/)
})

test('an empty input exits 1 rather than printing an empty table', () => {
  const { code, err } = run([], '')
  assert.strictEqual(code, 1)
  assert.match(err, /nothing to read/)
})

test('-h prints the usage and exits 0', () => {
  const { code, out } = run(['-h'])
  assert.strictEqual(code, 0)
  assert.match(out, /usage: csvstat/)
})

test('the commonest value is under commonest, not under mean', t => {
  const { out } = run([csv(t, 'colour\nred\nred\nblue\n')])
  const [head, , row] = out.trimEnd().split('\n')
  // The heading a value sits under is the whole point of a table.
  assert.ok(head.indexOf('commonest') < row.indexOf('red (2)') + 'red (2)'.length)
  assert.ok(row.indexOf('red (2)') >= head.indexOf('commonest'))
})
