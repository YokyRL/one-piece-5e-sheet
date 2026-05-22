# One Piece 5e Pirate Log — Foundry VTT v13 Module

A Foundry VTT v13 module that wraps the `v29.html` "One Piece 5e Pirate Log"
character sheet as a real Foundry **Actor sheet**. All form data (text fields,
checkboxes, dynamic lists, portraits, etc.) is persisted to the actor's flags
in your Foundry world, so it works in a shared, GM-hosted game.

## What you get

- A custom Actor sheet labeled **"One Piece 5e Pirate Log"** that you can apply
  to any actor of type `character` (configurable).
- The full v29 sheet UI — tabs, autosave, calculations, portraits, Export /
  Import / Print / Clear — running inside Foundry.
- Storage backed by `actor.flags["one-piece-5e-sheet"].sheetData` and a
  separate `portraits` flag, **not** the browser's `localStorage`. Players
  and the GM see the same data because it's stored on the actor document
  itself.
- World-scope settings for which actor types to register against and whether
  this sheet should be the default.

## Requirements

- Foundry VTT **v13** (manifest is pinned to v13).
- A game system that exposes at least one actor type. Most systems use
  `character`. If your system uses something different (e.g. `pc`, `hero`),
  set that via the module setting (see below).
- Players need **Observer or higher** permission on the actor to see the
  sheet, **Owner** to edit it (standard Foundry behavior).

> The sheet is system-agnostic — it does not read or write any system-specific
> data fields. All numbers live in module flags. If you want some fields to
> sync back to the system (e.g. AC, HP) you'll need to fork the runtime; the
> code is in `scripts/sheet-runtime.js`.

---

## Install on a hosted Foundry instance

You have two install paths. Pick whichever your host supports.

### Option A — install from a manifest URL (recommended)

Most hosted Foundry providers (The Forge, Molten Hosting, FoundryServer, your
own VPS, etc.) let you install modules by pasting a manifest URL.

