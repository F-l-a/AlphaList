import json
import os
import re

# Percorsi
BASE_PATH = os.path.dirname(os.path.abspath(__file__))
TRANSLATION_PATH = os.path.join(BASE_PATH, 'translations', 'Poke-translator', 'translations', 'PokemmoClientDump', 'it')
DATA_PATH = os.path.join(BASE_PATH, 'data.json')
LOG_PATH = os.path.join(BASE_PATH, 'validation_log.txt')


# File di riferimento
FILES = {
    'region': 'region-it.json',
    'locationPokeapi': 'locationPokeapi-it.json',
    'ability': 'ability-it.json',
    'move': 'move-it.json',
    'egg-group': 'egg-group-it.json',
    'pokemon-species': 'pokemon-species-it.json',
}

def ensure_special_properties_in_extra_notes():
    """
    Inserisce tutte le chiavi di special-properties.json in Extra.notes se mancanti, con valore uguale alla chiave.
    """
    import glob
    sp_path = os.path.join(BASE_PATH, 'special-properties.json')
    extra_dir = os.path.join(BASE_PATH, 'translations', 'Extra')
    if not os.path.exists(sp_path):
        return []
    with open(sp_path, encoding='utf-8') as f:
        sp = json.load(f)
    # Raccogli tutte le chiavi da moves e abilities
    special_keys = set()
    for prop in sp.get('moves', {}):
        special_keys.add(prop)
    for prop in sp.get('abilities', {}):
        special_keys.add(prop)
    # Per ogni extra-*.json, aggiungi le chiavi mancanti in notes
    files = glob.glob(os.path.join(extra_dir, 'extra-*.json'))
    added = []
    for f in files:
        with open(f, encoding='utf-8') as jf:
            data = json.load(jf)
        notes = data.get('add_translation', {}).get('translations', {}).get('notes', {})
        updated = False
        for k in special_keys:
            if k not in notes:
                notes[k] = k
                added.append((os.path.basename(f), k))
                updated = True
        if updated:
            data['add_translation']['translations']['notes'] = notes
            with open(f, 'w', encoding='utf-8') as jf:
                json.dump(data, jf, ensure_ascii=False, indent=2)
    return added

def validate_special_properties(extra_notes, ref_moves, ref_abilities, log_lines):
    """
    Controlla che tutte le proprietà e i valori di special-properties.json siano presenti nelle Extra.notes, Moves, Abilities.
    """
    import json
    sp_path = os.path.join(BASE_PATH, 'special-properties.json')
    if not os.path.exists(sp_path):
        log_lines.append("special-properties.json non trovato!")
        return
    with open(sp_path, encoding='utf-8') as f:
        sp = json.load(f)
    # Moves
    for prop, moves in sp.get('moves', {}).items():
        if prop not in extra_notes:
            log_lines.append(f"\t[SpecialProperties][moves] Proprietà '{prop}' non trovata in extra-it.json [notes]")
        for move in moves:
            if move not in ref_moves:
                log_lines.append(f"\t[SpecialProperties][moves] Mossa '{move}' non trovata in move-it.json")
    # Abilities
    for prop, abilities in sp.get('abilities', {}).items():
        if prop not in extra_notes:
            log_lines.append(f"\t[SpecialProperties][abilities] Proprietà '{prop}' non trovata in extra-it.json [notes]")
        for ability in abilities:
            if ability not in ref_abilities:
                log_lines.append(f"\t[SpecialProperties][abilities] Abilità '{ability}' non trovata in ability-it.json")

