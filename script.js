document.addEventListener('DOMContentLoaded', () => {
    function isLocalDevelopmentHost(hostname) {
        if (!hostname) return false;

        if (['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
            return true;
        }

        // Private IPv4 ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
        const privateIpv4Pattern = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;
        if (privateIpv4Pattern.test(hostname)) {
            return true;
        }

        return false;
    }

    const isLocalHost = isLocalDevelopmentHost(window.location.hostname);

    if ('serviceWorker' in navigator) {
        if (isLocalHost) {
            navigator.serviceWorker.getRegistrations()
                .then(registrations => Promise.all(registrations.map(reg => reg.unregister())))
                .then(() => {
                    if ('caches' in window) {
                        return caches.keys().then(cacheNames => Promise.all(cacheNames.map(cacheName => caches.delete(cacheName))));
                    }
                })
                .then(() => console.log('Service Worker disabled and caches cleared for localhost'))
                .catch(err => console.error('Local Service Worker cleanup failed:', err));
        } else {
            navigator.serviceWorker.register(`${window.BASE_URL}/service-worker.js`)
                .then(reg => console.log('Service Worker Registered', reg))
                .catch(err => console.error('Service Worker Registration Failed:', err));
        }
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
        'locationPokeapi',
        'move',
        'pokemon-species',
        'region'
    ];
    const translationSets = {};
    const movePropertiesByMove = new Map();
    let translationLoadToken = 0;
    let uniqueIdCounter = 0;
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = themeToggleBtn ? themeToggleBtn.querySelector('i') : null;
    const toastAlert = document.getElementById('toastAlert');
    const toastAlertCountdownRing = toastAlert ? toastAlert.querySelector('.copy-countdown-ring') : null;
    const toastAlertCountdown = document.getElementById('toastAlertCountdown');
    const firstVisitToast = document.getElementById('firstVisitToast');
    const contributorsToast = document.getElementById('contributorsToast');
    const contributorsToastCloseBtn = document.getElementById('contributorsToastCloseBtn');
    const contributorsToastTriggers = Array.from(document.querySelectorAll('[data-action="open-contributors-toast"]'));
    const firstVisitSaveBtn = document.getElementById('firstVisitSaveBtn');
    const firstVisitBottomHint = document.getElementById('firstVisitBottomHint');
    const firstVisitThemeButtons = Array.from(document.querySelectorAll('[data-theme-choice]'));
    const firstVisitLanguageButtons = Array.from(document.querySelectorAll('[data-lang-choice]'));
    let toastAlertTimeoutId = null;
    let toastAlertCountdownIntervalId = null;

    const FIRST_VISIT_NOTICE_KEY = 'alphalist:first-visit-notice-seen:v1';
    const FIRST_VISIT_SAVE_LABEL_KEY = 'Save preferences';
    const FIRST_VISIT_HINT_KEY = 'You can change preferences at the bottom of the page!';
    const DONATION_IGN = 'FlaProGmr';
    let firstVisitSelectedTheme = null;
    let firstVisitSelectedLanguage = null;
    const firstVisitSaveLabelByLang = {
        en: FIRST_VISIT_SAVE_LABEL_KEY
    };
    const firstVisitHintByLang = {
        en: FIRST_VISIT_HINT_KEY
    };
    let firstVisitTextUpdateToken = 0;

    function normalizeUiLang(lang) {
        return String(lang || 'en').toLowerCase().split('-')[0] || 'en';
    }

    function applyFirstVisitQuickSetupTexts(label, hint) {
        if (firstVisitSaveBtn) firstVisitSaveBtn.textContent = label;
        if (firstVisitBottomHint) firstVisitBottomHint.textContent = hint;
    }

    async function updateFirstVisitQuickSetupTexts(lang) {
        if (!firstVisitSaveBtn && !firstVisitBottomHint) return;

        const normalizedLang = normalizeUiLang(lang);
        const updateToken = ++firstVisitTextUpdateToken;

        // If both are cached, update both at once.
        const cachedLabel = firstVisitSaveLabelByLang[normalizedLang];
        const cachedHint = firstVisitHintByLang[normalizedLang];
        if (cachedLabel && cachedHint) {
            applyFirstVisitQuickSetupTexts(cachedLabel, cachedHint);
            return;
        }

        try {
            const extraUrl = `${window.BASE_URL}/translations/Extra/extra-${normalizedLang}.json`;
            const response = await fetch(extraUrl);
            if (!response.ok) return;

            const extraJson = await response.json();
            const ui = extraJson?.add_translation?.translations?.ui;
            const label = ui?.[FIRST_VISIT_SAVE_LABEL_KEY];
            const hint = ui?.[FIRST_VISIT_HINT_KEY];

            const resolvedLabel = (typeof label === 'string' && label.trim() !== '')
                ? label
                : FIRST_VISIT_SAVE_LABEL_KEY;
            const resolvedHint = (typeof hint === 'string' && hint.trim() !== '')
                ? hint
                : FIRST_VISIT_HINT_KEY;

            firstVisitSaveLabelByLang[normalizedLang] = resolvedLabel;
            firstVisitHintByLang[normalizedLang] = resolvedHint;

            // Apply only if this is the latest request and language is still the same.
            if (updateToken !== firstVisitTextUpdateToken) return;
            if (normalizeUiLang(firstVisitSelectedLanguage) === normalizedLang) {
                applyFirstVisitQuickSetupTexts(resolvedLabel, resolvedHint);
            }
        } catch (e) {
            // Keep current text to avoid flicker.
        }
    }

    function setActiveChoice(buttons, value, dataAttr) {
        buttons.forEach(button => {
            if (button.dataset[dataAttr] === value) {
                button.classList.add('active');
                button.setAttribute('aria-pressed', 'true');
            } else {
                button.classList.remove('active');
                button.setAttribute('aria-pressed', 'false');
            }
        });
    }

    function applyDonationNameHighlight() {
        const donationElements = document.querySelectorAll('.donation-message');
        donationElements.forEach(el => {
            const fullText = el.textContent || '';
            const ignIndex = fullText.indexOf(DONATION_IGN);
            if (ignIndex === -1) {
                return;
            }

            const before = fullText.slice(0, ignIndex);
            const after = fullText.slice(ignIndex + DONATION_IGN.length);

            el.textContent = '';
            el.appendChild(document.createTextNode(before));

            const highlighted = document.createElement('span');
            highlighted.className = 'donation-name-highlight';
            highlighted.textContent = DONATION_IGN;
            el.appendChild(highlighted);

            el.appendChild(document.createTextNode(after));
        });
    }

    function initializeFirstVisitPreferenceSelections() {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'light';
        const currentLanguage = langSelect ? (langSelect.value || document.documentElement.lang || 'en') : (document.documentElement.lang || 'en');

        firstVisitSelectedTheme = currentTheme;
        firstVisitSelectedLanguage = currentLanguage;

        setActiveChoice(firstVisitThemeButtons, firstVisitSelectedTheme, 'themeChoice');
        setActiveChoice(firstVisitLanguageButtons, firstVisitSelectedLanguage, 'langChoice');
        updateFirstVisitQuickSetupTexts(firstVisitSelectedLanguage);
    }

    function showToastAlert() {
        if (!toastAlert) return;

        if (toastAlertCountdownIntervalId) {
            clearInterval(toastAlertCountdownIntervalId);
            toastAlertCountdownIntervalId = null;
        }

        let secondsLeft = 5;
        if (toastAlertCountdown) {
            toastAlertCountdown.textContent = String(secondsLeft);
        }
        if (toastAlertCountdownRing) {
            toastAlertCountdownRing.classList.remove('is-running');
            void toastAlertCountdownRing.offsetWidth;
            toastAlertCountdownRing.classList.add('is-running');
        }

        toastAlert.classList.add('is-visible');
        if (toastAlertTimeoutId) {
            clearTimeout(toastAlertTimeoutId);
        }

        toastAlertCountdownIntervalId = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft > 0) {
                if (toastAlertCountdown) {
                    toastAlertCountdown.textContent = String(secondsLeft);
                }
                return;
            }

            if (toastAlertCountdownIntervalId) {
                clearInterval(toastAlertCountdownIntervalId);
                toastAlertCountdownIntervalId = null;
            }
        }, 1000);

        toastAlertTimeoutId = setTimeout(() => {
            if (toastAlertCountdownIntervalId) {
                clearInterval(toastAlertCountdownIntervalId);
                toastAlertCountdownIntervalId = null;
            }
            toastAlert.classList.remove('is-visible');
            if (toastAlertCountdownRing) {
                toastAlertCountdownRing.classList.remove('is-running');
            }
            if (toastAlertCountdown) {
                toastAlertCountdown.textContent = '5';
            }
            toastAlertTimeoutId = null;
        }, 5000);
    }

    function hideContributorsToast() {
        if (!contributorsToast) return;

        contributorsToast.classList.remove('is-visible');
    }

    function showContributorsToast() {
        if (!contributorsToast) return;

        contributorsToast.classList.add('is-visible');
    }

    function hideFirstVisitToast() {
        if (!firstVisitToast) return;

        firstVisitToast.classList.remove('is-visible');
        firstVisitToast.style.width = '';
    }

    function lockFirstVisitToastWidth() {
        if (!firstVisitToast) return;

        // Measure current rendered width (content-based) and freeze it.
        firstVisitToast.style.width = '';
        const measuredWidth = firstVisitToast.offsetWidth;
        if (measuredWidth > 0) {
            firstVisitToast.style.width = `${measuredWidth}px`;
        }
    }

    function showFirstVisitToast() {
        if (!firstVisitToast) return;

        firstVisitToast.style.width = '';
        initializeFirstVisitPreferenceSelections();
        firstVisitToast.classList.add('is-visible');
        requestAnimationFrame(() => {
            lockFirstVisitToastWidth();
        });
    }

    function maybeShowFirstVisitToast() {
        let hasSeenNotice = false;
        try {
            hasSeenNotice = localStorage.getItem(FIRST_VISIT_NOTICE_KEY) === '1';
        } catch (e) {
            hasSeenNotice = false;
        }

        if (hasSeenNotice) return;

        showFirstVisitToast();
    }

    firstVisitThemeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const choice = button.dataset.themeChoice;
            if (!choice) return;
            firstVisitSelectedTheme = choice;
            setActiveChoice(firstVisitThemeButtons, choice, 'themeChoice');
            // Live preview: apply theme immediately, persistence remains on Save.
            applyTheme(choice, false);
        });
    });

    firstVisitLanguageButtons.forEach(button => {
        button.addEventListener('click', () => {
            const choice = button.dataset.langChoice;
            if (!choice) return;
            firstVisitSelectedLanguage = choice;
            setActiveChoice(firstVisitLanguageButtons, choice, 'langChoice');
            updateFirstVisitQuickSetupTexts(choice);
        });
    });

    if (firstVisitSaveBtn) {
        firstVisitSaveBtn.addEventListener('click', async () => {
            try {
                if (firstVisitSelectedTheme) {
                    applyTheme(firstVisitSelectedTheme, true);
                }

                if (firstVisitSelectedLanguage) {
                    applyLanguage(firstVisitSelectedLanguage, true);
                    await loadTranslationSetsForLanguage(firstVisitSelectedLanguage);
                    applyUiTranslations();
                    refreshFilterControls();
                    render();
                }

                try {
                    localStorage.setItem(FIRST_VISIT_NOTICE_KEY, '1');
                } catch (e) {}
            } catch (e) {
                console.error('Failed to save first-visit preferences:', e);
            } finally {
                hideFirstVisitToast();
            }
        });
    }

    contributorsToastTriggers.forEach(trigger => {
        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            showContributorsToast();
        });
    });

    if (contributorsToastCloseBtn) {
        contributorsToastCloseBtn.addEventListener('click', () => {
            hideContributorsToast();
        });
    }

    function setMoveProperties(movePropertiesData) {
        movePropertiesByMove.clear();
        if (!movePropertiesData || typeof movePropertiesData !== 'object' || Array.isArray(movePropertiesData)) {
            return;
        }

        Object.entries(movePropertiesData).forEach(([propertyLabel, moves]) => {
            if (!Array.isArray(moves)) return;

            moves.forEach(moveName => {
                if (typeof moveName !== 'string' || moveName.trim() === '') return;

                if (!movePropertiesByMove.has(moveName)) {
                    movePropertiesByMove.set(moveName, []);
                }

                const labels = movePropertiesByMove.get(moveName);
                if (!labels.includes(propertyLabel)) {
                    labels.push(propertyLabel);
                }
            });
        });
    }

    /**
     * Ritorna la descrizione delle proprietà di un move con le etichette tradotte.
     * @param {string} rawMoveName Nome originale del move da cercare nelle proprietà.
     * @param {string} translatedMoveName Nome del move già tradotto (se presente).
     * @returns {string} Stringa formattata con move e proprietà.
     */
    function formatMoveWithProperties(rawMoveName, translatedMoveName) {
        const moveLabel = translatedMoveName || rawMoveName || '';
        if (!rawMoveName) return moveLabel;

        const propertyLabels = movePropertiesByMove.get(rawMoveName);
        if (!propertyLabels || propertyLabels.length === 0) {
            return moveLabel;
        }

        const translatedPropertyLabels = propertyLabels.map(label => t(label, 'notes'));
        return `${moveLabel} - ${translatedPropertyLabels.join(', ')}`;
    }

    /**
     * Ritorna il testo leggibile basato su timestamp UNIX (secondi) rispetto ad `now`.
     * @param {number} unixTimestamp Timestamp UNIX in secondi.
     * @returns {string} Stringa relativa (es. "in 1 ora", "5 minuti fa").
     */
    function getRelativeTimeString(unixTimestamp) {
        const now = Date.now();
        const diffSeconds = Math.floor(unixTimestamp - now / 1000);
        const absDiff = Math.abs(diffSeconds);
        const lang = document.documentElement.lang || 'en';
        const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
        if (absDiff < 60) {
            return rtf.format(diffSeconds, 'second');
        } else if (absDiff < 3600) {
            return rtf.format(Math.round(diffSeconds / 60), 'minute');
        } else if (absDiff < 86400) {
            return rtf.format(Math.round(diffSeconds / 3600), 'hour');
        } else {
            return rtf.format(Math.round(diffSeconds / 86400), 'day');
        }
    }


    /**
     * Carica un file JSON di traduzione per file logico e lingua.
     * Restituisce `null` se il file non esiste o in caso di errore di rete/parsing.
     *
     * @param {string} fileName Nome base del file (es. `ability`, `move`).
     * @param {string} lang Codice lingua (es. `it`, `es`, `fr`).
     * @returns {Promise<object|null>} JSON del file oppure `null`.
     */
    async function fetchTranslationJson(fileName, lang) {
        const translationUrls = [
            `https://cdn.jsdelivr.net/gh/F-l-a/Poke-translator@main/translations/PokemmoClientDump/${lang}/${fileName}-${lang}.json`,
            `${window.BASE_URL}/translations/Poke-translator/translations/PokemmoClientDump/${lang}/${fileName}-${lang}.json`
        ];

        for (const fileUrl of translationUrls) {
            try {
                const response = await fetch(fileUrl);
                if (!response.ok) continue;
                return await response.json();
            } catch (e) {
                // Try the next fallback URL.
            }
        }

        return null;
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

        // Carica il file extra-{lang}.json per le traduzioni contestuali.
        // add_translation.translations deve contenere oggetti separati per contesto,
        // ad esempio: { ui: {...}, notes: {...} }.
        const extraUrl = `${window.BASE_URL}/translations/Extra/extra-${normalizedLang}.json`;
        let uiTranslationsMap = null;
        let notesTranslationsMap = null;
        if (window.preloadedUiTranslations && window.preloadedLanguage === normalizedLang) {
            uiTranslationsMap = new Map(Object.entries(window.preloadedUiTranslations));
        }

        // Se una parte (UI o notes) non è preloadata, prova a recuperarla dal file extra.
        if (!uiTranslationsMap || !notesTranslationsMap) {
            try {
                const extraResponse = await fetch(extraUrl);
                if (extraResponse.ok) {
                    const extraJson = await extraResponse.json();
                    const contexts = extraJson?.add_translation?.translations;
                    const uiDict = contexts?.ui;
                    const notesDict = contexts?.notes;

                    if (!uiTranslationsMap && uiDict && typeof uiDict === 'object' && !Array.isArray(uiDict)) {
                        uiTranslationsMap = new Map(Object.entries(uiDict));
                    }
                    if (!notesTranslationsMap && notesDict && typeof notesDict === 'object' && !Array.isArray(notesDict)) {
                        notesTranslationsMap = new Map(Object.entries(notesDict));
                    }
                }
            } catch (e) {
                // File extra assente o non parsabile: si procede senza traduzioni UI.
            }
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

        // Aggiunge le traduzioni contestuali da extra-it sotto le rispettive chiavi.
        if (uiTranslationsMap && uiTranslationsMap.size > 0) {
            translationSets['ui'] = uiTranslationsMap;
        }
        if (notesTranslationsMap && notesTranslationsMap.size > 0) {
            translationSets['notes'] = notesTranslationsMap;
        }

        // Espone i Set globalmente e registra la lingua attiva, poi ritorna.
        window.translationSets = translationSets;
        window.translationLanguage = lang;
        return translationSets;
    }

    /**
     * Traduce una chiave tramite una mappa specifica.
     *
     * Esempi:
     * - t('Copy') => usa la mappa UI di default
     * - t('Bulbasaur', 'pokemon-species') => usa la mappa specie Pokémon
     *
     * Se la mappa o la chiave non esistono, ritorna `key` invariata.
     *
     * @param {string} key Chiave inglese da tradurre.
     * @param {string} [mapName='ui'] Nome mappa traduzioni (es. `ui`, `move`, `ability`).
     * @returns {string} Traduzione trovata, oppure `key` se non disponibile.
     */
    function t(key, mapName = 'ui') {
        if (key === null || key === undefined) return '';

        const normalizedKey = String(key);
        return translationSets[mapName]?.get(normalizedKey) ?? normalizedKey;
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
     * Prova a risolvere il valore corrente del filtro location in chiavi raw
     * (`region`, `location`) usando la lingua attualmente attiva.
     *
     * Restituisce `null` se il valore non e' un match esatto (es. input parziale).
     *
     * @param {string} inputValue Valore corrente dell'input location.
     * @param {string} selectedRegion Regione selezionata (`all` o nome regione raw).
     * @returns {{region: string, location: string}|null}
     */
    function resolveExactLocationSelection(inputValue, selectedRegion) {
        const normalizedInput = (inputValue || '').trim().toLowerCase();
        if (!normalizedInput) return null;

        if (selectedRegion && selectedRegion !== 'all') {
            const regionLocations = db[selectedRegion] ? Object.keys(db[selectedRegion]) : [];
            for (const rawLocation of regionLocations) {
                const raw = rawLocation.toLowerCase();
                const translated = t(rawLocation, 'locationPokeapi').toLowerCase();
                if (normalizedInput === raw || normalizedInput === translated) {
                    return { region: selectedRegion, location: rawLocation };
                }
            }
            return null;
        }

        for (const rawRegion in db) {
            if (!Object.prototype.hasOwnProperty.call(db, rawRegion)) continue;

            for (const rawLocation of Object.keys(db[rawRegion])) {
                const translatedRegion = t(rawRegion, 'region');
                const translatedLocation = t(rawLocation, 'locationPokeapi');

                const formattedRaw = `[${rawRegion.charAt(0).toUpperCase()}] ${rawLocation}`.toLowerCase();
                const formattedTranslated = `[${translatedRegion.charAt(0).toUpperCase()}] ${translatedLocation}`.toLowerCase();

                if (normalizedInput === formattedRaw || normalizedInput === formattedTranslated) {
                    return { region: rawRegion, location: rawLocation };
                }
            }
        }

        return null;
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

    // Lingua iniziale usata al bootstrap dell'app.
    const initialLanguageForTranslations = document.documentElement.lang || fallbackLanguage;

    // Event listener sul cambio lingua: applica la nuova lingua UI e ricarica i Set di traduzioni,
    // poi re-renderizza l'interfaccia con i nuovi filtri/dati eventualmente localizzati.
    if (langSelect) {
        langSelect.addEventListener('change', async () => {
            const previousRegion = regionSelect.value || 'all';
            const previousLocationInput = locationSelect.value || '';
            const resolvedLocationSelection = resolveExactLocationSelection(previousLocationInput, previousRegion);

            applyLanguage(langSelect.value, true);
            try {
                await loadTranslationSetsForLanguage(langSelect.value);
                applyUiTranslations();
                applyDonationNameHighlight();
                refreshFilterControls();

                const deepLinkState = applyUrlParams();

                // Se il filtro location era un match esatto, ricompone il valore
                // nella nuova lingua (utile per prefissi tipo [U] -> [E]).
                if (!deepLinkState.hasParams && resolvedLocationSelection) {
                    if (previousRegion === 'all') {
                        const translatedRegion = t(resolvedLocationSelection.region, 'region');
                        const translatedLocation = t(resolvedLocationSelection.location, 'locationPokeapi');
                        const newPrefix = translatedRegion.charAt(0).toUpperCase();
                        locationSelect.value = `[${newPrefix}] ${translatedLocation}`;
                    } else {
                        locationSelect.value = t(resolvedLocationSelection.location, 'locationPokeapi');
                    }
                }

                render();
                if (deepLinkState.hasParams && deepLinkState.expandMode !== 'none') {
                    expandFirstResult(deepLinkState.expandMode);
                }
            } catch (err) {
                console.error('Translation sets loading failed:', err);
            }
        });
    }

    /**
     * Legge i parametri URL (`pokemon`, `region`, `location`) e pre-compila i filtri.
     *
     * Casi gestiti:
     * - `location` valida presente: vista per location e apertura accordion location.
     * - `location` valida + `pokemon`: apertura anche accordion pokemon interno.
     * - `pokemon` presente e `location` assente (con o senza `region`): forza group-by-pokemon e apre solo l'accordion pokemon.
     * - `region` senza `location`: nessuna apertura automatica.
     *
     * Nota: l'auto-apertura con `location` avviene solo se la location combacia
     * esattamente con una delle opzioni del datalist.
     *
     * @returns {{hasParams: boolean, expandMode: 'none'|'location'|'location-pokemon'|'pokemon'}}
     */
    function applyUrlParams() {
        function isExactValidLocationInput(value) {
            const normalized = (value || '').trim().toLowerCase();
            if (!normalized) return false;

            const datalistOptions = document.getElementById('location-datalist-options');
            if (!datalistOptions) return false;

            return Array.from(datalistOptions.options).some(option => {
                const optionValue = (option.value || '').trim().toLowerCase();
                return optionValue === normalized;
            });
        }

        const params = new URLSearchParams(window.location.search);
        const pokemon = params.get('pokemon');
        const region = params.get('region');
        const location = params.get('location');

        if (!pokemon && !region && !location) {
            return { hasParams: false, expandMode: 'none' };
        }

        let expandMode = 'none';

        if (region) {
            if (location) {
                // Keep region='all' so the datalist preserves the [K][J] prefix format.
                // Format the location with the same prefix used in populateLocations('all').
                const regionLetter = t(region, 'region').charAt(0).toUpperCase();
                const formattedLocation = `[${regionLetter}] ${t(location, 'locationPokeapi')}`;
                locationSelect.value = formattedLocation;

                // With location in URL we want location grouping and accordion auto-open.
                groupingSwitch.checked = false;
                const hasExactLocation = isExactValidLocationInput(formattedLocation);
                expandMode = hasExactLocation ? (pokemon ? 'location-pokemon' : 'location') : 'none';
            } else {
                // Only region in URL: switch to specific-region view
                const hasRegionOption = Array.from(regionSelect.options).some(o => o.value === region);
                if (hasRegionOption) {
                    regionSelect.value = region;
                    populateLocations(region);
                }

                // region without location: no auto-open
                expandMode = 'none';
            }
        } else if (location) {
            locationSelect.value = location;

            // location without region still follows location-view semantics
            groupingSwitch.checked = false;
            const hasExactLocation = isExactValidLocationInput(location);
            expandMode = hasExactLocation ? (pokemon ? 'location-pokemon' : 'location') : 'none';
        }

        if (pokemon) searchInput.value = pokemon;

        // pokemon without location (with or without region): use group-by-pokemon + open only pokemon accordion
        if (pokemon && !location) {
            groupingSwitch.checked = true;
            expandMode = 'pokemon';
        }

        return { hasParams: true, expandMode };
    }

    /**
     * Espande il primo risultato in base alla modalità:
     * - `location`: apre solo accordion esterno
     * - `location-pokemon`: apre esterno + primo interno
     * - `pokemon`: apre solo accordion esterno
     */
    function expandFirstResult(mode = 'pokemon') {
        if (mode === 'none') return;

        const outerItem = contentDiv.querySelector(':scope > .accordion-item');
        if (!outerItem) return;

        const outerCollapse = outerItem.querySelector(':scope > .accordion-collapse');
        if (outerCollapse) {
            outerCollapse.classList.add('show');
            const outerBtn = outerItem.querySelector(':scope > .accordion-header .accordion-button');
            if (outerBtn) outerBtn.classList.remove('collapsed');
        }

        if (mode === 'location-pokemon') {
            const innerCollapse = outerItem.querySelector('.accordion-body .accordion-collapse');
            if (innerCollapse) {
                innerCollapse.classList.add('show');
                const innerBtn = innerCollapse.closest('.accordion-item')?.querySelector('.accordion-button');
                if (innerBtn) innerBtn.classList.remove('collapsed');
            }
        }

        outerItem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Bootstrap iniziale: carica in parallelo traduzioni e dataset, poi renderizza.
    // In questo modo al refresh l'app parte già nella lingua salvata anche per i dati dinamici.
    async function initializeApp() {
        try {
            const [_, data, movePropertiesData] = await Promise.all([
                loadTranslationSetsForLanguage(initialLanguageForTranslations),
                fetch(`${window.BASE_URL}/data.json`).then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status} while loading data.json`);
                    }
                    return response.json();
                }),
                fetch(`${window.BASE_URL}/move-properties.json`)
                    .then(response => response.ok ? response.json() : null)
                    .catch(() => null)
            ]);

            db = data;
            allPokemons = flattenData(db);
            setMoveProperties(movePropertiesData);

            applyUiTranslations();
            applyDonationNameHighlight();
            refreshFilterControls();
            const deepLinkState = applyUrlParams();
            render();
            if (deepLinkState.hasParams && deepLinkState.expandMode !== 'none') {
                expandFirstResult(deepLinkState.expandMode);
            }
            maybeShowFirstVisitToast();
        } catch (err) {
            console.error('Initial app loading failed:', err);
        }
    }

    initializeApp();

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
        const allOption = regionSelect.querySelector('option[value="all"]');
        regionSelect.innerHTML = '';
        if (allOption) {
            regionSelect.appendChild(allOption);
        }

        Object.keys(db).forEach(region => {
            const option = document.createElement('option');
            option.value = region;
            option.textContent = t(region, 'region');
            regionSelect.appendChild(option);
        });
    }

    /**
     * Ricarica i controlli filtro (region/location) mantenendo, quando possibile,
     * il valore attualmente selezionato/inserito.
     */
    function refreshFilterControls() {
        const previousRegion = regionSelect.value || 'all';
        const previousLocation = locationSelect.value || '';

        populateRegions();

        const hasPreviousRegion = Array.from(regionSelect.options).some(option => option.value === previousRegion);
        regionSelect.value = hasPreviousRegion ? previousRegion : 'all';

        populateLocations(regionSelect.value);
        locationSelect.value = previousLocation;
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
                option.value = t(loc, 'locationPokeapi');
                datalistOptions.appendChild(option);
            });
        } else {
            const regionOrder = Array.from(regionSelect.options).map(option => option.value).filter(val => val !== 'all');
            const regionOrderMap = new Map(regionOrder.map((reg, index) => [reg, index]));

            const allLocationsWithRegion = [];
            for (const reg in db) {
                if (db.hasOwnProperty(reg)) {
                    for (const loc of Object.keys(db[reg])) { 
                        const translatedRegion = t(reg, 'region');
                        const translatedLocation = t(loc, 'locationPokeapi');
                        const regionLetter = translatedRegion.charAt(0).toUpperCase();
                        allLocationsWithRegion.push({
                            region: reg,
                            location: loc,
                            formatted: `[${regionLetter}] ${translatedLocation}`
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
        const selectedLocationLower = selectedLocation.toLowerCase();
        const groupByPokemon = groupingSwitch.checked;

        let filteredPokemons = allPokemons.filter(p => {
            const translatedName = t(p.name, 'pokemon-species').toLowerCase();
            const nameMatch = p.name.toLowerCase().includes(searchTerm) || translatedName.includes(searchTerm);
            const regionMatch = selectedRegion === 'all' || p.region === selectedRegion;
            const translatedLocation = t(p.location, 'locationPokeapi').toLowerCase();
            const translatedRegion = t(p.region, 'region');
            const formattedRawLocation = `[${p.region.charAt(0).toUpperCase()}] ${p.location}`.toLowerCase();
            const formattedTranslatedLocation = `[${translatedRegion.charAt(0).toUpperCase()}] ${translatedLocation}`.toLowerCase();
            const locationMatch = selectedLocation === '' || 
                (selectedRegion === 'all' && 
                 (formattedRawLocation.includes(selectedLocationLower) || formattedTranslatedLocation.includes(selectedLocationLower))) ||
                (selectedRegion !== 'all' && 
                 (p.location.toLowerCase().includes(selectedLocationLower) || translatedLocation.includes(selectedLocationLower)));
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
                const formattedName = `${t('Alpha')} ${t(name, 'pokemon-species')}`;
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
                const firstPokemon = group[0];
                const translatedLocationTitle = `${t(firstPokemon.region, 'region')} - ${t(firstPokemon.location, 'locationPokeapi')}`;
                const card = createGroupCard(translatedLocationTitle, group);
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
        const translatedLocationNotes = data["Location Notes"]
              ? t(data["Location Notes"], 'notes')
            : '';
        const baseNotesLines = Array.isArray(data.Notes) ? data.Notes : [];
        const translatedNotesLines = baseNotesLines
            .map(line => t(line, 'notes'))
            .filter(line => String(line).trim() !== '');
        const translatedNotes = translatedNotesLines.join('\n');
        
        const translatedSpeciesName = t(name, 'pokemon-species');
        const translatedRegion = t(region, 'region');
        const translatedLocation = t(location, 'locationPokeapi');
        const translatedDataRegion = t(data["Region"], 'region');
        const translatedSpecificLocation = t(data["Specific Location"], 'locationPokeapi');
        const translatedAbility = t(data.Ability, 'ability');
        const rawMoves = Array.isArray(data.Moveset)
            ? data.Moveset
            : (data.Moveset ? [data.Moveset] : []);
        const translatedMoves = rawMoves.map(move => t(move, 'move'));
        const movesWithProperties = rawMoves.map((move, index) => {
            const translatedMove = translatedMoves[index] || t(move, 'move');
            return formatMoveWithProperties(move, translatedMove);
        });
        const translatedHms = Array.isArray(data.HMs)
            ? data.HMs.map(hm => t(hm, 'move'))
            : (data.HMs ? [t(data.HMs, 'move')] : []);
        const translatedEggGroups = Array.isArray(data["Egg Group"])
            ? data["Egg Group"].map(group => t(group, 'egg-group'))
            : [t(data["Egg Group"], 'egg-group')];

        const formattedName = `${t('Alpha')} ${translatedSpeciesName}`;

        const displayTitle = isGroupedByName ? `${translatedRegion} - ${translatedLocation}` : formattedName;
        
        // Build Location display string
        let locationParts = [translatedDataRegion];
        let specificLocationHtml = translatedSpecificLocation;
        if (data["Map Link"]) {
            specificLocationHtml = `<span class="map-preview-link" role="button" tabindex="0" data-map-link="${data["Map Link"]}">${translatedSpecificLocation}</span>`;
        }
        locationParts.push(specificLocationHtml);
        if (translatedLocationNotes) {
            locationParts.push(translatedLocationNotes);
        }
        const locationHtml = `<p class="card-text"><strong>${t('Location')}:</strong> ${locationParts.join(' - ')}</p>`;

        const movesetForDisplay = movesWithProperties.map(m => `<li>${m}</li>`).join('');
        const notesForDisplay = translatedNotesLines.length > 0
            ? `<p class="card-text notes">${translatedNotesLines.join('<br>')}</p>`
            : '';
        const hmsForDisplay = translatedHms.length > 0 ? translatedHms.join(', ') : t('None');
        const eggGroupForDisplay = translatedEggGroups.join(', ');
        const translatedMovesetForCopy = movesWithProperties.join('\n');

        const maleRatioRaw = data["Male Ratio"];
        const maleRatioDisplay = (typeof maleRatioRaw === 'string' && maleRatioRaw !== '' && !isNaN(Number(maleRatioRaw)))
            ? `${maleRatioRaw}%`
            : maleRatioRaw;

        // Determina se mostrare il messaggio di despawn nella card
        let despawnHtml = '';
        const urlTimestamp = getUrlTimestampIfMatch(name, region, location);
        if (urlTimestamp) {
            despawnHtml = `<div class="alert alert-warning p-2 my-2 d-flex align-items-center justify-content-between">
                <div><strong>${t('Despawns approximately')}</strong> <span id="despawn-timestamp">${getRelativeTimeString(urlTimestamp)}</span></div>
                <div class="ms-2 d-flex gap-1">
                    <button type="button" class="btn btn-sm btn-outline-primary refresh-timestamp-btn" data-despawn-id="despawn-timestamp" title="${t('Refresh')}"><i class="bi bi-arrow-clockwise"></i></button>
                    <button type="button" class="btn btn-sm btn-outline-danger remove-timestamp-btn" title="${t('Remove timestamp')}"><i class="bi bi-x-lg"></i></button>
                </div>
            </div>`;
        }
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
                                    data-raw-name="${name}"
                                    data-raw-region="${region}"
                                    data-raw-location="${location}"
                                    data-region="${translatedDataRegion || ''}"
                                    data-specific-location="${translatedSpecificLocation || ''}"
                                    data-location-notes="${translatedLocationNotes || ''}"
                                    data-map-link="${data["Map Link"] || ''}"
                                    data-hms="${hmsForDisplay}" 
                                    data-egg-group="${eggGroupForDisplay}" 
                                    data-male-ratio="${maleRatioDisplay}"
                                    data-ability="${translatedAbility}" 
                                    data-moveset="${translatedMovesetForCopy}" 
                                    data-notes="${translatedNotes || ''}">
                                    ${t('Copy')}
                                </button>
                            </h2>
                            <div id="pokemonCollapse-${uid}" class="accordion-collapse collapse" aria-labelledby="pokemonHeader-${uid}" data-bs-parent="#pokemonAccordion-${uid}">
                                <div class="accordion-body">
                                    <p class="card-text"><strong>${t('Name')}:</strong> ${formattedName}</p>
                                    ${locationHtml}
                                    <p class="card-text"><strong>${t('HMs Required')}:</strong> ${hmsForDisplay}</p>
                                    <p class="card-text"><strong>${t('Egg Group')}:</strong> <code>${eggGroupForDisplay}</code></p>
                                    <p class="card-text"><strong>${t('Male Ratio')}:</strong> <code>${maleRatioDisplay}</code></p>
                                    <p class="card-text"><strong>${t('Ability')}:</strong> <code>${translatedAbility}</code></p>
                                    <p class="card-text"><strong>${t('Moveset')}:</strong></p>
                                    <ul>
                                        ${movesetForDisplay}
                                    </ul>
                                    ${notesForDisplay}
                                    ${despawnHtml}
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
    document.addEventListener('click', (e) => {
        const homeLink = document.getElementById('home-link');
        if (homeLink && (e.target === homeLink || homeLink.contains(e.target))) {
            e.preventDefault();
            const url = new URL(window.location.href);
            url.pathname = window.BASE_URL || '/';
            url.search = '';
            url.hash = '';
            window.location.href = url.toString();
            return;
        }
    });
    
    contentDiv.addEventListener('click', (e) => {
        // Pulsante refresh timestamp
        const refreshBtn = e.target.closest && e.target.closest('.refresh-timestamp-btn');
        if (refreshBtn) {
            e.preventDefault();
            const despawnId = refreshBtn.dataset.despawnId;
            if (despawnId) {
                const span = document.getElementById(despawnId);
                if (span) {
                    const ts = getUrlTimestampIfMatch(null, null, null, true);
                    if (ts) {
                        span.textContent = getRelativeTimeString(ts);
                    }
                }
            }
            return;
        }

        // Pulsante rimuovi timestamp
        const removeBtn = e.target.closest && e.target.closest('.remove-timestamp-btn');
        if (removeBtn) {
            e.preventDefault();
            const despawnDiv = removeBtn.closest('.alert.alert-warning');
            if (despawnDiv) {
                despawnDiv.classList.add('d-none');
            }
            const url = new URL(window.location.href);
            url.searchParams.delete('timestamp');
            window.history.replaceState({}, '', url);
            return;
        }
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
                pokemonName, rawName, rawRegion, rawLocation,
                region, specificLocation, locationNotes, mapLink, 
                hms, eggGroup, maleRatio, ability, moveset, notes 
            } = btn.dataset;

            const shareUrl = (() => {
                try {
                    const base = 'https://f-l-a.github.io/AlphaList/';
                    const p = new URLSearchParams();
                    if (rawName) p.set('pokemon', rawName);
                    if (rawRegion) p.set('region', rawRegion);
                    if (rawLocation) p.set('location', rawLocation);
                    let timestampToUse = getUrlTimestampIfMatch(rawName, rawRegion, rawLocation);
                    if (!timestampToUse) {
                        const nowMs = Date.now();
                        const despawnMs = nowMs + (75 * 60 * 1000); // 75 minuti
                        timestampToUse = Math.floor(despawnMs / 1000);
                    }
                    p.set('timestamp', timestampToUse);
                    return `${base}?${p.toString()}`;
                } catch (_) { return ''; }
            })();

            let markdown = shareUrl
                ? `**[${pokemonName}](${shareUrl})**\n`
                : `**${pokemonName}**\n`;
            
            // Build location string for markdown
            let locationString = `_${region}_`;
            if (mapLink) {
                locationString += ` - _[${specificLocation}](${mapLink})_`;
            } else {
                locationString += ` - _${specificLocation}_`;
            }
            if (locationNotes) {
                locationString += ` - _${locationNotes}_`;
            }
            markdown += `${locationString}\n`;

            if (hms) markdown += `${t('HMs Required')}: _${hms}_\n`;
            
            markdown += `\n\`${t('Egg Group')}: ${eggGroup}\`\n`;
            markdown += `\`${t('Male Ratio')}: ${maleRatio}\`\n`;
            markdown += `\`${t('Ability')}: ${ability}\`\n\n`;
            
            markdown += `**${t('Moveset')}**\n`;
            const movesetLines = moveset.split('\n').filter(line => line.trim() !== '');
            movesetLines.forEach(line => {
                markdown += `- ${line.trim().replace(/^-/, '')}\n`;
            });

            if (notes) {
                markdown += '\n' + notes;
            }

            // Append a Discord relative timestamp for an event ~1h15m from now. Uses the timestamp from the url if the parameters match
            let timestampToUse = getUrlTimestampIfMatch(rawName, rawRegion, rawLocation);
            if (!timestampToUse) {
                try {
                    const nowMs = Date.now();
                    const despawnMs = nowMs + (75 * 60 * 1000); // 75 minuti
                    timestampToUse = Math.floor(despawnMs / 1000);
                } catch (e) {
                    console.error('Timestamp generation error:', e);
                }
            }
            if (timestampToUse) {
                markdown += `\n## -=${t('Despawns approximately')} <t:${timestampToUse}:R>=-`;
            }

            // Append message Footer
            markdown += `\n-# [${t('Alpha List by FlaProGmr')} - ${t('copy and send the next one!')}](https://f-l-a.github.io/AlphaList/)`;

            navigator.clipboard.writeText(markdown).then(() => {
                showToastAlert();
                if (btn.__copyResetTimeoutId) {
                    clearTimeout(btn.__copyResetTimeoutId);
                    btn.__copyResetTimeoutId = null;
                }
                btn.textContent = t('Copied!');
                btn.classList.remove('btn-outline-secondary');
                btn.classList.add('btn-success');

                btn.__copyResetTimeoutId = setTimeout(() => {
                    btn.textContent = t('Copy');
                    btn.classList.remove('btn-success');
                    btn.classList.add('btn-outline-secondary');
                    btn.__copyResetTimeoutId = null;
                }, 2000);
            }).catch(err => {
                console.error('Copy error:', err);
                alert(t('Automatic copy failed.'));
            });
        }
    });
});

/**
 * Restituisce il timestamp dall'URL.
 *
 * Se override === true, restituisce il timestamp URL a prescindere dai parametri.
 * Altrimenti, restituisce il timestamp solo se i parametri corrispondono.
 *
 * @param {string|null} [rawName=null]
 * @param {string|null} [rawRegion=null]
 * @param {string|null} [rawLocation=null]
 * @param {boolean|null} [override=null]
 * @returns {number|null}
 */
function getUrlTimestampIfMatch(rawName = null, rawRegion = null, rawLocation = null, override = null) {
    try {
        const params = new URLSearchParams(window.location.search);
        const urlTimestamp = params.get('timestamp');
        if (!urlTimestamp) return null;
        const n = Number(urlTimestamp);
        if (isNaN(n)) return null;
        if (override === true) return n;

        const urlPokemon = params.get('pokemon');
        const urlRegion = params.get('region');
        const urlLocation = params.get('location');
        if (
            (rawName === null || (urlPokemon && urlPokemon === rawName)) &&
            (rawRegion === null || (urlRegion && urlRegion === rawRegion)) &&
            (rawLocation === null || (urlLocation && urlLocation === rawLocation))
        ) {
            return n;
        }
    } catch (e) {}
    return null;
}
