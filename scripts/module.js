/* One Piece 5e Pirate Log — Foundry VTT v13 module entry.
 *
 * Registers a custom Actor sheet that wraps the v29 HTML character sheet.
 * Persists all form data to actor.flags["one-piece-5e-sheet"].
 *
 * Foundry v13 notes
 * -----------------
 *  - The classic v1 ActorSheet is still shipped, but lives at
 *    `foundry.appv1.sheets.ActorSheet` and the registration API at
 *    `foundry.documents.collections.Actors.registerSheet`. The old globals
 *    (`ActorSheet`, `Actors.registerSheet`) remain as deprecation shims.
 *  - We deliberately use the v1 sheet because it loads a Handlebars template
 *    by URL with no extra ceremony — perfect for wrapping a hand-rolled HTML
 *    sheet.
 */

const MODULE_ID = "one-piece-5e-sheet";
const FLAG_SHEET_DATA = "sheetData";       // string (JSON)
const FLAG_PORTRAITS  = "portraits";       // { [id]: dataURL }

// Resolve the ActorSheet base class. Prefer the v13 namespace, fall back to
// the deprecation shim so we still work if Foundry moves things later.
function resolveActorSheetBase() {
  if (foundry?.appv1?.sheets?.ActorSheet) return foundry.appv1.sheets.ActorSheet;
  if (typeof ActorSheet !== "undefined") return ActorSheet;
  throw new Error("[one-piece-5e-sheet] No ActorSheet base class available in this Foundry version.");
}

// Resolve the registration helper similarly.
function resolveActorsCollection() {
  if (foundry?.documents?.collections?.Actors) return foundry.documents.collections.Actors;
  if (typeof Actors !== "undefined") return Actors;
  throw new Error("[one-piece-5e-sheet] No Actors collection available.");
}

