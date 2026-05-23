# Changelog

## 1.0.2 — 2026-05-22

### Fixed

- **Nothing on the sheet was clickable in actual Foundry** (Save, Export,
  Import, Print, Clear, tab switches, Add Row, even text inputs were all
  inert). Foundry v13's classic ActorSheet calls `_disableFields(form)`
  on every render and stamps `disabled` on every form control whenever
  `isEditable` is false. The base `isEditable` getter is strict and could
  return false even for the actor's owner in certain edit-mode states.
- Overrode `isEditable` to be true for GMs and any actor owner.
- Overrode `_disableFields` to be a no-op — the bridge already gates
  persistence by ownership, so the form being interactive doesn't leak
  writes.
- Belt-and-braces: `activateListeners` now strips any lingering
  `disabled` / `readonly` / `inert` attributes from the sheet root and its
  ancestors after every render.

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
