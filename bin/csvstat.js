#!/usr/bin/env node
'use strict'

// The command. Argument handling, reading the input, and choosing between the
// table and the json -- everything else is in `src/`.

const fs = require('node:fs')
const { parse, toRecords } = require('../src/parse')
const { summariseAll, format } = require('../src/stats')

const USAGE = `usage: csvstat [--json] [file]

Print a column-by-column summary of a CSV file.
Reads standard input when no file is given.

  --json    the summary as json instead of a table
  -h        this
`

function main (argv) {
  const args = argv.slice(2)

  if (args.includes('-h') || args.includes('--help')) {
    process.stdout.write(USAGE)
    return 0
  }

  const json = args.includes('--json')
  const files = args.filter(a => !a.startsWith('-'))

  // An unknown flag is refused rather than ignored. Ignoring it means a
  // mistyped `--jsno` silently prints a table, and the difference is only
  // noticed by whatever was parsing the output.
  const unknown = args.filter(a => a.startsWith('-') && !['--json', '-h', '--help', '-'].includes(a))
  if (unknown.length > 0) {
    process.stderr.write(`csvstat: unknown option ${unknown[0]}\n${USAGE}`)
    return 2
  }

  if (files.length > 1) {
    process.stderr.write('csvstat: one file at a time\n')
    return 2
  }

  let text
  try {
    // `-` means standard input, the same as no file at all. It exists so that
    // `csvstat - --json` reads in a pipeline without looking like an omission.
    text = files.length === 0 || files[0] === '-'
      ? fs.readFileSync(0, 'utf8')
      : fs.readFileSync(files[0], 'utf8')
  } catch (err) {
    process.stderr.write(`csvstat: cannot read ${files[0] || 'standard input'}: ${err.message}\n`)
    return 1
  }

  if (text.trim() === '') {
    process.stderr.write('csvstat: nothing to read\n')
    return 1
  }

  const { columns, records, problems } = toRecords(parse(text))
  const stats = summariseAll({ columns, records })

  // On stderr, so that `csvstat --json f.csv > out.json` still produces json
  // that parses -- and the warning is still seen.
  for (const problem of problems || []) {
    process.stderr.write(`csvstat: ${problem}\n`)
  }

  process.stdout.write(json ? JSON.stringify(stats, null, 2) + '\n' : format(stats))
  return 0
}

if (require.main === module) process.exit(main(process.argv))

module.exports = { main }
