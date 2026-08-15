csvstat
=======

Print a column-by-column summary of a CSV file. No dependencies.

**Unrelated to the other two repositories in this workspace, on purpose.** A
workspace is a folder of whatever somebody is working on, not a project split
into parts, and a set of examples where everything connects to everything else
would be a misleading one to build against.


Using it
--------

    ./setup.sh
    node bin/csvstat.js example/cities.csv

    column      type    rows  empty  unique  min     max       mean       median   commonest
    ----------  ------  ----  -----  ------  ------  --------  ---------  -------  --------------------
    city        text    8     0      8       len 4   len 9                         London (1)
    country     text    8     0      8       len 4   len 14                        United Kingdom (1)
    population  number  8     0      8       131136  13960000  6823940.5  8518000
    founded     number  8     0      8       -250    1535      896.5      989.5

It reads standard input when given no file, or `-`:

    cat data.csv | node bin/csvstat.js
    node bin/csvstat.js --json data.csv > summary.json

Warnings go to stderr, so redirected `--json` output still parses.

Exit codes: `0` fine, `1` could not read the input, `2` the arguments were
wrong.


What it decides, and why
------------------------

**A column is numeric only when every value present parses as a number.** One
id like `00-417` in a column of numbers makes the column text. Summarising the
rest would be a summary of a subset presented as a summary of the column.

**A blank is not a zero.** `Number('')` is `0`, so the obvious implementation
quietly averages values that were never there. Blanks are counted separately
and left out of the arithmetic.

**Both a mean and a median**, because one outlier moves the first and leaves
the second alone, and seeing them disagree is the point.

**Lengths for a text column**, written `len 4` so it cannot be read as a value.


The parsing
-----------

`src/parse.js` is a character scanner, not a `split(',')`. A field can be
quoted; a quoted field can hold a comma, a newline, or a quote written as two
quotes. It handles LF, CRLF and lone CR, a last line with or without a
terminator, and strips a byte-order mark -- which otherwise becomes part of the
first header name and breaks every lookup by name with nothing in the output to
explain it.

There is no backslash escape in CSV. Treating one as an escape silently mangles
Windows paths, so it does not.


How it is laid out
------------------

    bin/csvstat.js    arguments, input, and which of the two outputs
    src/parse.js      text -> rows -> records
    src/stats.js      records -> a summary -> a table
    example/          a small CSV with quotes, commas and blanks in it
    test/             node --test, including the command itself