1. Upload `module.json` somewhere your Foundry instance can reach over HTTPS
   (a GitHub release, S3 bucket, Forge's "Bazaar" / asset library, etc.) along
   with a zip containing the module folder.
2. In `module.json`, set `manifest` to the public URL of `module.json` and
   `download` to the public URL of the zip. Re-upload `module.json` after
   editing.
3. In Foundry, go to **Setup → Add-on Modules → Install Module**.
4. Paste the public URL of your `module.json` into **"Manifest URL"** and
   click **Install**.
5. Launch your world, open **Game Settings → Manage Modules**, tick
   **One Piece 5e Pirate Log Sheet**, and **Save Module Settings**.

### Option B — upload the folder directly (works on every host)

Use this when you have file/SFTP access to your Foundry data directory.

1. Download / unzip `one-piece-5e-sheet.zip` so you have a folder named
   `one-piece-5e-sheet/` with this structure:

   ```
   one-piece-5e-sheet/
     module.json
     scripts/
       module.js
       sheet-runtime.js
     styles/sheet.css
     templates/actor-sheet.hbs
     lang/en.json
     README.md
   ```

2. Drop that folder into your Foundry **Data → modules** directory. Typical
   locations:

   | Host                         | Path                                               |
   | ---------------------------- | -------------------------------------------------- |
   | Self-hosted (Linux)          | `~/foundrydata/Data/modules/`                       |
   | Self-hosted (Windows)        | `%localappdata%/FoundryVTT/Data/modules/`           |
   | The Forge                    | **Game Manager → My Foundry → Modules → Upload**    |
   | Molten / Foundryserver       | SFTP into `FoundryVTT/Data/modules/`                |

   **Important:** the folder name must match the `id` in `module.json`, i.e.
   `one-piece-5e-sheet`. Don't rename it.

3. Restart Foundry (or reload the world).
4. Launch your world, go to **Game Settings → Manage Modules**, enable
   **"One Piece 5e Pirate Log Sheet"**, and **Save Module Settings**.

### The Forge specifically

If you use The Forge:

1. Zip the `one-piece-5e-sheet/` folder.
2. Go to **The Forge → Game Manager → Modules**.
3. Click **Install Custom Module → Upload Zip** and select the zip.
4. After it installs, enable it in your world's module settings as above.

---

## Using the sheet

1. Enable the module in your world (see install above).
2. Open the **Configure Settings → Module Settings** dialog. Under
   **One Piece 5e Pirate Log Sheet**:
   - **Actor types to register the sheet for**: a comma-separated list of
     actor types in your game system. Default is `character`. To also offer
     it for NPCs use e.g. `character,npc`. **You must reload the world after
     changing this.**
   - **Make this the default sheet for those Actor types**: if on, every
     newly-created actor of the configured types will open this sheet by
     default. If off, players pick it manually per-actor.
3. Open any character actor.
4. If the sheet is not already the default, click the **Sheet** button at the
   top of the actor sheet window and pick **"One Piece 5e Pirate Log"**, or
   right-click the actor in the sidebar and choose **Configure Sheet → One
   Piece 5e Pirate Log**.
5. Edit the sheet normally. **Autosave** writes to the actor's flags after
   a short debounce; the **Save now** button forces an immediate write.

### Buttons

- **Save now** — forces an immediate save to actor flags.
- **Export** — downloads a JSON backup file.
- **Import** — restores from a previously-exported JSON backup.
- **Print tab** — opens the browser print dialog for the current tab.
- **Clear** — wipes the sheet's flags after a confirmation prompt.

### Portraits

Portraits are stored as data-URLs inside `actor.flags["one-piece-5e-sheet"].portraits`.
That keeps everything in one place but does inflate the document. If you have
players with very large portraits, prefer the **standard Foundry actor
portrait** (top-left of the actor sheet) for the canvas token image, and use
this sheet's portrait gallery only for in-world flavor.

---

## Multi-user notes

- A player needs **Owner** permission on the actor to write the sheet. With
  **Observer** or **Limited** they see a read-only view; writes are silently
  dropped.
- Two users editing the same actor at the same time can race — the last
  autosave wins. Foundry's flag system does not provide field-level locking.
- The GM can always edit any sheet regardless of ownership.

---

## Troubleshooting

**The sheet opens blank / I see the default sheet.** Check that the module is
enabled, then click the **Sheet** button at the top of the actor window and
pick **"One Piece 5e Pirate Log"** explicitly. Also verify the
**Actor types to register the sheet for** setting matches your system's actor
type ids — e.g. `dnd5e` uses `character`, but some homebrew systems differ.
After changing the setting, **reload the world**.

**Browser console shows "sheet-runtime.js failed to load".** The static
script didn't load — usually a 404. Verify your module folder name is exactly
`one-piece-5e-sheet` and that `scripts/sheet-runtime.js` exists.

**Changes don't save.** Open the browser dev console (F12). If you see
`setFlag failed: permission denied`, the user is not an owner of that actor.
Have the GM grant Owner permission to the player on that actor.

**My old data is in localStorage from the standalone HTML.** Export the JSON
from the standalone HTML using its **Export** button, then import it into the
Foundry sheet via **Import**.

---

## File layout

```
one-piece-5e-sheet/
├── module.json                  Foundry manifest
├── README.md                    this file
├── lang/
│   └── en.json                  UI strings
├── scripts/
│   ├── module.js                ActorSheet class + bridge (ESM)
│   └── sheet-runtime.js         v29 sheet logic, scoped + flag-backed
├── styles/
│   └── sheet.css                v29 styles, scoped under .opfvtt-sheet
└── templates/
    └── actor-sheet.hbs          v29 markup wrapped for Foundry
```

## Credits

- Sheet design and HTML: Shintox (`v29.html`).
- Foundry wrapper: generated for this project.
