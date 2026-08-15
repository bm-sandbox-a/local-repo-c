'use strict'

// What to say about a column once it has been read.
//
// The type is inferred from the values rather than declared, because CSV has
// no types and the file is not going to grow a schema. Inference is stated as
// a rule and the rule is applied to every column the same way -- a column is
// numeric when every value that is present parses as a number.

// Deliberately stricter than `Number()`. `Number('')` is 0 and `Number(' ')`
// is 0, which would make a column of blanks look like a column of zeroes --
// and then a mean computed over values that were never there.
function asNumber (value) {
  const text = String(value).trim()
  if (text === '') return null
  // Thousands separators are common in exports and are not a different type.
  const cleaned = text.replace(/,/g, '')
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const isBlank = value => String(value).trim() === ''

// The median, which needs the values sorted and is the one summary that says
// something a mean does not: a single enormous value moves the mean and leaves
// the median where it was.
function median (sorted) {
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function summarise (records, column) {
  const values = records.map(record => record[column])
  const present = values.filter(v => !isBlank(v))
  const empty = values.length - present.length

  const numbers = present.map(asNumber)
  // A column is numeric only if EVERY value present is a number. One id like
  // `00-417` in a column of numbers means the column is not numeric, and
  // averaging the rest of it would be a summary of a subset presented as a
  // summary of the column.
  const numeric = present.length > 0 && numbers.every(n => n !== null)

  const stat = {
    column,
    rows: values.length,
    empty,
    unique: new Set(present.map(v => String(v).trim())).size,
    type: numeric ? 'number' : 'text'
  }

  if (numeric) {
    const sorted = numbers.slice().sort((a, b) => a - b)
    const sum = sorted.reduce((total, n) => total + n, 0)
    stat.min = sorted[0]
    stat.max = sorted[sorted.length - 1]
    stat.mean = sum / sorted.length
    stat.median = median(sorted)
  } else {
    const lengths = present.map(v => String(v).length)
    stat.shortest = lengths.length ? Math.min(...lengths) : 0
    stat.longest = lengths.length ? Math.max(...lengths) : 0
    // The value that turns up most, which is what makes a column of one
    // repeated value obvious at a glance.
    const counts = new Map()
    for (const v of present) {
      const key = String(v).trim()
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    let best = null
    for (const [value, count] of counts) {
      if (!best || count > best.count) best = { value, count }
    }
    stat.most = best
  }

  return stat
}

const summariseAll = ({ columns, records }) => columns.map(column => summarise(records, column))

// Numbers as a person reads them, not as `toString` writes them. A mean of
// 3.3333333333333335 is noise; 3.333 is the same answer.
function pretty (n) {
  if (n === null || n === undefined) return ''
  if (Number.isInteger(n)) return String(n)
  return String(Number(n.toFixed(3)))
}

// A table, sized to its contents. Nothing here knows about a terminal width --
// piping into `less` or a file should give the same bytes as reading it.
function format (stats) {
  if (stats.length === 0) return 'no columns\n'

  // `commonest` is its own column rather than sharing `mean`.
  //
  // Sharing looks tidier and is worse twice over: a value like "London (1)"
  // sits under a heading that says mean, and one long value widens the column
  // that every number in the table is then padded out to.
  //
  // `min` and `max` carry the length for a text column, written as `len 4` so
  // that it cannot be mistaken for a value.
  const head = ['column', 'type', 'rows', 'empty', 'unique', 'min', 'max', 'mean', 'median', 'commonest']
  const rows = stats.map(s => [
    s.column,
    s.type,
    String(s.rows),
    String(s.empty),
    String(s.unique),
    s.type === 'number' ? pretty(s.min) : `len ${s.shortest}`,
    s.type === 'number' ? pretty(s.max) : `len ${s.longest}`,
    s.type === 'number' ? pretty(s.mean) : '',
    s.type === 'number' ? pretty(s.median) : '',
    s.type === 'number' ? '' : (s.most ? `${s.most.value} (${s.most.count})` : '')
  ])

  const widths = head.map((_, at) => Math.max(head[at].length, ...rows.map(r => r[at].length)))
  const line = cells => cells.map((c, at) => c.padEnd(widths[at])).join('  ').trimEnd()

  return [
    line(head),
    widths.map(w => '-'.repeat(w)).join('  '),
    ...rows.map(line)
  ].join('\n') + '\n'
}

module.exports = { asNumber, summarise, summariseAll, format, pretty }
