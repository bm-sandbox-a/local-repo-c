'use strict'

// Reading CSV.
//
// Splitting on commas is the version everybody writes first and it is wrong on
// the second file it meets: a field can be quoted, a quoted field can contain
// a comma, a newline, or a quote of its own written as two quotes. So this is
// a character scanner rather than a `split`, which is more code and the only
// way to be right about the cases that actually turn up.
//
// RFC 4180 with the concessions reality demands: CRLF or LF, and a last line
// with or without a terminator.

// A single quote inside a quoted field is written as two. That is the whole
// escaping rule -- there is no backslash in CSV, and treating one as an escape
// silently mangles Windows paths.
function parse (text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  let started = false // did this field begin with a quote

  // A byte-order mark at the start of a file written by a spreadsheet becomes
  // part of the first header name, and then a lookup by that name misses for
  // reasons nothing in the output explains.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  const endField = () => { row.push(field); field = ''; started = false }
  const endRow = () => { endField(); rows.push(row); row = [] }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"' && field === '' && !started) { quoted = true; started = true; continue }
    if (ch === ',') { endField(); continue }
    if (ch === '\r' && text[i + 1] === '\n') { endRow(); i++; continue }
    if (ch === '\n' || ch === '\r') { endRow(); continue }
    field += ch
  }

  // Whatever is left is the last row, unless the file ended with a newline --
  // in which case there is nothing left and adding a row would invent an empty
  // record that is not in the file.
  if (field !== '' || row.length > 0 || started) endRow()

  return rows
}

// Rows to records, keyed by the header.
//
// A short row is padded rather than refused. Real exports do it, usually by
// dropping trailing empty fields, and failing the whole file over it helps
// nobody. A LONG row is a different thing -- it means the header and the data
// disagree about the shape -- so it is reported.
function toRecords (rows) {
  if (rows.length === 0) return { columns: [], records: [] }

  const columns = rows[0]
  const records = []
  const problems = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.length > columns.length) {
      problems.push(`line ${i + 1}: ${row.length} fields, header has ${columns.length}`)
    }
    const record = {}
    columns.forEach((name, at) => { record[name] = row[at] === undefined ? '' : row[at] })
    records.push(record)
  }

  return { columns, records, problems }
}

module.exports = { parse, toRecords }