def sync_extra_keys():
    """
    Controlla che tutti i file extra-*.json abbiano le stesse chiavi sia in notes che in ui.
    Se manca una chiave, la aggiunge con valore uguale alla chiave stessa.
    """
    import glob
    extra_dir = os.path.join(BASE_PATH, 'translations', 'Extra')
    files = glob.glob(os.path.join(extra_dir, 'extra-*.json'))
    notes_dicts = {}
    ui_dicts = {}
    all_notes_keys = set()
    all_ui_keys = set()
    # Carica tutte le notes e ui
    for f in files:
        with open(f, encoding='utf-8') as jf:
            data = json.load(jf)
        # notes
        try:
            notes = data['add_translation']['translations']['notes']
        except Exception:
            notes = {}
        notes_dicts[f] = notes
        all_notes_keys.update(notes.keys())
        # ui
        try:
            ui = data['add_translation']['translations']['ui']
        except Exception:
            ui = {}
        ui_dicts[f] = ui
        all_ui_keys.update(ui.keys())
    # Sincronizza notes
    for f, notes in notes_dicts.items():
        updated = False
        added_keys = []
        for k in all_notes_keys:
            if k not in notes:
                notes[k] = k
                updated = True
                added_keys.append(k)
        if updated:
            with open(f, encoding='utf-8') as jf:
                data = json.load(jf)
            data['add_translation']['translations']['notes'] = notes
            with open(f, 'w', encoding='utf-8') as jf:
                json.dump(data, jf, ensure_ascii=False, indent=2)
            print(f"Aggiornato notes: {os.path.basename(f)}")
            with open(LOG_PATH, 'a', encoding='utf-8') as logf:
                logf.write(f"[SYNC] Aggiornato notes: {os.path.basename(f)}\n")
                for key in added_keys:
                    logf.write(f"[SYNC][notes][{os.path.basename(f)}] AGGIUNTA CHIAVE: {key}\n")
    # Sincronizza ui
    for f, ui in ui_dicts.items():
        updated = False
        added_keys = []
        for k in all_ui_keys:
            if k not in ui:
                ui[k] = k
                updated = True
                added_keys.append(k)
        if updated:
            with open(f, encoding='utf-8') as jf:
                data = json.load(jf)
            data['add_translation']['translations']['ui'] = ui
            with open(f, 'w', encoding='utf-8') as jf:
                json.dump(data, jf, ensure_ascii=False, indent=2)
            print(f"Aggiornato ui: {os.path.basename(f)}")
            with open(LOG_PATH, 'a', encoding='utf-8') as logf:
                logf.write(f"[SYNC] Aggiornato ui: {os.path.basename(f)}\n")
                for key in added_keys:
                    logf.write(f"[SYNC][ui][{os.path.basename(f)}] AGGIUNTA CHIAVE: {key}\n")

# Carica note extra
def load_extra_notes():
    extra_path = os.path.join(BASE_PATH, 'translations', 'Extra', 'extra-it.json')
    with open(extra_path, encoding='utf-8') as f:
        extra = json.load(f)
    notes = set()
    # Estraggo tutte le chiavi notes
    try:
        notes_dict = extra['add_translation']['translations']['notes']
        notes.update(notes_dict.keys())
    except Exception:
        pass
    return notes


# Eccezioni di traduzione per file specifici
EXTRA_TRANSLATION_EXCEPTIONS = {
    'extra-de.json': {
        'ui': {
            'Alpha': 'Alpha',
            'Name': 'Name',
        },
    },
    'extra-fr.json': {
        'ui': {
            'Alpha': 'Alpha',
        },
    }
}

# Eccezioni per la validazione della location
LOCATION_EXCEPTIONS = {
    "One Island": ["Mt. Ember", "Kindle Road", "Treasure Beach"],
    "Two Island": ["Cape Brink"],
    "Three Island": ["Three Isle Port", "Berry Forest", "Bond Bridge"],
    "Four Island": ["Icefall Cave"],
    "Five Island": ["Lost Cave", "Memorial Pillar", "Water Labyrinth", "Five Isle Meadow"],
    "Six Island": ["Pattern Bush", "Outcast Island", "Ruin Valley", "Water Path"],
    "Seven Island": ["Sevault Canyon", "Canyon Entrance"]
}

def check_extra_translations():
    """
    Controlla che tutte le chiavi in notes e ui dei file extra-*.json siano tradotte (valore diverso dalla chiave),
    a meno che la coppia sia tra le eccezioni definite per quel file.
    Logga errore se trova chiave == valore e non è in eccezione.
    """
    import glob
    extra_dir = os.path.join(BASE_PATH, 'translations', 'Extra')
    files = glob.glob(os.path.join(extra_dir, 'extra-*.json'))
    for f in files:
        basename = os.path.basename(f)
        exceptions = EXTRA_TRANSLATION_EXCEPTIONS.get(basename, {})
        notes_ex = exceptions.get('notes', {})
        ui_ex = exceptions.get('ui', {})
        with open(f, encoding='utf-8') as jf:
            data = json.load(jf)
        # notes
        try:
            notes = data['add_translation']['translations']['notes']
        except Exception:
            notes = {}
        for k, v in notes.items():
            if k == v and notes_ex.get(k) != v:
                with open(LOG_PATH, 'a', encoding='utf-8') as logf:
                    logf.write(f"[EXTRA][{basename}][notes] NON TRADOTTA: {k}\n")
        # ui
        try:
            ui = data['add_translation']['translations']['ui']
        except Exception:
            ui = {}
        for k, v in ui.items():
            if k == v and ui_ex.get(k) != v:
                with open(LOG_PATH, 'a', encoding='utf-8') as logf:
                    logf.write(f"[EXTRA][{basename}][ui] NON TRADOTTA: {k}\n")

