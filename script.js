document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register(`${window.BASE_URL}/service-worker.js`)
            .then(reg => console.log('Service Worker Registered', reg))
            .catch(err => console.error('Service Worker Registration Failed:', err));
    }

    let db = {};
    let allPokemons = [];
    const regionSelect = document.getElementById('region-select');
    const locationSelect = document.getElementById('location-select');
    const searchInput = document.getElementById('search-pokemon');
    const groupingSwitch = document.getElementById('grouping-switch');
    const contentDiv = document.getElementById('content');
    const langSelect = document.getElementById('lang-select');
    const translationFileNames = [
        'ability',
        'egg-group',
        'location',
        'move',
        'pokemon-species',
        'region'
    ];
    const translationBaseFolder = 'Poke-translator';
    const translationSets = {};
    let translationLoadToken = 0;
    let uniqueIdCounter = 0;
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = themeToggleBtn ? themeToggleBtn.querySelector('i') : null;


    /**
     * Carica un file JSON di traduzione per file logico e lingua.
     * Restituisce `null` se il file non esiste o in caso di errore di rete/parsing.
     *
     * @param {string} fileName Nome base del file (es. `ability`, `move`).
     * @param {string} lang Codice lingua (es. `it`, `es`, `fr`).
     * @returns {Promise<object|null>} JSON del file oppure `null`.
     */
    async function fetchTranslationJson(fileName, lang) {
        const fileUrl = `${window.BASE_URL}/translations/${translationBaseFolder}/translations/${lang}/${fileName}-${lang}.json`;
        try {
            const response = await fetch(fileUrl);
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    /**
     * Carica tutti i file di traduzione previsti per una lingua e costruisce
     * un Set per ogni categoria (`translationSets[fileName] = Set<string>`).
     *
     * Usa un token incrementale per evitare race condition: se parte un nuovo
     * caricamento lingua, i risultati del precedente vengono ignorati.
     *
     * @param {string} lang Codice lingua da caricare.
     * @returns {Promise<Record<string, Map<string,string>>>} Mappa categoria -> Map<inglese, traduzione>,
     *   più `translationSets['ui']` come `Map<string, string>` con le traduzioni UI
     *   caricate da `translations/Extra/extra-{lang}.json` (`add_translation.translations`).
     */
    async function loadTranslationSetsForLanguage(lang) {
        const normalizedLang = (lang || '').toLowerCase();

        // Se nessuna lingua è specificata oppure la lingua è inglese (en / en-*),
        // svuota i Set: l'inglese è già lingua base del dataset, quindi non serve
        // creare un set di traduzioni inglese->inglese.
        if (!normalizedLang || normalizedLang === 'en' || normalizedLang.startsWith('en-')) {
            Object.keys(translationSets).forEach(key => delete translationSets[key]);
            window.translationSets = translationSets;
            window.translationLanguage = normalizedLang || '';
            return translationSets;
        }

        const loadToken = ++translationLoadToken;
        // Incrementa il token di caricamento: se un nuovo caricamento parte prima di finire questo,
        // il token sarà diverso e i risultati vecchi verranno scartati (evità race condition).

        // Carica tutti i file JSON in parallelo per la lingua specificata, costruendo coppie [fileName, Map].
        // Ogni file è un oggetto piatto { "English": "Traduzione" }, quindi basta Object.entries.
        // Se un file non esiste, ritorna [fileName, null] (ignorato in seguito).
        const loadedEntries = await Promise.all(
            translationFileNames.map(async (fileName) => {
                const json = await fetchTranslationJson(fileName, lang);
                if (!json) return [fileName, null];

                const translationMap = new Map(Object.entries(json));
                return [fileName, translationMap];
            })
        );

        // Carica il file extra-{lang}.json per le traduzioni dell'interfaccia UI.
        // Estrae solo add_translation.translations (oggetto chiave->valore inglese->lingua)
        // e lo salva come Map<string, string> per una ricerca O(1) durante il render.
        const extraUrl = `${window.BASE_URL}/translations/Extra/extra-${normalizedLang}.json`;
        let uiTranslationsMap = null;
        try {
            const extraResponse = await fetch(extraUrl);
            if (extraResponse.ok) {
                const extraJson = await extraResponse.json();
                const uiDict = extraJson?.add_translation?.translations;
                if (uiDict && typeof uiDict === 'object' && !Array.isArray(uiDict)) {
                    uiTranslationsMap = new Map(Object.entries(uiDict));
                }
            }
        } catch (e) {
            // File extra assente o non parsabile: si procede senza traduzioni UI.
        }

        // Controlla che questo caricamento sia ancora il più recente:
        // se nel frattempo è partito un altro caricamento (token diverso), ignora i risultati e ritorna.
        // Questo previene il sovrascrivere Set freschi con dati vecchi.
        if (loadToken !== translationLoadToken) {
            return translationSets;
        }

        // Svuota i Set precedenti e ricrea la mappa con i nuovi dati caricati.
        Object.keys(translationSets).forEach(key => delete translationSets[key]);
        loadedEntries.forEach(([fileName, translationMap]) => {
            if (translationMap && translationMap.size > 0) {
                translationSets[fileName] = translationMap;
            }
        });

        // Aggiunge le traduzioni UI come Map separata sotto la chiave 'ui'.
        // Accessibile come: translationSets['ui'].get('Copy') => 'Copia'
        if (uiTranslationsMap && uiTranslationsMap.size > 0) {
            translationSets['ui'] = uiTranslationsMap;
        }

        // Espone i Set globalmente e registra la lingua attiva, poi ritorna.
        window.translationSets = translationSets;
        window.translationLanguage = lang;
        return translationSets;
    }

    /**
     * Traduce una stringa UI cercandola nella Map `translationSets['ui']`.
     * Se la chiave non è presente (lang inglese o traduzione mancante), restituisce
     * la stringa originale invariata (fallback inglese automatico).
     *
     * @param {string} key Stringa in inglese da tradurre.
     * @returns {string} Traduzione trovata, oppure `key` se non disponibile.
     */
    function t(key) {
        return translationSets['ui']?.get(key) ?? key;
    }

    /**
     * Aggiorna tutti gli elementi statici dell'HTML con le traduzioni UI correnti.
     * - `data-i18n`: imposta `textContent` dell'elemento con `t(chiave)`.
     * - `data-i18n-placeholder`: imposta `placeholder` dell'input con `t(chiave)`.
     * - `data-i18n-aria-label`: imposta `aria-label` con `t(chiave)`.
     * - `data-i18n-alt`: imposta `alt` con `t(chiave)`.
     *
     * Chiamare dopo ogni cambio lingua e al termine del caricamento iniziale.
     */
    function applyUiTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.dataset.i18n);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = t(el.dataset.i18nPlaceholder);
        });
        document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
            el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
        });
        document.querySelectorAll('[data-i18n-alt]').forEach(el => {
            el.setAttribute('alt', t(el.dataset.i18nAlt));
        });
    }

    /**
     * Applica il tema UI (`dark` o `light`), aggiorna l'icona toggle e,
     * opzionalmente, persiste la preferenza in localStorage.
     *
     * @param {'dark'|'light'} theme Tema da applicare.
     * @param {boolean} [save=false] Se true salva il tema in localStorage.
     */
    function applyTheme(theme, save = false) {
        if (theme !== 'dark' && theme !== 'light') return;
        document.documentElement.setAttribute('data-bs-theme', theme);
        if (themeIcon) {
            if (theme === 'dark') {
                themeIcon.classList.remove('bi-sun');
                themeIcon.classList.add('bi-moon');
            } else {
                themeIcon.classList.remove('bi-moon');
                themeIcon.classList.add('bi-sun');
            }
        }
        if (save) localStorage.setItem('theme', theme);
    }

    /**
     * Legge il tema salvato in localStorage.
     *
     * @returns {string|null} Tema salvato o `null` se assente/non accessibile.
     */
    function getStoredTheme() {
        try {
            return localStorage.getItem('theme');
        } catch (e) {
            return null;
        }
    }

    /**
     * Determina il tema preferito dal sistema operativo/browser.
     *
     * @returns {'dark'|'light'} Tema di sistema rilevato.
     */
    function getSystemTheme() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Apply initial theme: stored preference wins, otherwise system preference
    const stored = getStoredTheme();
    const initialTheme = stored ? stored : getSystemTheme();
    applyTheme(initialTheme, false);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-bs-theme') || getSystemTheme();
            const next = current === 'dark' ? 'light' : 'dark';
            applyTheme(next, true);
        });
    }

    /**
     * Legge la lingua salvata in localStorage.
     *
     * @returns {string|null} Codice lingua salvato o `null`.
     */
    function getStoredLanguage() {
        try {
            return localStorage.getItem('language');
        } catch (e) {
            return null;
        }
    }

    /**
     * Applica la lingua all'interfaccia impostando il `select` e l'attributo
     * `document.documentElement.lang`, con salvataggio opzionale.
     *
     * Se la lingua richiesta non è tra le opzioni disponibili, non applica nulla.
     *
     * @param {string} lang Codice lingua da applicare.
     * @param {boolean} [save=false] Se true salva la lingua in localStorage.
     */
    function applyLanguage(lang, save = false) {
        if (!langSelect) return;
        const isAvailable = Array.from(langSelect.options).some(option => option.value === lang);
        if (!isAvailable) return;

        langSelect.value = lang;
        document.documentElement.lang = lang;

        if (save) {
            try {
                localStorage.setItem('language', lang);
            } catch (e) {}
        }
    }

    // Lingua di fallback globale: se non c'è una preferenza salvata,
    // l'app parte sempre in inglese.
    const fallbackLanguage = 'en';

    // Recupera l'eventuale lingua salvata nel browser.
    const storedLanguage = getStoredLanguage();

    // Se esiste una lingua salvata, prova ad applicarla direttamente.
    if (storedLanguage) {
        applyLanguage(storedLanguage, false);
    } else {
        // Altrimenti forza il fallback a inglese.
        if (langSelect) {
            // Se il selettore contiene 'en', sincronizza sia select che document.lang.
            const hasEnglishOption = Array.from(langSelect.options).some(option => option.value === fallbackLanguage);
            if (hasEnglishOption) {
                applyLanguage(fallbackLanguage, false);
            } else {
                // Se 'en' non è tra le opzioni, imposta almeno la lingua del documento.
                document.documentElement.lang = fallbackLanguage;
            }
        } else {
            // Se il selettore lingua non esiste, imposta comunque il documento in inglese.
            document.documentElement.lang = fallbackLanguage;
        }
    }

    // Carica i Set di traduzioni per la lingua iniziale (stored, o fallback a langSelect.value)
    // Determina la lingua da usare: prima dalla proprità HTML lang (che è stata impostata da applyLanguage),
    // altrimenti dall'elemento select langSelect. Se entrambi assenti, stringa vuota (non carica nulla).
    // Viene eseguito in background; i Set saranno disponibili in window.translationSets una volta pronti.
    const initialLanguageForTranslations = document.documentElement.lang || fallbackLanguage;
    loadTranslationSetsForLanguage(initialLanguageForTranslations)
        .then(() => applyUiTranslations())
        .catch(err => console.error('Translation sets loading failed:', err));

    // Event listener sul cambio lingua: applica la nuova lingua UI e ricarica i Set di traduzioni,
    // poi re-renderizza l'interfaccia con i nuovi filtri/dati eventualmente localizzati.
    if (langSelect) {
        langSelect.addEventListener('change', async () => {
            applyLanguage(langSelect.value, true);
            try {
                await loadTranslationSetsForLanguage(langSelect.value);
                applyUiTranslations();
                render();
            } catch (err) {
                console.error('Translation sets loading failed:', err);
            }
        });
    }

    

    // Carico il database da data.json, lo appiattisco in allPokemons, popolo región/location selectors,
    // e renderizza la lista iniziale filtrata.
    fetch(`${window.BASE_URL}/data.json`)
        .then(response => response.json())
        .then(data => {
            db = data;
            allPokemons = flattenData(db);
            populateRegions();
            populateLocations('all'); // Populate locations on initial load
            render();
        })
        .catch(err => console.error("Error loading data.json:", err));

    /**
     * Converte la struttura annidata del database (regione -> location -> array)
     * in una lista piatta di Pokémon, aggiungendo `region` e `location` ad ogni entry.
     *
     * @param {object} data Oggetto completo caricato da `data.json`.
     * @returns {Array<object>} Lista piatta pronta per filtro/render.
     */
    function flattenData(data) {
        const flat = [];
        for (const region in data) {
            for (const location in data[region]) {
                data[region][location].forEach(pokemon => {
                    // The name is now at the top level of the pokemon object
                    if (pokemon.name && pokemon.data) {
                        flat.push({ ...pokemon, region, location });
                    }
                });
            }
        }
        return flat;
    }

    /**
     * Popola il selettore regioni con le chiavi presenti nel DB.
     */
    function populateRegions() {
        Object.keys(db).forEach(region => {
            const option = document.createElement('option');
            option.value = region;
            option.textContent = region;
            regionSelect.appendChild(option);
        });
    }

    /**
     * Popola il datalist delle location in base alla regione selezionata.
     *
     * - Se la regione è specifica: inserisce solo le location di quella regione.
     * - Se la regione è `all`: inserisce tutte le location formattate come `[X] nome`.
     *
     * @param {string} region Regione selezionata (`all` o nome regione).
     */
    function populateLocations(region) {
        const datalistOptions = document.getElementById('location-datalist-options');
        datalistOptions.innerHTML = '';

        if (region !== 'all') {
            const locations = Object.keys(db[region]);
            locations.forEach(loc => {
                const option = document.createElement('option');
                option.value = loc;
                datalistOptions.appendChild(option);
            });
        } else {
            const regionOrder = Array.from(regionSelect.options).map(option => option.value).filter(val => val !== 'all');
            const regionOrderMap = new Map(regionOrder.map((reg, index) => [reg, index]));

            const allLocationsWithRegion = [];
            for (const reg in db) {
                if (db.hasOwnProperty(reg)) {
                    for (const loc of Object.keys(db[reg])) { 
                        const regionLetter = reg.charAt(0).toUpperCase();
                        allLocationsWithRegion.push({
                            region: reg,
                            location: loc,
                            formatted: `[${regionLetter}] ${loc}`
                        });
                    }
                }
            }

            allLocationsWithRegion.forEach(item => {
                const option = document.createElement('option');
                option.value = item.formatted;
                datalistOptions.appendChild(option);
            });
        }
    }

    // Event listener su cambio regione: azzerato location filter, ricaricare location datalist, renderizza.
    regionSelect.addEventListener('change', () => {
        const region = regionSelect.value;
        locationSelect.value = ''; // Clear the location filter
        populateLocations(region);
        render();
    });

    // Supporto tastiera: Enter o Space su un link mappa clicka e apre il modale mappa.
    contentDiv.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            const el = e.target.closest && e.target.closest('.map-preview-link');
            if (el) {
                e.preventDefault();
                el.click();
            }
        }
    });

    // Event listener su input filtri: ricerca per nome, filtra per location e per raggruppamento,
    // che attivano render() per aggiornamento dinamico.
    locationSelect.addEventListener('input', render);
    searchInput.addEventListener('input', render);
    groupingSwitch.addEventListener('change', render);

    /**
     * Filtra i Pokémon in base ai controlli UI (search, regione, location) e
     * renderizza i risultati in accordion, raggruppando per nome o location.
     */
    function render() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedRegion = regionSelect.value;
        const selectedLocation = locationSelect.value;
        const groupByPokemon = groupingSwitch.checked;

        let filteredPokemons = allPokemons.filter(p => {
            const nameMatch = p.name.toLowerCase().includes(searchTerm);
            const regionMatch = selectedRegion === 'all' || p.region === selectedRegion;
            const locationMatch = selectedLocation === '' || 
                (selectedRegion === 'all' && 
                 `[${p.region.charAt(0).toUpperCase()}] ${p.location}`.toLowerCase().includes(selectedLocation.toLowerCase())) ||
                (selectedRegion !== 'all' && 
                 p.location.toLowerCase().includes(selectedLocation.toLowerCase()));
            return nameMatch && regionMatch && locationMatch;
        });

        contentDiv.innerHTML = '';

        if (filteredPokemons.length === 0) {
            contentDiv.innerHTML = `<p class="text-center text-muted mt-4">${t('No Pokémon found matching your criteria.')}</p>`;
            return;
        }

        if (groupByPokemon) {
            const groupedByName = filteredPokemons.reduce((acc, p) => {
                if (!acc[p.name]) acc[p.name] = [];
                acc[p.name].push(p);
                return acc;
            }, {});
            Object.keys(groupedByName).sort().forEach(name => {
                const group = groupedByName[name];
                const formattedName = `${t('Alpha')} ${name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()}`;
                const card = createGroupCard(formattedName, group);
                contentDiv.appendChild(card);
            });
        } else {
            const groupedByLocation = filteredPokemons.reduce((acc, p) => {
                const key = `${p.region} - ${p.location}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(p);
                return acc;
            }, {});
            Object.keys(groupedByLocation).forEach(location => {
                const group = groupedByLocation[location];
                const card = createGroupCard(location, group);
                contentDiv.appendChild(card);
            });
        }
    }

    /**
     * Crea un blocco accordion per un gruppo di Pokémon.
     *
     * @param {string} title Titolo gruppo (nome Pokémon o `regione - location`).
     * @param {Array<object>} pokemons Lista Pokémon appartenenti al gruppo.
     * @returns {HTMLDivElement} Nodo DOM dell'accordion item completo.
     */
    function createGroupCard(title, pokemons) {
        const accordionItem = document.createElement('div');
        accordionItem.className = 'accordion-item';
        // Ensure the ID is safe for both HTML and JavaScript selectors
        const uid = ++uniqueIdCounter;
        const safeTitle = title.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
        const uniqueId = `collapse-${safeTitle}-${uid}`;

        let column1Html = '';
        let column2Html = '';
        pokemons.forEach((p, index) => {
            if (index % 2 === 0) {
                column1Html += createPokemonDetail(p, groupingSwitch.checked);
            } else {
                column2Html += createPokemonDetail(p, groupingSwitch.checked);
            }
        });

        accordionItem.innerHTML = `
            <h2 class="accordion-header" id="header-${uniqueId}">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${uniqueId}">
                    ${title} (${pokemons.length})
                </button>
            </h2>
            <div id="${uniqueId}" class="accordion-collapse collapse"><!-- data-bs-parent="#content"  per chiudere gli accordion precedenti all'apertura di quello nuovo-->
                <div class="accordion-body">
                    <div class="row g-2">
                        <div class="col-md-6 m-0">
                            ${column1Html}
                        </div>
                        <div class="col-md-6 m-0">
                            ${column2Html}
                        </div>
                    </div>
                </div>
            </div>
        `;

        return accordionItem;
    }

    /**
     * Genera l'HTML della card dettaglio per un singolo Pokémon, includendo
     * posizione, stats principali, moveset e pulsante copia.
     *
     * @param {object} pokemon Entry Pokémon proveniente dalla lista piatta.
     * @param {boolean} isGroupedByName True se la vista è raggruppata per nome.
     * @returns {string} Markup HTML della card.
     */
    function createPokemonDetail(pokemon, isGroupedByName) {
        const uid = ++uniqueIdCounter; // Generate unique ID for each pokemon detail card
        const { data, location, region, name } = pokemon;
        
        // Format the Pokémon name
        const formattedName = `${t('Alpha')} ${name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()}`;

        const displayTitle = isGroupedByName ? `${region} - ${location}` : formattedName;
        
        // Build Location display string
        let locationParts = [data["Region"]];
        let specificLocationHtml = data["Specific Location"];
        if (data["Map Link"]) {
            specificLocationHtml = `<span class="map-preview-link" role="button" tabindex="0" data-map-link="${data["Map Link"]}">${data["Specific Location"]}</span>`;
        }
        locationParts.push(specificLocationHtml);
        if (data["Location Notes"]) {
            locationParts.push(data["Location Notes"]);
        }
        const locationHtml = `<p class="card-text"><strong>${t('Location')}:</strong> ${locationParts.join(' - ')}</p>`;

        const movesetForDisplay = Array.isArray(data.Moveset) 
            ? data.Moveset.map(m => `<li>${m}</li>`).join('')
            : `<li>${data.Moveset}</li>`;
        const notesForDisplay = data.Notes ? `<p class="card-text notes">${data.Notes}</p>` : '';
        const hmsForDisplay = Array.isArray(data.HMs) ? data.HMs.join(', ') : data.HMs;
        const eggGroupForDisplay = Array.isArray(data["Egg Group"]) ? data["Egg Group"].join(', ') : data["Egg Group"]; 

        return `
            <div class="mb-2">
                <div class="card">
                    <div class="accordion accordion-flush" id="pokemonAccordion-${uid}">
                        <div class="accordion-item">
                            <h2 class="accordion-header d-flex justify-content-between align-items-center bg-body-secondary" id="pokemonHeader-${uid}">
                                <button class="accordion-button collapsed p-2" type="button" data-bs-toggle="collapse" data-bs-target="#pokemonCollapse-${uid}" aria-expanded="false" aria-controls="pokemonCollapse-${uid}">
                                    <span class="card-title m-1">${displayTitle}</span>
                                </button>
                                <button class="btn btn-sm btn-outline-secondary copy-pokemon-btn mx-2" 
                                    data-pokemon-name="${formattedName}" 
                                    data-region="${data.Region || ''}"
                                    data-specific-location="${data["Specific Location"] || ''}"
                                    data-location-notes="${data["Location Notes"] || ''}"
                                    data-map-link="${data["Map Link"] || ''}"
                                    data-hms="${hmsForDisplay}" 
                                    data-egg-group="${eggGroupForDisplay}" 
                                    data-male-ratio="${data["Male Ratio"]}" 
                                    data-ability="${data.Ability}" 
                                    data-moveset="${data.Moveset.join('\n')}" 
                                    data-notes="${data.Notes || ''}">
                                    ${t('Copy')}
                                </button>
                            </h2>
                            <div id="pokemonCollapse-${uid}" class="accordion-collapse collapse" aria-labelledby="pokemonHeader-${uid}" data-bs-parent="#pokemonAccordion-${uid}">
                                <div class="accordion-body">
                                    <p class="card-text"><strong>${t('Name')}:</strong> ${formattedName}</p>
                                    ${locationHtml}
                                    <p class="card-text"><strong>${t('HMs')}:</strong> ${hmsForDisplay}</p>
                                    <p class="card-text"><strong>${t('Egg Group')}:</strong> <code>${eggGroupForDisplay}</code></p>
                                    <p class="card-text"><strong>${t('Male Ratio')}:</strong> <code>${data["Male Ratio"]}%</code></p>
                                    <p class="card-text"><strong>${t('Ability')}:</strong> <code>${data.Ability}</code></p>
                                    <p class="card-text"><strong>${t('Moveset')}:</strong></p>
                                    <ul>
                                        ${movesetForDisplay}
                                    </ul>
                                    ${notesForDisplay}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Gestore evento click per delegazione: gestisce click su link mappa (modal preview immagine)
    // e bottone copia (formatta Markdown con dati Pokémon e copia in clipboard).
    contentDiv.addEventListener('click', (e) => {
        const mapEl = e.target.closest && e.target.closest('.map-preview-link');
        if (mapEl) {
            const url = mapEl.dataset.mapLink;
            if (url) {
                const img = document.getElementById('mapModalImg');
                const spinner = document.getElementById('mapModalSpinner');
                const modalEl = document.getElementById('mapModal');
                const openBtn = document.getElementById('mapModalOpenBtn');

                // show modal first so spinner is visible
                if (modalEl && window.bootstrap) {
                    const modal = new bootstrap.Modal(modalEl);
                    modal.show();
                }

                if (spinner) spinner.classList.remove('d-none');
                if (openBtn) {
                    openBtn.href = '#';
                    openBtn.classList.add('d-none');
                }
                if (img) {
                    img.classList.add('d-none');
                    // remove previous handlers
                    img.onload = null;
                    img.onerror = null;
                    img.onload = () => {
                        if (spinner) spinner.classList.add('d-none');
                        img.classList.remove('d-none');
                        if (openBtn) {
                            openBtn.href = url;
                            openBtn.classList.remove('d-none');
                        }
                    };
                    img.onerror = () => {
                        if (spinner) spinner.classList.add('d-none');
                        img.classList.add('d-none');
                        if (openBtn) openBtn.classList.add('d-none');
                    };
                    img.src = url;
                }
            }
            return;
        }

        const copyBtnEl = e.target.closest && e.target.closest('.copy-pokemon-btn');
        if (copyBtnEl) {
            const btn = copyBtnEl;
            const { 
                pokemonName, region, specificLocation, locationNotes, mapLink, 
                hms, eggGroup, maleRatio, ability, moveset, notes 
            } = btn.dataset;

            let markdown = `**${pokemonName}**\n`;
            
            // Build location string for markdown
            let locationString = `_${region}_`;
            if (mapLink) {
                locationString += `\n_[${specificLocation}](${mapLink})_`;
            } else {
                locationString += ` - _${specificLocation}_`;
            }
            if (locationNotes) {
                locationString += ` - _${locationNotes}_`;
            }
            markdown += `${locationString}\n`;

            if (hms) markdown += `_${hms}_\n`;
            
            markdown += `\n\`${t('Egg Group')}: ${eggGroup}\`\n`;
            markdown += `\`${t('Male Ratio')}: ${maleRatio}%\`\n`;
            markdown += `\`${t('Ability')}: ${ability}\`\n\n`;
            
            markdown += `**${t('Moveset')}**\n`;
            const movesetLines = moveset.split('\n').filter(line => line.trim() !== '');
            movesetLines.forEach(line => {
                markdown += `- ${line.trim().replace(/^-/, '')}\n`;
            });

            if (notes) {
                markdown += '\n' + notes;
            }

            // Append a Discord relative timestamp for an event ~1h15m from now
            try {
                const nowMs = Date.now();
                const despawnMs = nowMs + (75 * 60 * 1000); // 75 minutes
                const despawnUnix = Math.floor(despawnMs / 1000);
                // Localized relative time for the parenthetical will be handled elsewhere if needed
                markdown += `\n## -=${t('Despawns approximately')} <t:${despawnUnix}:R>=-`;
            } catch (e) {
                console.error('Timestamp generation error:', e);
            }

            // Append message Footer
            markdown += `\n-# [Alpha List - copy and send the next one!](https://f-l-a.github.io/AlphaList/)`;

            navigator.clipboard.writeText(markdown).then(() => {
                const originalText = btn.textContent;
                btn.textContent = t('Copied!');
                btn.classList.remove('btn-outline-secondary');
                btn.classList.add('btn-success');

                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.classList.remove('btn-success');
                    btn.classList.add('btn-outline-secondary');
                }, 2000);
            }).catch(err => {
                console.error('Copy error:', err);
                alert(t('Automatic copy failed.'));
            });
        }
    });
});
