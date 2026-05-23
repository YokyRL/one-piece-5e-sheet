# Changelog

## 1.0.1 — 2026-05-22

### Fixed

- Buttons (Save, Export, Import, Print, Clear, Add row, tab switches) became
  unresponsive shortly after opening the sheet. Root cause was a re-render
  loop: an unnecessary initial save during boot wrote a flag, which Foundry
  treated as an actor update and re-rendered the sheet, replacing the DOM
  and tearing down all click listeners.
- The fix has three parts:
  - The runtime no longer calls `save()` during boot. It only saves in
    response to actual user input.
  - The sheet's flag writes now use `actor.update(..., {render: false})`
    instead of `setFlag`, so our own writes never trigger a re-render.
  - Belt-and-braces `_render` override discards Foundry-initiated re-renders
    that originate from our writes, in case a render slips through.

### Changed

- Bumped autosave debounce from 250ms to 400ms — fewer flag writes per
  typing burst.
- Listeners are now re-attached on every render (defensive), so external
  re-renders (e.g. token updates, GM permission changes) no longer break
  the sheet.

## 1.0.0 — 2026-05-22

Initial release. v29 One Piece 5e Pirate Log HTML sheet wrapped as a Foundry
VTT v13 Actor sheet with actor-flag persistence.
