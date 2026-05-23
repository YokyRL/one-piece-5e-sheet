/* One Piece 5e Pirate Log — Foundry v13 runtime
 * This file ships the original v29 sheet logic, transformed so it operates
 * on a single sheet root element and persists state to Foundry actor flags
 * via the `bridge` object provided by the ActorSheet class.
 * DO NOT load this file directly in a browser — it expects OPFVTT.boot(root, bridge).
 */
(function(){
  'use strict';
  const OPFVTT = (globalThis.OPFVTT = globalThis.OPFVTT || {});

  // Per-instance helpers, captured by closure in _opfvttBoot below.
  function makeScoped($root){
    function scopedQuerySelectorAll(sel){ return $root.querySelectorAll(sel); }
    function scopedQuerySelector(sel){ return $root.querySelector(sel); }
    function scopedGetById(id){
      // IDs are mirrored to `data-orig-id` and we look those up first so the
      // query is scoped to this sheet's DOM subtree. Fall back to a bare
      // `#id` lookup for elements that were dynamically created without the
      // mirror (we patch them in `makeRow` below).
      const byOrig = $root.querySelector('[data-orig-id="' + id + '"]');
      if (byOrig) return byOrig;
      const esc = (str) => (window.CSS && CSS.escape) ? CSS.escape(str) : str.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
      return $root.querySelector('#' + esc(id));
    }
    function scopedAddEventListener(type, handler, opts){
      // Delegate document-level listeners onto the sheet root.
      $root.addEventListener(type, function(ev){
        // Some original listeners use `e.target.closest(...)` which works regardless.
        handler(ev);
      }, opts);
    }
    return { scopedQuerySelectorAll, scopedQuerySelector, scopedGetById, scopedAddEventListener };
  }

  // === Begin transformed IIFE — defined as a factory ===
function _opfvttBoot($root, bridge, scoped){
  const { scopedQuerySelectorAll, scopedQuerySelector, scopedGetById, scopedAddEventListener } = scoped;

  'use strict';
  const STORAGE_KEY = 'onePiece5eDigitalForm.v16';
  const LEGACY_STORAGE_KEYS = ['onePiece5eDigitalForm.v15','onePiece5eDigitalForm.v14','onePiece5eDigitalForm.v13','onePiece5eDigitalForm.v12','onePiece5eDigitalForm.v11','onePiece5eDigitalForm.v10','onePiece5eDigitalForm.v9','onePiece5eDigitalForm.v8','onePiece5eDigitalForm.v7','onePiece5eDigitalForm.v6','onePiece5eDigitalForm.v5','onePiece5eDigitalForm.v4','onePiece5eDigitalForm.v3','onePiece5eDigitalForm.v2','onePiece5eDigitalForm.v1'];
  const tabs = scopedQuerySelectorAll('.tab-btn');
  const panels = scopedQuerySelectorAll('.tab-panel');
  const status = scopedGetById('status');
  let portraitSlots = [];
  let activePortraitId = '';
  const PORTRAIT_DB_NAME = 'onePiece5ePortraitImages';
  const PORTRAIT_DB_VERSION = 1;
  const PORTRAIT_STORE = 'portraits';
  const PORTRAIT_LOCAL_PREFIX = STORAGE_KEY + '.portrait.';
  const dynamicLists = {
    resources:{type:'resource', defaults:[['Rage / Focus','','',''],['Class Resource','','','']]},
    attacks:{type:'attack', defaults:[['Unarmed Strike','','',''],['Main Weapon','','','']]},
    classFeatures:{type:'feature', defaults:[['','','']]},
    traits:{type:'feature', defaults:[['','','']]},
    languages:{type:'language', defaults:[['Common','']]},
    feats:{type:'feature', defaults:[['','','']]},
    haki:{type:'feature', defaults:[['Observation Haki','',''],['Armament Haki','',''],['Conqueror\'s Haki','','']]},
    devilFruit:{type:'feature', defaults:[['','','']]},
    customTechniques:{type:'feature', defaults:[['','','']]},
    gear:{type:'gear', defaults:[['Gear','','','','','','','','','','']]},
    magicItems:{type:'magicItem', defaults:[['','','']]},
    treasure:{type:'treasure', defaults:[['','','']]},
    contacts:{type:'contact', defaults:[['','','']]},
    sessionNotes:{type:'note', defaults:[['','','']]}
  };
  const skills = [
    ['Acrobatics','DEX'],['Animal Handling','WIS'],['Arcana','INT'],['Athletics','STR'],['Deception','CHA'],['History','INT'],['Insight','WIS'],['Intimidation','CHA'],['Investigation','INT'],['Medicine','WIS'],['Nature','INT'],['Perception','WIS'],['Performance','CHA'],['Persuasion','CHA'],['Religion','INT'],['Sleight of Hand','DEX'],['Stealth','DEX'],['Survival','WIS']
  ];
  function setStatus(msg){ if(status) status.textContent = msg; }
  function setPortraitStorageStatus(msg){
    const el = scopedGetById('portraitStorageStatus');
    if(el) el.textContent = msg;
  }
  function openPortraitDb(){ return Promise.resolve(null); }
  async function portraitDbPut(id, srcVal){ if(!id||!srcVal) return false; return bridge.portraitPut(id, srcVal); }
  async function portraitDbGet(id){ if(!id) return ''; return bridge.portraitGet(id); }
  async function portraitDbDelete(id){ if(!id) return false; return bridge.portraitDelete(id); }
  async function portraitDbClear(){ try { await bridge.portraitClear(); } catch(e){ console.warn(e); } }
  function portraitLocalPut(id, srcVal){ return bridge.portraitPut(id, srcVal); }
  function portraitLocalGet(id){ try { const v = bridge.portraitGetSync && bridge.portraitGetSync(id); return v || ''; } catch(e){ return ''; } }
  function portraitLocalDelete(id){ bridge.portraitDelete(id); }
  function portraitLocalClear(){ try { bridge.portraitClear(); } catch(e){} }
  function readFileAsDataUrl(file){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Image could not be read'));
      reader.readAsDataURL(file);
    });
  }
  function resizeImageDataUrl(dataUrl, maxDimension = 1600, quality = 0.88){
    return new Promise(resolve=>{
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if(!width || !height){ resolve(dataUrl); return; }
        const scale = Math.min(1, maxDimension / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext('2d');
        if(!ctx){ resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try{ resolve(canvas.toDataURL('image/webp', quality)); }
        catch(e){ try{ resolve(canvas.toDataURL('image/jpeg', quality)); } catch(err){ resolve(dataUrl); } }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }
  async function preparePortraitImage(file){
    const raw = await readFileAsDataUrl(file);
    return resizeImageDataUrl(raw, 1200, 0.82);
  }
  async function hydratePortraitSourcesFromDb(){
    let loaded = false;
    for(const portrait of portraitSlots){
      if(!portrait || portrait.src) continue;
      try{
        const stored = await portraitDbGet(portrait.id);
        if(stored){ portrait.src = stored; loaded = true; continue; }
      } catch(e){ console.warn(e); }
      const fallback = portraitLocalGet(portrait.id);
      if(fallback){ portrait.src = fallback; loaded = true; }
    }
    if(loaded){ renderPortraitManager(); updateCharacterReference(); }
  }
  async function persistLoadedPortraitSources(){
    for(const portrait of portraitSlots){
      if(portrait && portrait.id && portrait.src){
        try{ await portraitDbPut(portrait.id, portrait.src); }
        catch(e){
          console.warn(e);
          if(!portraitLocalPut(portrait.id, portrait.src)) setPortraitStorageStatus('Portrait preview works, but browser image storage was unavailable. Export a backup.');
        }
      }
    }
  }

  function getFieldValue(id){
    const el = scopedGetById(id);
    if(!el) return '';
    if(el.type === 'checkbox') return el.checked ? 'Yes' : 'No';
    return el.value || '';
  }
  function syncMirrorsFromMain(){
    scopedQuerySelectorAll('[data-sync-target]').forEach(el=>{
      const target = scopedGetById(el.dataset.syncTarget);
      if(!target || el === document.activeElement) return;
      if(el.value !== target.value) el.value = target.value || '';
    });
  }
  function updateRefDisplays(){
    scopedQuerySelectorAll('[data-ref]').forEach(node=>{
      const value = getFieldValue(node.dataset.ref);
      node.textContent = value || '—';
    });
  }
  function rowValues(listName){
    return Array.from(scopedQuerySelectorAll(`[data-list="${listName}"] .add-row`)).map(row=>Array.from(row.querySelectorAll('[data-k]')).map(el=>el.value || ''));
  }
  function compactText(text, max){
    text = String(text || '').replace(/\s+/g,' ').trim();
    if(!max || text.length <= max) return text;
    return text.slice(0, max - 1).trim() + '…';
  }
  function updateCharacterReference(){
    syncMirrorsFromMain();
    updateRefDisplays();
    const skillHost = scopedGetById('characterSkillReference');
    if(skillHost){
      const proficientSkills = Array.from(scopedQuerySelectorAll('#skillsBody tr')).filter(row=>row.querySelector('[data-skill-prof]')?.checked).map(row=>({
        name: row.querySelector('.skill-name')?.textContent.trim() || 'Skill',
        total: row.querySelector('[data-skill-total]')?.value || '+0'
      }));
      skillHost.innerHTML = proficientSkills.length ? proficientSkills.map(skill=>`<div class="skill-ref-item"><span class="skill-ref-name">${escapeHtml(skill.name)}</span><span class="skill-ref-total">${escapeHtml(skill.total)}</span></div>`).join('') : '<div class="empty-ref">No proficient skills checked.</div>';
    }
    const saveHost = scopedGetById('characterSaveReference');
    if(saveHost){
      const map = [['Str','STR'],['Dex','DEX'],['Con','CON'],['Int','INT'],['Wis','WIS'],['Cha','CHA']];
      saveHost.innerHTML = map.map(([label, display])=>{
        const ability = scopedQuerySelector(`input[name="save${label}Ability"]`)?.value || '+0';
        const misc = scopedQuerySelector(`input[name="save${label}Misc"]`)?.value || '';
        const total = scopedQuerySelector(`input[name="save${label}"]`)?.value || '+0';
        const prof = scopedGetById('save' + label + 'Prof')?.checked ? ' + Prof' : '';
        const cleanMisc = misc.trim() ? ' + Mod ' + misc.trim() : '';
        return `<div class="save-ref-card"><strong>${display}</strong><span class="save-ref-formula">Ability ${escapeHtml(ability)}${escapeHtml(prof)}${escapeHtml(cleanMisc)}</span><span class="save-ref-total">${escapeHtml(total)}</span></div>`;
      }).join('');
    }
    const attackHost = scopedGetById('characterAttackReference');
    if(attackHost){
      const attackRows = rowValues('attacks').filter(v=>v.some(Boolean)).map(v=>({
        title:v[0] || 'Attack',
        meta:[v[1] ? 'Atk ' + v[1] : '', v[2] || ''].filter(Boolean).join(' • ') || 'No bonus / damage set',
        note:v[3] || '',
        type:'Technique'
      }));
      const weaponRows = rowValues('gear').filter(v=>(v[0] || '') === 'Weapon' && v.some(Boolean)).map(v=>({
        title:v[1] || 'Weapon',
        meta:[v[5] || '', v[6] ? 'Range ' + v[6] : '', v[7] || ''].filter(Boolean).join(' • ') || 'Weapon',
        note:v[10] || '',
        type:'Weapon'
      }));
      const rows = weaponRows.concat(attackRows);
      attackHost.innerHTML = rows.length ? rows.slice(0, 18).map(v=>`<div class="ref-list-item"><div class="ref-list-title">${escapeHtml(v.title)}</div><div class="ref-list-meta">${escapeHtml(v.type + (v.meta ? ' • ' + v.meta : ''))}</div><div class="ref-list-note">${escapeHtml(compactText(v.note || '', 150) || '—')}</div></div>`).join('') : '<div class="empty-ref">No weapons, attacks, or techniques added yet.</div>';
    }
    const featureHost = scopedGetById('characterFeatureReference');
    if(featureHost){
      const groups = [
        ['Class', 'classFeatures'], ['Traits', 'traits'], ['Haki', 'haki'], ['Languages', 'languages'], ['Feats', 'feats'], ['Fruit', 'devilFruit'], ['Custom', 'customTechniques']
      ];
      const items = [];
      groups.forEach(([label, list])=>{
        rowValues(list).filter(v=>v.some(Boolean)).forEach(v=>{
          const title = v[0] || label;
          const meta = list === 'languages' ? label : (v[1] || label);
          const note = list === 'languages' ? (v[1] || '') : (v[2] || '');
          items.push({label, title, meta, note});
        });
      });
      featureHost.innerHTML = items.length ? items.slice(0, 16).map(i=>`<div class="ref-list-item"><div class="ref-list-title">${escapeHtml(i.title)}</div><div class="ref-list-meta">${escapeHtml(i.meta || i.label)}</div><div class="ref-list-note">${escapeHtml(compactText(i.note || '', 130) || '—')}</div></div>`).join('') : '<div class="empty-ref">No features, languages, Haki, or powers added yet.</div>';
    }
  }

  function slugify(text){ return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'section'; }
  function tabNameFromPanel(panel){
    const id = panel && panel.id ? panel.id.replace(/^tab-/,'') : '';
    const btn = scopedQuerySelector(`.tab-btn[data-tab="${id}"]`);
    return btn ? btn.textContent.trim() : id;
  }
  function assignSectionKeys(){
    const counts = {};
    scopedQuerySelectorAll('.tab-panel:not(#tab-config) .section').forEach(section=>{
      const panel = section.closest('.tab-panel');
      const tab = panel ? panel.id.replace(/^tab-/,'') : 'form';
      const title = section.querySelector('.section-header h2')?.textContent.trim() || 'Section';
      const base = `${tab}-${slugify(title)}`;
      counts[base] = (counts[base] || 0) + 1;
      section.dataset.sectionKey = counts[base] > 1 ? `${base}-${counts[base]}` : base;
      section.dataset.sectionTitle = title;
      section.dataset.tabName = tabNameFromPanel(panel);
    });
  }
  function getHiddenSections(){
    const hidden = {};
    scopedQuerySelectorAll('.config-toggle').forEach(cb=>{ hidden[cb.dataset.sectionKey] = cb.checked; });
    return hidden;
  }
  function applySectionVisibility(hidden){
    hidden = hidden || {};
    scopedQuerySelectorAll('.section[data-section-key]').forEach(section=>{
      const isHidden = !!hidden[section.dataset.sectionKey];
      section.classList.toggle('section-hidden', isHidden);
    });
    scopedQuerySelectorAll('.config-toggle').forEach(cb=>{ cb.checked = !!hidden[cb.dataset.sectionKey]; });
  }
  const trackerDefs = [
    {key:'hp', label:'HP'},
    {key:'tempHp', label:'Temp HP'},
    {key:'haki', label:'Haki'},
    {key:'staminaKi', label:'Stamina / Ki'},
    {key:'techniques', label:'Techniques'},
    {key:'luck', label:'Luck'}
  ];
  function getHiddenTrackers(){
    const hidden = {};
    scopedQuerySelectorAll('.tracker-toggle').forEach(cb=>{ hidden[cb.dataset.trackerKey] = cb.checked; });
    return hidden;
  }
  function applyTrackerVisibility(hidden){
    hidden = hidden || {};
    scopedQuerySelectorAll('[data-tracker-key]').forEach(cell=>{
      cell.classList.toggle('tracker-hidden', !!hidden[cell.dataset.trackerKey]);
    });
    scopedQuerySelectorAll('.tracker-toggle').forEach(cb=>{ cb.checked = !!hidden[cb.dataset.trackerKey]; });
  }
  function buildTrackerConfigPanel(hidden){
    const host = scopedGetById('configTrackerList');
    if(!host) return;
    host.innerHTML = `<div class="config-group"><h3>Character Trackers</h3><div class="config-items">${trackerDefs.map(t=>`<label class="config-toggle-row"><input class="tracker-toggle" type="checkbox" data-tracker-key="${escapeHtml(t.key)}"${hidden && hidden[t.key] ? ' checked' : ''}><span>Hide ${escapeHtml(t.label)}</span></label>`).join('')}</div></div>`;
    applyTrackerVisibility(hidden || {});
  }
  function buildConfigPanel(hidden){
    const host = scopedGetById('configVisibilityList');
    if(!host) return;
    const groups = {};
    scopedQuerySelectorAll('.tab-panel:not(#tab-config) .section[data-section-key]').forEach(section=>{
      const tab = section.dataset.tabName || 'Form';
      if(!groups[tab]) groups[tab] = [];
      groups[tab].push({key:section.dataset.sectionKey, title:section.dataset.sectionTitle || 'Section'});
    });
    host.innerHTML = Object.entries(groups).map(([tab, sections])=>`<div class="config-group"><h3>${escapeHtml(tab)}</h3><div class="config-items">${sections.map(s=>`<label class="config-toggle-row"><input class="config-toggle" type="checkbox" data-section-key="${escapeHtml(s.key)}"${hidden && hidden[s.key] ? ' checked' : ''}><span>Hide ${escapeHtml(s.title)}</span></label>`).join('')}</div></div>`).join('');
    applySectionVisibility(hidden || {});
  }

  function updateRemoveMode(){
    const enabled = !!scopedGetById('removeMode')?.checked;
    document.body.classList.toggle('show-remove', enabled);
  }

  const stickySyncMap = {stickyCharacterName:'characterName', stickyClassName:'className', stickyLevel:'level', stickySubclass:'subclass'};
  const mainToStickyMap = Object.fromEntries(Object.entries(stickySyncMap).map(([k,v])=>[v,k]));
  function syncStickyFromMain(){
    Object.entries(stickySyncMap).forEach(([stickyId, mainId])=>{
      const sticky = scopedGetById(stickyId);
      const main = scopedGetById(mainId);
      if(sticky && main && sticky !== document.activeElement && sticky.value !== main.value) sticky.value = main.value;
    });
    updateCharacterReference();
  }
  function syncMainFromSticky(el){
    const targetId = el && el.dataset ? el.dataset.syncTarget : '';
    if(!targetId) return;
    const target = scopedGetById(targetId);
    if(target && target.value !== el.value) target.value = el.value;
  }
  function parseNum(value){
    const n = parseFloat(String(value || '').replace(/[^0-9+.-]/g,''));
    return Number.isFinite(n) ? n : 0;
  }
  function formatSigned(n){
    n = Number.isFinite(n) ? n : 0;
    return n > 0 ? '+' + n : String(n);
  }
  function abilityScoreModifier(score){
    const n = parseInt(String(score || '').replace(/[^0-9-]/g,''), 10);
    if(!Number.isFinite(n) || n < 1 || n > 30) return null;
    return Math.floor((n - 10) / 2);
  }
  function proficiencyBonusForLevel(level){
    const n = Math.max(1, Math.min(20, parseInt(String(level || '').replace(/[^0-9-]/g,''), 10) || 1));
    if(n >= 17) return 6;
    if(n >= 13) return 5;
    if(n >= 9) return 4;
    if(n >= 5) return 3;
    return 2;
  }
  function levelForXp(xp){
    const n = parseInt(String(xp || '').replace(/[^0-9]/g,''), 10);
    if(!Number.isFinite(n)) return null;
    const table = [[355000,20],[305000,19],[265000,18],[225000,17],[195000,16],[165000,15],[140000,14],[120000,13],[100000,12],[85000,11],[64000,10],[48000,9],[34000,8],[23000,7],[14000,6],[6500,5],[2700,4],[900,3],[300,2],[0,1]];
    const row = table.find(([threshold])=>n >= threshold);
    return row ? row[1] : 1;
  }
  function updateProficiencyBonus(){
    const levelEl = scopedGetById('level');
    const xpEl = scopedGetById('xp');
    const profEl = scopedGetById('profBonus');
    if(!levelEl || !profEl) return;
    if(!levelEl.value && xpEl && xpEl.value){
      const derivedLevel = levelForXp(xpEl.value);
      if(derivedLevel) levelEl.value = String(derivedLevel);
    }
    const level = parseInt(String(levelEl.value || '').replace(/[^0-9-]/g,''), 10);
    profEl.value = Number.isFinite(level) ? formatSigned(proficiencyBonusForLevel(level)) : '';
  }
  function calculateAbilityModifiers(){
    ['str','dex','con','int','wis','cha'].forEach(ability=>{
      const score = scopedGetById(ability + 'Score');
      const mod = scopedGetById(ability + 'Mod');
      const misc = scopedGetById(ability + 'Misc');
      const total = scopedGetById(ability + 'Total');
      if(!score || !mod) return;
      const value = abilityScoreModifier(score.value);
      const base = value === null ? null : value;
      mod.value = base === null ? '' : formatSigned(base);
      if(total){
        const totalValue = base === null ? parseNum(misc?.value) : base + parseNum(misc?.value);
        total.value = (base === null && !misc?.value) ? '' : formatSigned(totalValue);
      }
    });
  }
  function updateSkillTotals(){
    const profBonus = parseNum(scopedGetById('profBonus')?.value || '+2');
    scopedQuerySelectorAll('#skillsBody tr').forEach(row=>{
      const ability = row.dataset.ability || '';
      const abilityBonus = parseNum(scopedGetById(ability.toLowerCase() + 'Total')?.value);
      const prof = row.querySelector('[data-skill-prof]')?.checked ? profBonus : 0;
      const bonus = row.querySelector('[data-skill-bonus]');
      const total = row.querySelector('[data-skill-total]');
      if(bonus) bonus.value = formatSigned(abilityBonus);
      if(total) total.value = formatSigned(prof + abilityBonus);
    });
  }

  function updateSavingThrows(){
    const profBonus = parseNum(scopedGetById('profBonus')?.value || '+2');
    const map = [['Str','str'],['Dex','dex'],['Con','con'],['Int','int'],['Wis','wis'],['Cha','cha']];
    map.forEach(([label, ability])=>{
      const totalField = scopedQuerySelector(`input[name="save${label}"]`);
      if(!totalField) return;
      const abilityField = scopedQuerySelector(`input[name="save${label}Ability"]`);
      const miscField = scopedQuerySelector(`input[name="save${label}Misc"]`);
      const abilityBonus = parseNum(scopedGetById(ability + 'Total')?.value);
      const prof = scopedGetById('save' + label + 'Prof')?.checked ? profBonus : 0;
      const misc = parseNum(miscField?.value);
      if(abilityField){ abilityField.value = formatSigned(abilityBonus); abilityField.readOnly = true; }
      totalField.value = formatSigned(abilityBonus + prof + misc);
      totalField.readOnly = true;
    });
  }


  function updateAllCalculations(){
    updateProficiencyBonus();
    calculateAbilityModifiers();
    updateArmorClass();
    updateSkillTotals();
    updateSavingThrows();
    updateRemoveMode();
    updateCharacterReference();
  }
  function updateArmorClass(){
    const armorClass = scopedGetById('armorClass');
    if(!armorClass) return;
    const dex = parseNum(scopedGetById('dexTotal')?.value || scopedGetById('dexMod')?.value);
    const useUnarmored = !!scopedGetById('unarmoredDefense')?.checked;
    const ability1 = scopedGetById('unarmoredAbility1')?.value || 'dex';
    const ability2 = scopedGetById('unarmoredAbility2')?.value || 'wis';
    const unarmoredBonus = parseNum(scopedGetById(ability1 + 'Total')?.value) + parseNum(scopedGetById(ability2 + 'Total')?.value);
    let equipmentBonus = 0;
    let penalty = 0;
    scopedQuerySelectorAll('[data-list="gear"] .gear-row').forEach(row=>{
      const type = row.querySelector('[data-k="type"]')?.value || row.dataset.type || '';
      if(type === 'Armor'){
        equipmentBonus += parseNum(row.querySelector('[data-k="acBonus"]')?.value);
        penalty += Math.abs(parseNum(row.querySelector('[data-k="armorPenalty"]')?.value));
      }
    });
    const baseAbilityBonus = useUnarmored ? unarmoredBonus : dex;
    armorClass.value = String(10 + baseAbilityBonus + equipmentBonus - penalty);
    armorClass.title = useUnarmored ? '10 + selected Ability 1 modifier + selected Ability 2 modifier + equipment AC bonus - armor penalty' : '10 + DEX modifier + equipment AC bonus - armor penalty';
  }


  function escapeHtml(str){ return String(str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
  function skillRows(){
    const body = scopedGetById('skillsBody');
    body.innerHTML = skills.map((s,i)=>`<tr data-ability="${s[1]}"><td class="tiny"><input type="checkbox" name="skill_${i}_prof" data-skill-prof aria-label="${s[0]} proficiency"></td><td><span class="skill-name">${s[0]}</span></td><td><span class="ability-tag">${s[1]}</span></td><td><input name="skill_${i}_bonus" data-skill-bonus class="skill-ability-bonus" type="text" maxlength="4" readonly aria-label="${s[0]} ability bonus"></td><td><input name="skill_${i}_total" data-skill-total class="skill-total" type="text" readonly aria-label="${s[0]} total"></td><td><input name="skill_${i}_notes" type="text" aria-label="${s[0]} notes"></td></tr>`).join('');
  }
  function normalizeGearValues(values){
    values = Array.isArray(values) ? values.slice() : [];
    const validTypes = ['Armor','Weapon','Gear','Tool','Misc'];
    if(values.length === 4 && !validTypes.includes(values[0])){
      return ['Gear', values[0] || '', values[1] || '', '', '', '', '', '', '', '', values[3] || values[2] || ''];
    }
    if(values.length <= 6){
      const type = validTypes.includes(values[0]) ? values[0] : 'Gear';
      return [type, values[1] || '', values[2] || '', values[3] || '', values[4] || '', '', '', '', '', '', values[5] || ''];
    }
    if(values.length === 10){
      // v12 equipment rows did not have a dedicated Range column. Insert it before Properties.
      values = [values[0], values[1], values[2], values[3], values[4], values[5], '', values[6], values[7], values[8], values[9]];
    }
    while(values.length < 11) values.push('');
    if(!validTypes.includes(values[0])) values[0] = 'Gear';
    return values;
  }
  function updateGearRowType(row){
    const select = row && row.querySelector('[data-k="type"]');
    if(!select) return;
    row.dataset.type = select.value || 'Gear';
    const name = row.querySelector('[data-k="name"]');
    const notes = row.querySelector('[data-k="notes"]');
    const placeholders = {
      Armor:['Armor Name','Armor notes / stealth rules / requirements'],
      Weapon:['Weapon Name','Notes / special technique use'],
      Gear:['Item','Notes / contents / location'],
      Tool:['Tool Name','Notes / proficiency / special use'],
      Misc:['Item','Notes']
    };
    const p = placeholders[row.dataset.type] || placeholders.Gear;
    if(name) name.placeholder = p[0];
    if(notes) notes.placeholder = p[1];
  }
  function makeRow(listName, values){
    const config = dynamicLists[listName];
    const row = document.createElement('div');
    row.className = 'add-row';
    row.dataset.row = listName;
    if(config.type === 'resource'){
      row.className = 'add-row resource-row';
      row.innerHTML = `<input data-k="name" placeholder="Resource" value="${escapeHtml(values && values[0])}"><input data-k="current" placeholder="Current" maxlength="4" value="${escapeHtml(values && values[1])}"><input data-k="max" placeholder="Max" maxlength="4" value="${escapeHtml(values && values[2])}"><textarea data-k="notes" placeholder="Notes / recovery / cost">${escapeHtml(values && values[3])}</textarea><button type="button" class="remove-btn" aria-label="Remove row">x</button>`;
    } else if(config.type === 'attack'){
      row.className = 'add-row five-col';
      row.innerHTML = `<input data-k="name" placeholder="Name" value="${escapeHtml(values && values[0])}"><input data-k="bonus" placeholder="Atk Bonus" value="${escapeHtml(values && values[1])}"><input data-k="damage" placeholder="Damage / Type" value="${escapeHtml(values && values[2])}"><textarea data-k="notes" placeholder="Range, cost, save DC, properties, effect">${escapeHtml(values && values[3])}</textarea><button type="button" class="remove-btn" aria-label="Remove row">x</button>`;
    } else if(config.type === 'gear'){
      row.className = 'add-row gear-row';
      values = normalizeGearValues(values);
      const typeVal = values[0] || 'Gear';
      row.dataset.type = typeVal;
      const typeOptions = ['Armor','Weapon','Gear','Tool','Misc'].map(o=>`<option${o===typeVal?' selected':''}>${o}</option>`).join('');
      row.innerHTML = `<select data-k="type" aria-label="Equipment type">${typeOptions}</select><input data-k="name" placeholder="Item" value="${escapeHtml(values[1])}"><input class="equip-field show-gear show-misc" data-k="qty" placeholder="Qty" value="${escapeHtml(values[2])}"><input class="equip-field show-armor" data-k="acBonus" placeholder="AC+" value="${escapeHtml(values[3])}"><input class="equip-field show-armor" data-k="armorPenalty" placeholder="Penalty" value="${escapeHtml(values[4])}"><input class="equip-field show-weapon" data-k="damage" placeholder="Damage" value="${escapeHtml(values[5])}"><input class="equip-field show-weapon" data-k="range" placeholder="Range" value="${escapeHtml(values[6])}"><input class="equip-field show-weapon" data-k="properties" placeholder="Properties" value="${escapeHtml(values[7])}"><input class="equip-field show-tool" data-k="uses" placeholder="Uses" value="${escapeHtml(values[8])}"><input class="equip-field show-gear show-tool show-misc" data-k="detail" placeholder="Value / Detail" value="${escapeHtml(values[9])}"><textarea data-k="notes" placeholder="Notes / description">${escapeHtml(values[10])}</textarea><button type="button" class="remove-btn" aria-label="Remove row">x</button>`;
    } else if(config.type === 'language'){
      row.className = 'add-row language-row';
      row.innerHTML = `<input data-k="language" placeholder="Language" value="${escapeHtml(values && values[0])}"><textarea data-k="notes" placeholder="Notes / dialect / source">${escapeHtml(values && values[1])}</textarea><button type="button" class="remove-btn" aria-label="Remove row">x</button>`;
    } else if(config.type === 'magicItem'){
      row.className = 'add-row magic-row';
      row.innerHTML = `<input data-k="name" placeholder="Special Item" value="${escapeHtml(values && values[0])}"><input data-k="rarity" placeholder="Rarity" value="${escapeHtml(values && values[1])}"><textarea data-k="description" placeholder="Description / attunement / charges">${escapeHtml(values && values[2])}</textarea><button type="button" class="remove-btn" aria-label="Remove row">x</button>`;
    } else if(config.type === 'treasure'){
      row.className = 'add-row treasure-row';
      row.innerHTML = `<input data-k="name" placeholder="Treasure / Supply" value="${escapeHtml(values && values[0])}"><input data-k="value" placeholder="฿ Value" value="${escapeHtml(values && values[1])}"><textarea data-k="description" placeholder="Notes / location / owner">${escapeHtml(values && values[2])}</textarea><button type="button" class="remove-btn" aria-label="Remove row">x</button>`;
    } else if(config.type === 'contact'){
      row.className = 'add-row';
      row.innerHTML = `<input data-k="name" placeholder="Name" value="${escapeHtml(values && values[0])}"><input data-k="relation" placeholder="Relation" value="${escapeHtml(values && values[1])}"><textarea data-k="notes" placeholder="Notes">${escapeHtml(values && values[2])}</textarea><button type="button" class="remove-btn" aria-label="Remove row">x</button>`;
    } else if(config.type === 'note'){
      row.className = 'add-row';
      row.innerHTML = `<input data-k="title" placeholder="Session / Date" value="${escapeHtml(values && values[0])}"><input data-k="location" placeholder="Location / Arc" value="${escapeHtml(values && values[1])}"><textarea data-k="notes" placeholder="Notes">${escapeHtml(values && values[2])}</textarea><button type="button" class="remove-btn" aria-label="Remove row">x</button>`;
    } else {
      row.innerHTML = `<input data-k="name" placeholder="Name" value="${escapeHtml(values && values[0])}"><input data-k="source" placeholder="Source" value="${escapeHtml(values && values[1])}"><textarea data-k="description" placeholder="Description">${escapeHtml(values && values[2])}</textarea><button type="button" class="remove-btn" aria-label="Remove row">x</button>`;
    }
    row.querySelector('.remove-btn').addEventListener('click',()=>{ row.remove(); updateAllCalculations(); autosave(); });
    if(config.type === 'gear') updateGearRowType(row);
    row.querySelectorAll('input,select,textarea').forEach(el=>{
      el.addEventListener('input', ()=>{ if(config.type === 'gear') updateGearRowType(row); updateAllCalculations(); autosave(); });
      el.addEventListener('change', ()=>{ if(config.type === 'gear') updateGearRowType(row); updateAllCalculations(); autosave(); });
    });
    return row;
  }
  function addRow(listName, values){
    const list = scopedQuerySelector(`[data-list="${listName}"]`);
    if(!list) return;
    list.appendChild(makeRow(listName, values || []));
    updateAllCalculations();
  }
  function initDynamicDefaults(){
    Object.keys(dynamicLists).forEach(name=>{
      const list = scopedQuerySelector(`[data-list="${name}"]`);
      if(list && list.children.length === 0){ dynamicLists[name].defaults.forEach(v=>addRow(name,v)); }
    });
  }
  function collect(options = {}){
    updateAllCalculations();
    syncStickyFromMain();
    const includeImages = !!options.includeImages;
    const activePortrait = getActivePortrait();
    const portraitItems = portraitSlots.map(p=>{
      const clean = {id:p.id || makePortraitId(), name:p.name || 'Portrait'};
      if(includeImages && p.src) clean.src = p.src;
      return clean;
    });
    const data = {
      fields:{},
      checks:{},
      lists:{},
      hiddenSections:getHiddenSections(),
      hiddenTrackers:getHiddenTrackers(),
      activeTab:scopedQuerySelector('.tab-btn[aria-selected="true"]')?.dataset.tab || 'character',
      portrait:includeImages && activePortrait ? (activePortrait.src || '') : '',
      portraits:{items:portraitItems, active:activePortraitId}
    };
    scopedQuerySelectorAll('input[name],select[name],textarea[name]').forEach(el=>{
      if(el.type === 'checkbox') data.checks[el.name] = el.checked;
      else data.fields[el.name] = el.value;
    });
    Object.keys(dynamicLists).forEach(name=>{
      const list = scopedQuerySelector(`[data-list="${name}"]`);
      data.lists[name] = Array.from(list?.children || []).map(row => Array.from(row.querySelectorAll('[data-k]')).map(el=>el.value));
    });
    return data;
  }

  function apply(data){
    if(!data) return;
    if(data.fields && data.fields.languages && (!data.lists || !data.lists.languages)){ data.lists = data.lists || {}; data.lists.languages = [[data.fields.languages, '']]; }
    ['hakiPoints','staminaPoints','techniqueUses','luckPoints'].forEach(oldName=>{
      if(data.fields && data.fields[oldName] && !data.fields[oldName + 'Current'] && !data.fields[oldName + 'Max']){
        const parts = String(data.fields[oldName]).split('/').map(s=>s.trim());
        data.fields[oldName + 'Current'] = parts[0] || data.fields[oldName];
        data.fields[oldName + 'Max'] = parts[1] || '';
      }
    });
    scopedQuerySelectorAll('input[name],select[name],textarea[name]').forEach(el=>{
      if(el.type === 'checkbox') el.checked = !!(data.checks && data.checks[el.name]);
      else if(data.fields && Object.prototype.hasOwnProperty.call(data.fields, el.name)) el.value = data.fields[el.name];
    });
    updateRemoveMode();
    Object.keys(dynamicLists).forEach(name=>{
      const list = scopedQuerySelector(`[data-list="${name}"]`);
      if(!list) return;
      list.innerHTML = '';
      const rows = data.lists && data.lists[name] && data.lists[name].length ? data.lists[name] : dynamicLists[name].defaults;
      rows.forEach(v=>addRow(name,v));
    });
    loadPortraitData(data);
    buildConfigPanel(data.hiddenSections || {});
    buildTrackerConfigPanel(data.hiddenTrackers || {});
    applySectionVisibility(data.hiddenSections || {});
    applyTrackerVisibility(data.hiddenTrackers || {});
    updateAllCalculations();
    syncStickyFromMain();
    switchTab(data.activeTab || 'character');
  }
  function safeGet(){ try { return bridge.getSheetData() || null; } catch(e){ console.warn(e); return null; } }
  function removeLegacyStorage(){ /* not used in Foundry build */ }
  function safeSet(value){ try { bridge.setSheetData(value); return true; } catch(e){ console.warn(e); return false; } }
  function safeRemove(){ try { bridge.clearSheetData(); } catch(e){ console.warn(e); } }
  function save(showMessage = true){
    const ok = safeSet(JSON.stringify(collect()));
    if(showMessage){
      setStatus((ok ? 'Autosaved ' : 'Storage unavailable. Export backup. Checked ') + new Date().toLocaleTimeString());
    }
    return ok;
  }
  let saveTimer = null;
  function autosave(){
    setStatus('Saving...');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(()=>save(true), 120);
  }
  function saveNow(){
    clearTimeout(saveTimer);
    save(true);
  }
  function load(){
    const raw = safeGet();
    if(raw){ try{ apply(JSON.parse(raw)); setStatus('Loaded autosaved form.'); return; } catch(e){ console.warn(e); }}
    initDynamicDefaults();
    updateRemoveMode();
    renderPortraitManager();
    updateAllCalculations();
  }
  function switchTab(tab){
    if(!tab) tab = 'character';
    tabs.forEach(btn=>btn.setAttribute('aria-selected', btn.dataset.tab === tab ? 'true' : 'false'));
    panels.forEach(panel=>panel.classList.toggle('active', panel.id === 'tab-' + tab));
    /* tab hash sync disabled in Foundry */
  }
  function setPortrait(src){
    const pairs = [
      ['portraitPreview','portraitPlaceholder'],
      ['portraitPreviewSmall','portraitPlaceholderSmall']
    ];
    pairs.forEach(([imgId, placeholderId])=>{
      const img = scopedGetById(imgId);
      const placeholder = scopedGetById(placeholderId);
      if(!img || !placeholder) return;
      img.src = src || '';
      img.style.display = src ? 'block' : 'none';
      placeholder.style.display = src ? 'none' : 'grid';
    });
  }
  function makePortraitId(){
    return 'portrait-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7);
  }
  function getActivePortrait(){
    return portraitSlots.find(p=>p.id === activePortraitId) || portraitSlots[0] || null;
  }
  function renderPortraitManager(){
    const select = scopedGetById('portraitSelect');
    const nameInput = scopedGetById('portraitSlotName');
    const list = scopedGetById('portraitList');
    if(activePortraitId && !portraitSlots.some(p=>p.id === activePortraitId)) activePortraitId = portraitSlots[0]?.id || '';
    const active = getActivePortrait();
    if(active && !activePortraitId) activePortraitId = active.id;
    if(select){
      select.innerHTML = '<option value="">No portrait selected</option>' + portraitSlots.map((p,i)=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name || ('Portrait ' + (i+1)))}</option>`).join('');
      select.value = activePortraitId || '';
    }
    if(nameInput && document.activeElement !== nameInput) nameInput.value = active ? (active.name || '') : '';
    if(list){
      if(!portraitSlots.length){
        list.innerHTML = '<div class="empty-portrait-list">No portraits yet. Use Add Portrait Image to create the first outfit portrait.</div>';
      } else {
        list.innerHTML = portraitSlots.map((p,i)=>{
          const isActive = p.id === activePortraitId;
          const thumb = p.src ? `<img src="${p.src}" alt="">` : '<span>No Image</span>';
          return `<button type="button" draggable="true" class="portrait-arrange-item${isActive ? ' is-active' : ''}" data-portrait-id="${escapeHtml(p.id)}" role="option" aria-selected="${isActive ? 'true' : 'false'}"><span class="portrait-thumb">${thumb}</span><span><span class="portrait-list-name">${escapeHtml(p.name || ('Portrait ' + (i+1)))}</span><span class="portrait-list-meta">Slot ${i+1}${p.src ? ' • image saved' : ' • blank slot'}</span></span>${isActive ? '<span class="portrait-active-badge">Shown</span>' : ''}</button>`;
        }).join('');
      }
    }
    const disabledMap = {
      portraitDeleteBtn: !active
    };
    Object.entries(disabledMap).forEach(([id, disabled])=>{ const btn = scopedGetById(id); if(btn) btn.disabled = !!disabled; });
    setPortrait(active ? active.src : '');
  }

  function addBlankPortrait(){
    const id = makePortraitId();
    portraitSlots.push({id, name:'Portrait ' + (portraitSlots.length + 1), src:''});
    activePortraitId = id;
    renderPortraitManager();
    updateCharacterReference();
    setStatus('Blank portrait slot added. Upload an image or rename it.');
  }
  function moveActivePortrait(direction){
    const index = portraitSlots.findIndex(p=>p.id === activePortraitId);
    if(index < 0) return;
    const nextIndex = index + direction;
    if(nextIndex < 0 || nextIndex >= portraitSlots.length) return;
    const [item] = portraitSlots.splice(index, 1);
    portraitSlots.splice(nextIndex, 0, item);
    renderPortraitManager();
    updateCharacterReference();
    setStatus('Portrait order updated.');
  }
  function setActivePortrait(id){
    activePortraitId = id || '';
    if(activePortraitId && !portraitSlots.some(p=>p.id === activePortraitId)) activePortraitId = '';
    renderPortraitManager();
    updateCharacterReference();
  }
  function loadPortraitData(data){
    const stored = data && data.portraits && Array.isArray(data.portraits.items) ? data.portraits.items : [];
    portraitSlots = stored.filter(p=>p).map((p,i)=>({id:p.id || makePortraitId(), name:p.name || ('Portrait ' + (i+1)), src:p.src || ''}));
    activePortraitId = data && data.portraits ? (data.portraits.active || '') : '';
    if(!portraitSlots.length && data && data.portrait){
      portraitSlots = [{id:'legacy-default', name:'Default', src:data.portrait}];
      activePortraitId = 'legacy-default';
    }
    if(activePortraitId && !portraitSlots.some(p=>p.id === activePortraitId)) activePortraitId = portraitSlots[0]?.id || '';
    renderPortraitManager();
    persistLoadedPortraitSources();
    hydratePortraitSourcesFromDb();
  }

  async function addOrReplacePortrait(src, name){
    name = String(name || '').trim();
    let targetId = activePortraitId;
    if(targetId){
      const existing = portraitSlots.find(p=>p.id === targetId);
      if(existing){ existing.src = src; if(name) existing.name = name; }
    } else {
      portraitSlots.push({id:makePortraitId(), name:name || ('Outfit ' + (portraitSlots.length + 1)), src});
      targetId = portraitSlots[portraitSlots.length - 1].id;
      activePortraitId = targetId;
    }
    renderPortraitManager();
    updateCharacterReference();
    try{
      await portraitDbPut(targetId, src);
      portraitLocalDelete(targetId);
      setPortraitStorageStatus('Portrait saved in browser image storage. Main autosave stays small and stable.');
    } catch(e){
      console.warn(e);
      if(portraitLocalPut(targetId, src)){
        setPortraitStorageStatus('Portrait saved using compact fallback storage. Main autosave stays small and stable.');
      } else {
        setPortraitStorageStatus('Portrait preview works, but browser image storage was unavailable. Export a backup.');
      }
    }
  }

  function renameActivePortrait(name){
    const active = getActivePortrait();
    if(!active) return;
    active.name = String(name || '').trim() || active.name || 'Portrait';
    renderPortraitManager();
  }
  function deleteActivePortrait(){
    if(!activePortraitId) return;
    const deleteId = activePortraitId;
    portraitSlots = portraitSlots.filter(p=>p.id !== activePortraitId);
    activePortraitId = portraitSlots[0]?.id || '';
    portraitDbDelete(deleteId).catch(e=>console.warn(e));
    portraitLocalDelete(deleteId);
    renderPortraitManager();
    updateCharacterReference();
  }

  function exportJson(){
    const data = collect({includeImages:true});
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const safeName = (data.fields.characterName || 'one-piece-character').replace(/[^a-z0-9-_]+/gi,'-').replace(/^-|-$/g,'') || 'one-piece-character';
    a.download = safeName + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus('Exported JSON backup.');
  }
  function importJson(file){
    const reader = new FileReader();
    reader.onload = () => {
      try{ const data = JSON.parse(reader.result); apply(data); saveNow(); setStatus('Imported JSON backup.'); }
      catch(e){ bridge.notify('That file could not be imported.'); }
    };
    reader.readAsText(file);
  }
  scopedAddEventListener('click', e=>{
    const portraitItem = e.target.closest('[data-portrait-id]');
    if(portraitItem && portraitItem.closest('#portraitList')){ setActivePortrait(portraitItem.dataset.portraitId); setStatus('Selected portrait is displayed on the Character tab.'); autosave(); return; }
    const add = e.target.closest('[data-add]');
    if(add){ addRow(add.dataset.add, []); autosave(); return; }
  });
  tabs.forEach(btn=>btn.addEventListener('click',()=>{ switchTab(btn.dataset.tab); autosave(); }));
  scopedAddEventListener('input', e=>{
    if(e.target.matches('[data-sync-target]')){ syncMainFromSticky(e.target); updateAllCalculations(); autosave(); return; }
    if(e.target.matches('input[name],select[name],textarea[name],[data-k]')){ updateAllCalculations(); syncStickyFromMain(); autosave(); }
  });
  scopedAddEventListener('change', e=>{
    if(e.target.matches('#removeMode')){ updateRemoveMode(); autosave(); return; }
    if(e.target.matches('.config-toggle')){ applySectionVisibility(getHiddenSections()); autosave(); return; }
    if(e.target.matches('.tracker-toggle')){ applyTrackerVisibility(getHiddenTrackers()); autosave(); return; }
    if(e.target.matches('[data-sync-target]')){ syncMainFromSticky(e.target); updateAllCalculations(); autosave(); return; }
    if(e.target.matches('input,select,textarea,[data-k]')){ updateAllCalculations(); syncStickyFromMain(); autosave(); }
  });
  scopedAddEventListener('blur', e=>{ if(e.target.matches('input,select,textarea,[data-k]')) saveNow(); }, true);
  scopedQuerySelectorAll('[data-sync-target]').forEach(el=>{ el.addEventListener('input',()=>{ syncMainFromSticky(el); updateAllCalculations(); autosave(); }); el.addEventListener('change',()=>{ syncMainFromSticky(el); updateAllCalculations(); autosave(); }); });
  /* beforeunload disabled — Foundry calls bridge.onClose() */
  scopedGetById('saveBtn').addEventListener('click', saveNow);
  scopedGetById('exportBtn').addEventListener('click', exportJson);
  scopedGetById('importBtn').addEventListener('click',()=>scopedGetById('jsonFile').click());
  scopedGetById('jsonFile').addEventListener('change', e=>{ if(e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; });
  scopedGetById('printBtn').addEventListener('click',()=>window.print());
  scopedGetById('clearBtn').addEventListener('click',()=>{
    if(confirm('Clear this form and local saved data?')){
      safeRemove();
      portraitDbClear();
      portraitLocalClear();
      scopedQuerySelectorAll('input[name],select[name],textarea[name]').forEach(el=>{ if(el.type==='checkbox') el.checked=false; else el.value=''; });
      Object.keys(dynamicLists).forEach(name=>{ const list=scopedQuerySelector(`[data-list="${name}"]`); if(list) list.innerHTML=''; });
      portraitSlots = []; activePortraitId = ''; renderPortraitManager(); initDynamicDefaults(); buildConfigPanel({}); buildTrackerConfigPanel({}); applySectionVisibility({}); applyTrackerVisibility({}); updateAllCalculations(); syncStickyFromMain(); saveNow(); setStatus('Form cleared.');
    }
  });
  scopedGetById('portraitInput').addEventListener('change', async e=>{
    const file = e.target.files[0];
    if(!file) return;
    setPortraitStorageStatus('Preparing portrait image...');
    try{
      const typedName = scopedGetById('portraitSlotName')?.value || file.name.replace(/\.[^.]+$/,'');
      const src = await preparePortraitImage(file);
      await addOrReplacePortrait(src, typedName);
      autosave();
    } catch(err){
      console.warn(err);
      bridge.notify('That portrait image could not be loaded. Try a different image file.');
      setPortraitStorageStatus('Portrait image was not changed.');
    } finally {
      e.target.value = '';
    }
  });
  scopedGetById('portraitSelect').addEventListener('change', e=>{ setActivePortrait(e.target.value); autosave(); });
  scopedGetById('portraitSlotName').addEventListener('input', e=>{ if(activePortraitId){ renameActivePortrait(e.target.value); autosave(); } });
  scopedGetById('portraitNewBtn')?.addEventListener('click', ()=>{ addBlankPortrait(); autosave(); });
  scopedGetById('portraitDeleteBtn')?.addEventListener('click', ()=>{ if(activePortraitId && confirm('Delete the selected portrait slot?')){ deleteActivePortrait(); autosave(); } });

  let portraitDragId = '';
  scopedAddEventListener('dragstart', e=>{
    const item = e.target.closest('.portrait-arrange-item[data-portrait-id]');
    if(!item || !item.closest('#portraitList')) return;
    portraitDragId = item.dataset.portraitId || '';
    item.classList.add('is-dragging');
    if(e.dataTransfer){
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', portraitDragId);
    }
  });
  scopedAddEventListener('dragover', e=>{
    const item = e.target.closest('.portrait-arrange-item[data-portrait-id]');
    if(!item || !item.closest('#portraitList') || !portraitDragId) return;
    e.preventDefault();
    item.classList.add('is-drag-over');
    if(e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  });
  scopedAddEventListener('dragleave', e=>{
    const item = e.target.closest('.portrait-arrange-item[data-portrait-id]');
    if(item) item.classList.remove('is-drag-over');
  });
  scopedAddEventListener('drop', e=>{
    const item = e.target.closest('.portrait-arrange-item[data-portrait-id]');
    if(!item || !item.closest('#portraitList') || !portraitDragId) return;
    e.preventDefault();
    const targetId = item.dataset.portraitId;
    item.classList.remove('is-drag-over');
    if(!targetId || targetId === portraitDragId) return;
    const from = portraitSlots.findIndex(p=>p.id === portraitDragId);
    const to = portraitSlots.findIndex(p=>p.id === targetId);
    if(from < 0 || to < 0) return;
    const [moved] = portraitSlots.splice(from, 1);
    portraitSlots.splice(to, 0, moved);
    renderPortraitManager();
    updateCharacterReference();
    setStatus('Portrait order updated.');
    autosave();
  });
  scopedAddEventListener('dragend', ()=>{
    portraitDragId = '';
    scopedQuerySelectorAll('.portrait-arrange-item.is-dragging,.portrait-arrange-item.is-drag-over').forEach(el=>el.classList.remove('is-dragging','is-drag-over'));
  });

  // One Piece inspired icon pass for section headers
  const headerIconMap = {
    'Character':'☠',
    'Current Trackers':'♥',
    'Combat':'⚔',
    'Abilities':'✦',
    'Skills':'✦',
    'Features':'✧',
    'Profile':'⚓',
    'Character Identity':'⚓',
    'Portrait':'🖼',
    'Training Notes':'✎',
    'Combat Basics':'⚔',
    'Resources':'◆',
    'Saving Throws':'🛡',
    'Unarmoured Defence Bonus':'🛡',
    'Haki':'◎',
    'Attacks & Techniques':'✹',
    'Damage Notes & Conditions':'✎',
    'Class Features':'★',
    'Species / Background Traits':'✧',
    'Languages':'🗺',
    'Feats':'✦',
    'Devil Fruit / Power Set':'◉',
    'Custom Techniques':'✹',
    'Equipment':'⚓',
    'Special Items':'✧',
    'Treasure & Supplies':'฿',
    'Ship, Crew Assets & Contacts':'☸',
    'Story & Notes':'✎',
    'Personality':'✦',
    'Backstory':'☰',
    'Session Notes':'✎',
    'Config: Row Removal':'⚙',
    'Config: Hide / Show Sections':'⚙',
    'Config: Hide / Show Current Trackers':'⚙'
  };
  scopedQuerySelectorAll('.section-header h2').forEach(h2=>{
    const txt = h2.textContent.trim();
    const icon = headerIconMap[txt];
    if(icon && !h2.dataset.iconized){
      h2.textContent = icon + ' ' + txt;
      h2.dataset.iconized = '1';
    }
  });

  skillRows();
  assignSectionKeys();
  buildConfigPanel({});
  buildTrackerConfigPanel({});
  load();
  updateAllCalculations();
  syncStickyFromMain();
  /* No initial save() in Foundry build — writing on boot causes a re-render
     loop that detaches our event listeners. We only save in response to
     user input. */
  /* hash-tab boot disabled in Foundry — each sheet picks its own active tab */
}

  // === End transformed IIFE ===

  OPFVTT.boot = function boot($root, bridge){
    // Provide scoped DOM helpers, then run the original (transformed) IIFE body.
    const scoped = makeScoped($root);
    // Expose helpers to the function via free variables — we use eval-free
    // injection by wrapping the call in a new function scope.
    return (function(){
      const scopedQuerySelectorAll = scoped.scopedQuerySelectorAll;
      const scopedQuerySelector    = scoped.scopedQuerySelector;
      const scopedGetById          = scoped.scopedGetById;
      const scopedAddEventListener = scoped.scopedAddEventListener;
      return _opfvttBoot($root, bridge, scoped);
    })();
  };
})();
