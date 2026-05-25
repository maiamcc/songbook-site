# TODO

## P1
* let's clean up the homepage table experience. implement these in order, pausing after each to let me validate and commit changes. Include tests where it makes sense, but only when there's involved logic that can be usefully tested.
    - when alt title displays in the table, visually de-emphasize (make gray)
    - in columns for `indexable` fields, all of the entries should be clickable and take you to the corresponding index (like when these values are displayed on a Song view or in an Index)
    - when table overflows horizontally and needs to scroll, give a visual affordance that it's scrollable/there's content that can't be seen right now
    - meatball menu should be at the top right of the table itself (i.e. horizontally level with the header row), not above
    - you should be able to check or uncheck multiple boxes in the meatball menu without it closing; close the meatball menu by clicking outside of it.
    - alternate way to remove a column: make an "X" button part of column headers for optional columns, clicking should remove that column (equivalent to unchecking it in the meatball menu)

## P2:
* apply configurable table to index views (per-field-value listing pages)
* separator btwn metadata and lyrics feels overkill now
* song print: line spacing and font size play
* multi-column sort on the home page table (shift+click to add a secondary sort key)
* printable home page / indexes (with all selected columns)
* printing multiple songs (e.g. put a checkbox, print all checked songs)
* more layout stuff ???
* somewhat rein in all possible topics
* tweak tooltip formatting for better margins and line continuation esp on mobile

### P3:
* search in navbar
* publish the site?!
* maybe add favicon
* make tab titles not suck
  * including parsing special chars in song names correctly -- see eg Pleasure to Know You title
* mobile layout?
* make song types, topics etc. formatted better and more consistently. maybe color coded? pills??/bw
* customizable print layout: paper size, fields included, etc.
* style the metadata drawer on the song view (currently default `<details>`/`<summary>` look)
* other information to track, maybe: roud number, lineage/where i learned it from, do EYE have it memorized
* command to `list-todo`: show songs that don't have lyrics
