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

  /** @inheritdoc
   *  We manage our own write-permission gating in the bridge — the parent
   *  class' default "is the form editable?" check is too restrictive in
   *  v13: it returns false unless Foundry considers the document edit-able
   *  for this user via a strict ownership check, which makes Foundry call
   *  _disableFields(form) and slap `disabled` on every input and button.
   *  Result: nothing on the sheet is clickable. Allow editing for the
   *  owner or the GM and let the bridge silently no-op writes for anyone
   *  who shouldn't actually be writing.
   */
  get isEditable() {
    if (game.user?.isGM) return true;
    return !!this.actor?.isOwner;
  }

  /** @inheritdoc
   *  Disable Foundry's automatic field-disabling pass. The base class walks
   *  the form on every render and adds `disabled` to every input, select,
   *  textarea, and button when `isEditable` is false. We don't want that —
   *  the sheet's own buttons (Save, Export, Import, Print, Clear, tab
   *  switches, Add Row) must always be clickable, and the bridge already
   *  no-ops persistence for non-owners.
   */
  _disableFields(form) {
    // Intentionally a no-op. See note above.
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
    if (!rootEl) {
      console.warn("[one-piece-5e-sheet] activateListeners called with no root element.");
      return;
    }

    // Locate the sheet root. It may be:
    //  - rootEl itself (if Foundry passed us the form whose first child IS
    //    our wrapper, or passed us the wrapper directly),
    //  - a descendant of rootEl (normal case for classic v1 sheets where html
    //    is the form element),
    //  - or, in v13 ApplicationV2-like setups, attached elsewhere in the
    //    same window — so fall back to the window-app container, then the
    //    document, before giving up.
    let sheetRoot = null;
    if (rootEl.classList?.contains("opfvtt-sheet")) {
      sheetRoot = rootEl;
    } else if (rootEl.querySelector) {
      sheetRoot = rootEl.querySelector(".opfvtt-sheet");
    }
    if (!sheetRoot) {
      // Walk up to the window-app and search downward.
      let p = rootEl.parentElement;
      while (p && !p.classList?.contains("window-app")) p = p.parentElement;
      if (p) sheetRoot = p.querySelector(".opfvtt-sheet");
    }
    if (!sheetRoot && this.element) {
      // Foundry stores the live root on this.element (jQuery in v1, HTMLElement in v13).
      const liveEl = (this.element instanceof HTMLElement) ? this.element : (this.element[0] || this.element.get?.(0));
      if (liveEl) {
        if (liveEl.classList?.contains("opfvtt-sheet")) sheetRoot = liveEl;
        else sheetRoot = liveEl.querySelector?.(".opfvtt-sheet") || null;
      }
    }
    if (!sheetRoot) {
      // Last resort: actor-id-scoped global lookup. Multiple sheets for
      // different actors won't collide because we tag with data-actor-id.
      const actorId = this.actor?.id;
      if (actorId) {
        sheetRoot = document.querySelector(`.opfvtt-sheet[data-actor-id="${actorId}"]`);
      }
    }
    if (!sheetRoot) {
      console.warn("[one-piece-5e-sheet] Sheet root not found in rendered template.",
                   { rootElTag: rootEl.tagName, rootElClass: rootEl.className });
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

    // Defensive cleanup: strip any disabled / readonly / inert attributes
    // that Foundry or other modules may have stamped on our form before our
    // overrides took effect. The bridge already gates writes by ownership;
    // these attributes break the sheet's own UI buttons.
    sheetRoot.querySelectorAll("[disabled]").forEach(el => el.removeAttribute("disabled"));
    sheetRoot.querySelectorAll("[readonly]").forEach(el => el.removeAttribute("readonly"));
    sheetRoot.querySelectorAll("[inert]").forEach(el => el.removeAttribute("inert"));
    // Also remove inert from any ancestor (form / window-content) up to the app window.
    let p = sheetRoot.parentElement;
    while (p && !p.classList.contains("window-app")) {
      if (p.hasAttribute("inert")) p.removeAttribute("inert");
      if (p.hasAttribute("disabled")) p.removeAttribute("disabled");
      p = p.parentElement;
    }

    if (!globalThis.OPFVTT?.boot) {
      console.error("[one-piece-5e-sheet] sheet-runtime.js failed to load.");
      return;
    }

    const bridge = this._buildBridge();
    this._lastBridge = bridge;

    // Re-boot on every render. Foundry replaces the DOM whenever the actor
    // updates, so listeners attached to the previous DOM are gone. Booting
    // again on the fresh DOM is what keeps clicks responsive.
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
    const sheet = this;
    const canWrite = () => actor.isOwner;

    // Update the actor with {render:false} so our own writes don't bounce
    // the sheet through a re-render that would tear down event listeners.
    const writeFlag = async (key, value) => {
      const path = `flags.${MODULE_ID}.${key}`;
      sheet._skipNextRender = true;
      try {
        await actor.update({ [path]: value }, { render: false });
      } catch (err) {
        console.warn("[one-piece-5e-sheet] flag write failed:", err);
      } finally {
        // Clear the skip flag a tick later, in case Foundry queued a render.
        setTimeout(() => { sheet._skipNextRender = false; }, 50);
      }
    };
    const unsetFlag = async (key) => {
      const path = `flags.${MODULE_ID}.-=${key}`;
      sheet._skipNextRender = true;
      try {
        await actor.update({ [path]: null }, { render: false });
      } catch (err) {
        console.warn("[one-piece-5e-sheet] flag unset failed:", err);
      } finally {
        setTimeout(() => { sheet._skipNextRender = false; }, 50);
      }
    };

    // Debounce writes so rapid keystrokes don't hammer the server.
    let pendingFlagWrite = null;
    let pendingFlagValue = null;
    const flushFlagWrite = async () => {
      const v = pendingFlagValue;
      pendingFlagWrite = null;
      pendingFlagValue = null;
      if (v === null || v === undefined) return;
      await writeFlag(FLAG_SHEET_DATA, v);
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
        pendingFlagWrite = setTimeout(flushFlagWrite, 400);
        return true;
      },
      async clearSheetData() {
        if (!canWrite()) return;
        await unsetFlag(FLAG_SHEET_DATA);
        await unsetFlag(FLAG_PORTRAITS);
      },

      // --- Portraits (stored as { [id]: dataURL } in a separate flag) ---
      async portraitPut(id, src) {
        if (!canWrite()) return false;
        const current = foundry.utils.duplicate(actor.getFlag(MODULE_ID, FLAG_PORTRAITS) || {});
        current[id] = src;
        await writeFlag(FLAG_PORTRAITS, current);
        return true;
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
        await writeFlag(FLAG_PORTRAITS, all);
        return true;
      },
      async portraitClear() {
        if (!canWrite()) return;
        await unsetFlag(FLAG_PORTRAITS);
      },

      // --- UX helpers ---
      notify(msg) {
        ui.notifications?.warn(String(msg));
      },
      onClose: () => flushFlagWrite()
    };
  }

  /** @inheritdoc
   *  Skip Foundry-triggered re-renders that originated from our own flag
   *  writes, even though we already pass {render:false}. This is belt-and-
   *  braces: a re-render mid-edit would wipe focus and any in-flight
   *  selection state.
   */
  async _render(force, options) {
    if (this._skipNextRender && !force) {
      return;
    }
    return super._render(force, options);
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