def load_keys(filename):
    path = os.path.join(TRANSLATION_PATH, filename)
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    return set(data.keys())

def log_issue(logfile, context, key, value, where):
    if not hasattr(log_issue, "last_context") or log_issue.last_context != context:
        logfile.write("\n")
    # Escape newlines in value for log readability
    if isinstance(value, str):
        value = value.replace("\n", r"\n")
    logfile.write(f"[{context}] - [{key}] : '{value}' is not a valid {where}\n")
    log_issue.last_context = context

def validate():
    # Carica chiavi di riferimento
    ref = {k: load_keys(v) for k, v in FILES.items()}
    extra_notes = load_extra_notes()
    
    with open(DATA_PATH, encoding='utf-8') as f:
        data = json.load(f)
    
    with open(LOG_PATH, 'a', encoding='utf-8') as logfile:
        for region, locations in data.items():
            # Verifica la chiave di regione (es: "Kanto")
            if region not in ref['region']:
                log_issue(logfile, region, 'Region (root)', region, 'key in region-it.json')
            for location, pokes in locations.items():
                # Verifica la chiave di location (es: "One Island")
                if location not in ref['locationPokeapi']:
                    log_issue(logfile, f"{region}/{location}", 'Specific Location (root)', location, 'key in locationPokeapi-it.json')
                for poke in pokes:
                    name = poke.get('name')
                    # Verifica la chiave di specie (es: "Arcanine")
                    if name and name not in ref['pokemon-species']:
                        log_issue(logfile, f"{region}/{location}/{name}", 'name', name, 'key in pokemon-species-it.json')
                    d = poke.get('data', {})
                    # Region
                    reg = d.get('Region')
                    if not reg:
                        log_issue(logfile, f"{region}/{location}/{name}", 'Region', 'MISSING/EMPTY', 'value')
                    elif reg not in ref['region']:
                        log_issue(logfile, f"{region}/{location}/{name}", 'Region', reg, 'key in region-it.json')

                    # Specific Location
                    spec_loc = d.get('Specific Location')
                    if not spec_loc:
                        log_issue(logfile, f"{region}/{location}/{name}", 'Specific Location', 'MISSING/EMPTY', 'value')
                    elif spec_loc not in ref['locationPokeapi']:
                        log_issue(logfile, f"{region}/{location}/{name}", 'Specific Location', spec_loc, 'key in locationPokeapi-it.json')
                    
                    if spec_loc and spec_loc != location:
                        # Controlla se l'eccezione è valida
                        if location not in LOCATION_EXCEPTIONS or spec_loc not in LOCATION_EXCEPTIONS[location]:
                            log_issue(logfile, f"{region}/{location}/{name}", 'Specific Location', spec_loc, f'value in data.json: it doesn\'t match parent location key: {location}')

                    # Male Ratio
                    male_ratio = d.get('Male Ratio')
                    if male_ratio is None: # Can be 0
                        log_issue(logfile, f"{region}/{location}/{name}", 'Male Ratio', 'MISSING', 'value')

                    # Ability
                    ability = d.get('Ability')
                    if not ability:
                        log_issue(logfile, f"{region}/{location}/{name}", 'Ability', 'MISSING/EMPTY', 'value')
                    elif ability not in ref['ability']:
                        log_issue(logfile, f"{region}/{location}/{name}", 'Ability', ability, 'key in ability-it.json')
                    
                    # Moveset
                    moveset = d.get('Moveset')
                    if not moveset:
                        log_issue(logfile, f"{region}/{location}/{name}", 'Moveset', 'MISSING/EMPTY', 'value')
                    else:
                        for move in moveset:
                            if move and move not in ref['move']:
                                log_issue(logfile, f"{region}/{location}/{name}", 'Moveset', move, 'key in move-it.json')
                    
                    # HMs
                    hms = d.get('HMs', [])
                    for hm in hms:
                        if hm and hm not in ref['move']:
                            log_issue(logfile, f"{region}/{location}/{name}", 'HMs', hm, 'key in move-it.json')
                    
                    # Egg Group
                    egg_groups = d.get('Egg Group')
                    if not egg_groups:
                        log_issue(logfile, f"{region}/{location}/{name}", 'Egg Group', 'MISSING/EMPTY', 'value')
                    else:
                        for eg in egg_groups:
                            if eg and eg not in ref['egg-group']:
                                log_issue(logfile, f"{region}/{location}/{name}", 'Egg Group', eg, 'key in egg-group-it.json')
                    # Map Link
                    map_link = d.get('Map Link', '')
                    if map_link and not re.match(r'^https?://i\.imgur\.com/.+\.(jpg|jpeg|png|gif|webp)$', map_link):
                        log_issue(logfile, f"{region}/{location}/{name}", 'Map Link', map_link, 'value: use the i.imgur.com endpoint with a valid image extension')

                    # Location Notes
                    loc_note = d.get('Location Notes', '')
                    if loc_note and loc_note not in extra_notes:
                        log_issue(logfile, f"{region}/{location}/{name}", 'Location Notes', loc_note, 'key in extra-it.json [notes]')

                    # Notes
                    notes_list = d.get('Notes', [])
                    for note in notes_list:
                        if note and note not in extra_notes:
                            log_issue(logfile, f"{region}/{location}/{name}", 'Notes', note, 'key in extra-it.json [notes]')