class OnePiece5eSheet extends (resolveActorSheetBase()) {
  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["opfvtt-app", "sheet", "actor"],
      template: `modules/${MODULE_ID}/templates/actor-sheet.hbs`,
      width: 1180,
      height: 820,
      resizable: true,
      submitOnChange: false,  // we manage our own persistence
      submitOnClose: false,
      closeOnSubmit: false,
      scrollY: [".window-content"]
    });
  }

  /** @inheritdoc */
  get title() {
    const base = this.actor?.name || game.i18n.localize("OPFVTT.SheetLabel");
    return `${base} — ${game.i18n.localize("OPFVTT.SheetLabel")}`;
  }

  /** @inheritdoc */
  async getData(options) {
    const data = await super.getData(options);
    data.moduleId = MODULE_ID;
    return data;
  }

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);

    // jQuery in classic ActorSheet — unwrap.
    const rootEl = (html instanceof HTMLElement) ? html : (html[0] || html.get?.(0));
    if (!rootEl) return;
    const sheetRoot = rootEl.querySelector(".opfvtt-sheet");
    if (!sheetRoot) {
      console.warn("[one-piece-5e-sheet] Sheet root not found in rendered template.");
      return;
    }

    // Mirror every native `id` to `data-orig-id` so the runtime can locate
    // elements with a scoped attribute selector. We deliberately leave the
    // native `id` intact so internal CSS selectors (`#skillsBody`,
    // `#tab-config`, `#portraitList`) keep working. Opening two sheets for
    // different actors works because all lookups are scoped to the sheet
    // root; clicking a `<label for=...>` in sheet B may briefly focus an
    // input in sheet A, which is a minor cosmetic edge case.
    if (!sheetRoot.dataset.opfvttIdMirrored) {
      sheetRoot.dataset.opfvttIdMirrored = "1";
      sheetRoot.querySelectorAll("[id]").forEach(el => {
        if (!el.dataset.origId) el.dataset.origId = el.id;
      });
    }

    if (!globalThis.OPFVTT?.boot) {
      console.error("[one-piece-5e-sheet] sheet-runtime.js failed to load.");
      return;
    }

    const bridge = this._buildBridge();
    this._lastBridge = bridge;

    // Boot once per render. Guard against double-boot on re-renders.
    if (sheetRoot.dataset.opfvttBooted === "1") return;
    sheetRoot.dataset.opfvttBooted = "1";
    try {
      globalThis.OPFVTT.boot(sheetRoot, bridge);
    } catch (err) {
      console.error("[one-piece-5e-sheet] Boot failed:", err);
      ui.notifications?.error("One Piece 5e sheet failed to initialize. See console.");
    }
  }

  /** Build the storage / UX bridge for the runtime script. */
  _buildBridge() {
    const actor = this.actor;
    const canWrite = () => actor.isOwner;

    // Debounce writes so rapid keystrokes don't hammer the server.
    let pendingFlagWrite = null;
    let pendingFlagValue = null;
    const flushFlagWrite = async () => {
      const v = pendingFlagValue;
      pendingFlagWrite = null;
      pendingFlagValue = null;
      if (v === null || v === undefined) return;
      try {
        await actor.setFlag(MODULE_ID, FLAG_SHEET_DATA, v);
      } catch (err) {
        console.warn("[one-piece-5e-sheet] setFlag failed:", err);
      }
    };

    return {
      // --- Sheet JSON blob ---
      getSheetData() {
        const v = actor.getFlag(MODULE_ID, FLAG_SHEET_DATA);
        return (typeof v === "string" && v.length) ? v : null;
      },
      setSheetData(jsonString) {
        if (!canWrite()) return false;
        pendingFlagValue = jsonString;
        if (pendingFlagWrite) clearTimeout(pendingFlagWrite);
        pendingFlagWrite = setTimeout(flushFlagWrite, 250);
        return true;
      },
      async clearSheetData() {
        if (!canWrite()) return;
        try { await actor.unsetFlag(MODULE_ID, FLAG_SHEET_DATA); } catch (e) { console.warn(e); }
        try { await actor.unsetFlag(MODULE_ID, FLAG_PORTRAITS); } catch (e) { console.warn(e); }
      },

      // --- Portraits (stored as { [id]: dataURL } in a separate flag) ---
      async portraitPut(id, src) {
        if (!canWrite()) return false;
        const current = foundry.utils.duplicate(actor.getFlag(MODULE_ID, FLAG_PORTRAITS) || {});
        current[id] = src;
        try { await actor.setFlag(MODULE_ID, FLAG_PORTRAITS, current); return true; }
        catch (err) { console.warn("[one-piece-5e-sheet] portraitPut failed:", err); return false; }
      },
      async portraitGet(id) {
        const all = actor.getFlag(MODULE_ID, FLAG_PORTRAITS) || {};
        return all[id] || "";
      },
      portraitGetSync(id) {
        const all = actor.getFlag(MODULE_ID, FLAG_PORTRAITS) || {};
        return all[id] || "";
      },
      async portraitDelete(id) {
        if (!canWrite()) return false;
        const all = foundry.utils.duplicate(actor.getFlag(MODULE_ID, FLAG_PORTRAITS) || {});
        if (!(id in all)) return true;
        delete all[id];
        try { await actor.setFlag(MODULE_ID, FLAG_PORTRAITS, all); return true; }
        catch (err) { console.warn("[one-piece-5e-sheet] portraitDelete failed:", err); return false; }
      },
      async portraitClear() {
        if (!canWrite()) return;
        try { await actor.unsetFlag(MODULE_ID, FLAG_PORTRAITS); } catch (e) { console.warn(e); }
      },

      // --- UX helpers ---
      notify(msg) {
        ui.notifications?.warn(String(msg));
      },
      onClose: () => flushFlagWrite()
    };
  }

  /** @inheritdoc */
  async close(options) {
    // Flush any pending debounced save before the sheet closes.
    try {
      const bridge = this._lastBridge;
      if (bridge?.onClose) await bridge.onClose();
    } catch (e) { console.warn(e); }
    return super.close(options);
  }
}

/* ------------------------------------------------------------------ *
 * Module hooks                                                         *
 * ------------------------------------------------------------------ */

Hooks.once("init", () => {
  // Settings
  game.settings.register(MODULE_ID, "registerForTypes", {
    name: game.i18n.localize("OPFVTT.RegisterForTypes"),
    hint: game.i18n.localize("OPFVTT.RegisterForTypesHint"),
    scope: "world",
    config: true,
    type: String,
    default: "character",
    requiresReload: true
  });
  game.settings.register(MODULE_ID, "makeDefault", {
    name: game.i18n.localize("OPFVTT.MakeDefault"),
    hint: game.i18n.localize("OPFVTT.MakeDefaultHint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true
  });

  // Register the sheet for the configured actor types.
  const ActorsColl = resolveActorsCollection();
  const typesRaw = String(game.settings.get(MODULE_ID, "registerForTypes") || "character");
  const types = typesRaw.split(",").map(s => s.trim()).filter(Boolean);
  const makeDefault = !!game.settings.get(MODULE_ID, "makeDefault");

  ActorsColl.registerSheet(MODULE_ID, OnePiece5eSheet, {
    types,
    makeDefault,
    label: game.i18n.localize("OPFVTT.SheetLabel")
  });

  console.log(`[${MODULE_ID}] Registered One Piece 5e sheet for actor types:`, types,
              "default?", makeDefault);
});

Hooks.once("ready", () => {
  console.log(`[${MODULE_ID}] Ready. Open an Actor sheet and pick "${game.i18n.localize("OPFVTT.SheetLabel")}" from the sheet picker.`);
});
