# TODO

Up next:
- make author and range optional
- songs without lyrics should not render pages, not be linked to in the prev/next links, not have a "print" checkbox, display as gray background in the table and not change color on hover
  - make sure gray background persists in print view of table too
- add has_lyrics true/false filter

## P1
* show range with single or double arrow for how many octaves it spans

## P2:
* list by bop (maybe i'll just sort a table but we could do it with multiple subheadings??)
* mobile layout?
* hitbox on checkboxes on table should be bigger
* search in navbar
* what do I do with really long e.g. authors gumming up the song table? author_display escape hatch field, or?
  * maybe change default table fields?
* make pill link layout less weird.
* importing new songs: if it's a big long notes field, make it a multiline yaml entry w softwraps instead of a giant string.
* smart quotes didn't happen

### P3:
* tweak tooltip formatting for better margins and line continuation esp on mobile
* freeze title col of table when scrolling
* in song metadata, separate the topic entites better; better hover behavior for everything
* somewhat rein in all possible topics
* reset table button to go back to default sorts, cols etc.
* multi-column sort on the home page table (shift+click to add a secondary sort key)
* publish the site?!
* maybe add favicon
* make tab titles not suck
  * including parsing special chars in song names correctly -- see eg Pleasure to Know You title
* narrow list of moods/topics? consistent display -- icons or color coding?
* customizable print layout: paper size, fields included, etc.
* command to `list-todo`: show songs that don't have lyrics