def main():
    from datetime import datetime, timezone
    log_lines = []
    now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
    log_lines.append(f"Log generated at: {now}\n")


    # CLEANUP
    log_lines.append("****************")
    log_lines.append("> CLEANUP")
    if os.path.exists(LOG_PATH):
        os.remove(LOG_PATH)
        log_lines.append("\tFile Cleaned!")
    else:
        log_lines.append("\tFile was already clean!")

    # Inserisci chiavi special-properties in Extra.notes prima della sync
    log_lines.append("\n****************")
    log_lines.append("> SYNC Special Properties with Extra-it.json [notes]")
    added_special = ensure_special_properties_in_extra_notes()
    if not added_special:
        log_lines.append("\tall special properties keys already present in extra-it.json [notes]")
    else:
        for fname, key in added_special:
            log_lines.append(f"\t\t[SYNC][special-properties][{os.path.basename(fname)}] ADDED KEY: {key}")

    # SYNC Extra translations
    log_lines.append("\n****************")
    log_lines.append("> SYNC Extra translations")
    import glob
    extra_dir = os.path.join(BASE_PATH, 'translations', 'Extra')
    files = glob.glob(os.path.join(extra_dir, 'extra-*.json'))
    notes_sync_log = []
    ui_sync_log = []
    notes_synced = 0
    ui_synced = 0
    notes_out_of_sync = 0
    ui_out_of_sync = 0
    # Carica tutte le notes e ui
    notes_dicts = {}
    ui_dicts = {}
    all_notes_keys = set()
    all_ui_keys = set()
    for f in files:
        with open(f, encoding='utf-8') as jf:
            data = json.load(jf)
        # notes
        try:
            notes = data['add_translation']['translations']['notes']
        except Exception:
            notes = {}
        notes_dicts[f] = notes
        all_notes_keys.update(notes.keys())
        # ui
        try:
            ui = data['add_translation']['translations']['ui']
        except Exception:
            ui = {}
        ui_dicts[f] = ui
        all_ui_keys.update(ui.keys())
    # Sincronizza notes
    for f, notes in notes_dicts.items():
        updated = False
        added_keys = []
        for k in all_notes_keys:
            if k not in notes:
                notes[k] = k
                updated = True
                added_keys.append(k)
        if updated:
            with open(f, encoding='utf-8') as jf:
                data = json.load(jf)
            data['add_translation']['translations']['notes'] = notes
            with open(f, 'w', encoding='utf-8') as jf:
                json.dump(data, jf, ensure_ascii=False, indent=2)
            notes_synced += 1
            for key in added_keys:
                notes_sync_log.append(f"\t\t[SYNC][notes][{os.path.basename(f)}] AGGIUNTA CHIAVE: {key}")
        else:
            notes_out_of_sync += 1
    # Sincronizza ui
    for f, ui in ui_dicts.items():
        updated = False
        added_keys = []
        for k in all_ui_keys:
            if k not in ui:
                ui[k] = k
                updated = True
                added_keys.append(k)
        if updated:
            with open(f, encoding='utf-8') as jf:
                data = json.load(jf)
            data['add_translation']['translations']['ui'] = ui
            with open(f, 'w', encoding='utf-8') as jf:
                json.dump(data, jf, ensure_ascii=False, indent=2)
            ui_synced += 1
            for key in added_keys:
                ui_sync_log.append(f"\t\t[SYNC][ui][{os.path.basename(f)}] AGGIUNTA CHIAVE: {key}")
        else:
            ui_out_of_sync += 1
    total_notes = sum(len(notes) for notes in notes_dicts.values())
    total_ui = sum(len(ui) for ui in ui_dicts.values())
    log_lines.append(f"\tnotes: all synced! ({total_notes} total elements)" if notes_synced == 0 else f"\tnotes: found {notes_synced} elements out of sync ({total_notes} total elements)")
    if notes_sync_log:
        log_lines.extend(notes_sync_log)
    log_lines.append(f"\tui: all synced! ({total_ui} total elements)" if ui_synced == 0 else f"\tui: found {ui_synced} elements out of sync ({total_ui} total elements)")
    if ui_sync_log:
        log_lines.extend(ui_sync_log)

    # CHECK Extra translations
    log_lines.append("\n****************")
    log_lines.append("> CHECK Extra translations")
    notes_not_translated = []
    ui_not_translated = []
    import glob
    for f in files:
        basename = os.path.basename(f)
        exceptions = EXTRA_TRANSLATION_EXCEPTIONS.get(basename, {})
        notes_ex = exceptions.get('notes', {})
        ui_ex = exceptions.get('ui', {})
        with open(f, encoding='utf-8') as jf:
            data = json.load(jf)
        # notes
        try:
            notes = data['add_translation']['translations']['notes']
        except Exception:
            notes = {}
        for k, v in notes.items():
            if k == v and notes_ex.get(k) != v:
                notes_not_translated.append(f"\t\t[EXTRA][{basename}][notes] NON TRADOTTA: {k}")
        # ui
        try:
            ui = data['add_translation']['translations']['ui']
        except Exception:
            ui = {}
        for k, v in ui.items():
            if k == v and ui_ex.get(k) != v:
                ui_not_translated.append(f"\t\t[EXTRA][{basename}][ui] NON TRADOTTA: {k}")
    log_lines.append(
        f"\tnotes: all translated! ({total_notes} total elements)" if not notes_not_translated else f"\tnotes: found {len(notes_not_translated)} elements not translated ({total_notes} total elements)")
    if notes_not_translated:
        log_lines.extend(notes_not_translated)
    log_lines.append(
        f"\tui: all translated! ({total_ui} total elements)" if not ui_not_translated else f"\tui: found {len(ui_not_translated)} elements not translated ({total_ui} total elements)")
    if ui_not_translated:
        log_lines.extend(ui_not_translated)

    # CHECK data.json validity
    log_lines.append("\n****************")
    log_lines.append("> CHECK data.json validity")
    
    # Scrivi il log prima della validazione per non perdere i messaggi di sync
    with open(LOG_PATH, 'w', encoding='utf-8') as logfile:
        logfile.write("\n".join(log_lines) + "\n")
    
    # Esegui la validazione (che ora appende al log)
    validate()

    # Rileggi il log per il recap finale
    with open(LOG_PATH, 'r', encoding='utf-8') as logfile:
        final_log_content = logfile.read()
    
    data_log_errors = [line for line in final_log_content.split('\n') if any(keyword in line for keyword in ['is not a valid', 'MISSING', 'doesn\'t match'])]

    if not data_log_errors:
        log_lines.append("\tValid!")

    # Sezione separata per validazione special-properties.json
    log_lines.append("\n****************")
    log_lines.append("> CHECK special-properties.json validity")
    sp_log = []
    ref = {k: load_keys(v) for k, v in FILES.items()} # ricarica ref
    extra_notes = load_extra_notes() # ricarica extra_notes
    validate_special_properties(extra_notes, ref['move'], ref['ability'], sp_log)
    if not sp_log:
        log_lines.append("\tValid!")
    else:
        log_lines.extend(sp_log)

    # RECAP finale
    recap_count = len(notes_not_translated) + len(ui_not_translated) + len(data_log_errors) + len(sp_log)
    log_lines.append("\n****************")
    log_lines.append("> RECAP")
    log_lines.append(f"\t{recap_count} element{'s' if recap_count != 1 else ''} need{'s' if recap_count == 1 else ''} to be fixed!")

    # Scrivi il log finale completo
    with open(LOG_PATH, 'w', encoding='utf-8') as logfile:
        logfile.write("\n".join(log_lines) + "\n")
        if data_log_errors:
            logfile.write("\n> data.json validity ISSUES:\n")
            logfile.write("\n".join(data_log_errors) + "\n")
    
    print(f"Written validation log to {LOG_PATH}")

if __name__ == "__main__":
    main()
