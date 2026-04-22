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

    // PWA Install prompt handling
    let deferredPrompt = null;
    const installBtn = document.getElementById('install-app-btn');

    // Function to check if app is already installed
    function isAppAlreadyInstalled() {
        // Check display-mode: standalone
        if (window.matchMedia('(display-mode: standalone)').matches) {
            return true;
        }
        // Fallback for iOS
        if (window.navigator.standalone === true) {
            return true;
        }
        return false;
    }

    // Function to update button visibility
    function updateInstallButtonVisibility() {
        if (!installBtn) return;
        
        // Hide if app already installed
        if (isAppAlreadyInstalled()) {
            installBtn.style.display = 'none';
            return;
        }
        
        // Show only if we have a valid deferred prompt
        if (deferredPrompt) {
            installBtn.style.display = 'block';
        } else {
            installBtn.style.display = 'none';
        }
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        updateInstallButtonVisibility();
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            
            try {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                
                // Only clear deferredPrompt if user accepted (or if it was consumed)
                if (outcome === 'accepted') {
                    deferredPrompt = null;
                }
                // If 'dismissed', keep deferredPrompt for potential future attempts
                
                updateInstallButtonVisibility();
            } catch (error) {
                console.error('An error occurred during install prompt:', error);
                deferredPrompt = null;
                updateInstallButtonVisibility();
            }
        });
    }

    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        deferredPrompt = null;
        updateInstallButtonVisibility();
    });

    // Check on load if app is already installed
    updateInstallButtonVisibility();

    // Monitor for changes in display-mode (e.g., app installed in background)
    window.matchMedia('(display-mode: standalone)').addListener((e) => {
        console.log('Display mode changed:', e.matches ? 'standalone' : 'browser');
        updateInstallButtonVisibility();
    });

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
    let translationLoadToken = 0;
    let uniqueIdCounter = 0;
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = themeToggleBtn ? themeToggleBtn.querySelector('i') : null;
    const firstVisitToast = document.getElementById('firstVisitToast');
    const contributeLink = document.querySelector('.contribute-link');
    const latestAlphaInfoButton = document.getElementById('latestAlphaInfo-btn');
    const firstVisitSaveBtn = document.getElementById('firstVisitSaveBtn');
    const firstVisitBottomHint = document.getElementById('firstVisitBottomHint');
    const firstVisitNotificationHint = document.getElementById('firstVisitNotificationHint');
    const firstVisitThemeButtons = Array.from(document.querySelectorAll('[data-theme-choice]'));
    const firstVisitLanguageButtons = Array.from(document.querySelectorAll('[data-lang-choice]'));
    const notificationInfoAndSettings = document.getElementById('notifications-btn');
    const notificationInfoAndSettingsPopup = document.getElementById('notificationInfoAndSettingsPopup');
    const publishUrlInput = document.getElementById('publishUrlInput');
    const publishTopicInput = document.getElementById('publishTopicInput');
    const publishUsernameInput = document.getElementById('publishUsernameInput');
    const publishPasswordInput = document.getElementById('publishPasswordInput');
    const publishSettingsSaveBtn = document.getElementById('publishSettingsSaveBtn');
    const publishSettingsClearBtn = document.getElementById('publishSettingsClearBtn');
    const publishSettingsCloseBtn = document.getElementById('publishSettingsCloseBtn');

    // Variabili globali per tracciare lo stato dell'Alpha Latest
    let isAlphaActive = false;
    let currentWindow = -1;
    let alphaWindowTimestamp = -1; // Finestra temporale dello spawn dell'Alpha

    const useAfdSprites = (new Date().getMonth() === 3 && new Date().getDate() === 1) || Math.floor(Math.random() * 365) === 0;
    const useShinySprites = Math.floor(Math.random() * 30000) === 0;

    const FIRST_VISIT_NOTICE_KEY = 'alphalist:first-visit-notice-seen:v3.1';
    const PUBLISH_URL_KEY = 'alphalist:publish-url';
    const PUBLISH_TOPIC_KEY = 'alphalist:publish-topic';
    const PUBLISH_USERNAME_KEY = 'alphalist:publish-username';
    const PUBLISH_PASSWORD_KEY = 'alphalist:publish-password';
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



    /**
     * Crea e display un toast temporaneo con countdown.
     * 
     * @param {string} toastMessage Messaggio da mostrare nel toast
     * @param {number} toastDuration Durata in secondi prima che il toast scompaia (default: 5)
     * @returns {HTMLElement} Elemento del toast creato
     */
    function showCustomToast(toastMessage, toastDuration = 5) {
        // Crea il toast dal template HTML
        const toastHTML = `
            <div class="toastAlert initial-loader" aria-live="polite" aria-label="${toastMessage}" style="--toast-duration: ${toastDuration}s">
                <span class="toastAlert-countdown-ring" aria-hidden="true">
                    <svg class="toastAlert-countdown-ring-svg" viewBox="0 0 20 20" focusable="false">
                        <circle class="toastAlert-countdown-ring-track" cx="10" cy="10" r="8"></circle>
                        <circle class="toastAlert-countdown-ring-progress" cx="10" cy="10" r="8"></circle>
                    </svg>
                    <span class="toastAlert-countdown-number">${toastDuration}</span>
                </span>
                <span class="initial-loader-text">${toastMessage}</span>
            </div>
        `;

        // Crea elemento dal template
        const wrapper = document.createElement('div');
        wrapper.innerHTML = toastHTML;
        const toast = wrapper.firstElementChild;

        // Aggiunge al container o al body come fallback
        const toastContainer = document.getElementById('toastAlert-container') || document.body;
        toastContainer.appendChild(toast);

        // Trigger layout e aggiunge classe visible
        void toast.offsetWidth;
        toast.classList.add('is-visible');

        // Avvia il countdown ring
        const counterRing = toast.querySelector('.toastAlert-countdown-ring');
        const countdownNumber = toast.querySelector('.toastAlert-countdown-number');
        
        counterRing.classList.remove('is-running');
        void counterRing.offsetWidth;
        counterRing.classList.add('is-running');

        // Countdown del numero
        let secondsLeft = toastDuration;
        const countdownInterval = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft > 0) {
                countdownNumber.textContent = String(secondsLeft);
            } else {
                clearInterval(countdownInterval);
            }
        }, 1000);

        // Rimuove il toast dopo la durata
        setTimeout(() => {
            toast.classList.remove('is-visible');
            counterRing.classList.remove('is-running');
            
            // Rimuove dal DOM dopo eventuale animazione di fade-out
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }, toastDuration * 1000);

        return toast;
    }

    /**
     * Crea e mostra un popup persistente con header e body personalizzati.
     * 
     * @param {string} headerContent Contenuto HTML dell'header (tradotto con i18n)
     * @param {string} bodyContent Contenuto HTML del body
     * @param {Function} [onClose] Callback opzionale da eseguire quando il popup viene chiuso
     * @returns {HTMLElement} Elemento del popup creato
     */
    function showPersistentToastPopup(headerContent, bodyContent, onClose) {
        const popupHTML = `
            <div class="persistent-toast-popup">
                <div class="persistent-toast-popup-content">
                    <div class="persistent-toast-popup-header">
                        <strong>${headerContent}</strong>
                        <button type="button" class="btn-close btn-close-white" aria-label="Close" data-i18n-aria-label="Close"></button>
                    </div>
                    <section class="persistent-toast-popup-body">
                        ${bodyContent}
                    </section>
                </div>
            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = popupHTML;
        const popup = wrapper.firstElementChild;

        document.body.appendChild(popup);

        // Trigger layout e aggiunge classe visible
        void popup.offsetWidth;
        popup.classList.add('is-visible');

        // Applica le traduzioni i18n al contenuto del popup
        applyUiTranslations();

        // Event listener per il pulsante di chiusura
        const closeBtn = popup.querySelector('.persistent-toast-popup-header .btn-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                popup.classList.remove('is-visible');
                // Rimuove dal DOM dopo eventuale animazione di fade-out
                setTimeout(() => {
                    if (popup.parentElement) {
                        popup.remove();
                    }
                    // Chiama il callback opzionale
                    if (onClose) {
                        onClose();
                    }
                }, 300);
            });
        }

        return popup;
    }

    function toggleNotificationInfoAndSettingsPopup(action = null) {
        if (!notificationInfoAndSettingsPopup) return;
        
        const isVisible = notificationInfoAndSettingsPopup.classList.contains('is-visible');
        
        // Determina se nascondere: 'hide' -> nascondi, 'show' -> mostra, null -> toggle
        let shouldHide;
        if (action === 'hide') {
            shouldHide = true;
        } else if (action === 'show') {
            shouldHide = false;
        } else {
            // Toggle automatico
            shouldHide = isVisible;
        }
        
        if (shouldHide) {
            notificationInfoAndSettingsPopup.classList.remove('is-visible');
        } else {
            try {
                publishUrlInput.value = localStorage.getItem(PUBLISH_URL_KEY) || '';
                publishTopicInput.value = localStorage.getItem(PUBLISH_TOPIC_KEY) || '';
                publishUsernameInput.value = localStorage.getItem(PUBLISH_USERNAME_KEY) || '';
                publishPasswordInput.value = localStorage.getItem(PUBLISH_PASSWORD_KEY) || '';
            } catch (e) {}
            notificationInfoAndSettingsPopup.classList.add('is-visible');
        }
    }

    function showPublishConfirmPopup(pokemonName, payload, buttonEl) {
        const url = localStorage.getItem(PUBLISH_URL_KEY) || 'URL not configured';
        const topic = localStorage.getItem(PUBLISH_TOPIC_KEY) || 'Topic not configured';
        const message = `${t('Publish')} ${pokemonName}?\n${t('This will notify a lot of people that a new Alpha spawned!')}\n\n${t('URL')}: ${url}\n${t('Topic')}: ${topic}`;
        
        if (confirm(message)) {
            if (!payload) return;
            
            const { rawName, rawRegion, rawLocation } = payload;
            const publishMessage = generatePublishMessage(rawName, rawRegion, rawLocation);
            publishNotification(rawName, publishMessage, buttonEl);
        }
    }

    /**
     * Valida la configurazione di pubblicazione testando le credenziali
     * e verificando che il topic sia consentito.
     *
     * @param {string} url URL endpoint di validazione
     * @param {string} topic Topic da validare
     * @param {string} username Username per autenticazione
     * @param {string} password Password per autenticazione
     * @returns {Promise<boolean>} true se valido, false altrimenti
     */
    async function validPublishConfiguration(url, topic, username, password, skipToasts = false) {
        try {
            if(!url || !topic){
                console.warn('validPublishConfiguration: no URL or TOPIC configured.');
                return false;
            }

            // Se l'URL non contiene pokemmotools.org, non eseguire validazione
            let validationURL;
            if (url !== 'https://alpha.pokemmotools.org/publish') {
                console.log('Validation skipped for unofficial URL');
                if (!skipToasts) showCustomToast(t('Validation skipped for unofficial URL.\nAssuming valid configuration.'), 5);
                return true;
            } else {
                validationURL = 'https://alpha.pokemmotools.org/testConfig';
            }

            // Costruisci auth header solo se entrambi username e password sono presenti
            let authHeader = null;
            if (username && password) {
                authHeader = "Basic " + btoa(username + ":" + password);
            }

            const response = await fetch(validationURL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(authHeader && { "Authorization": authHeader }),
                },
                body: JSON.stringify({ topic: topic }),
            });

            if (response.ok) {
                // 200 — credentials valid and topic allowed
                if (!skipToasts) showCustomToast(t('Validation successful: credentials valid and topic allowed.'), 4);
                return true;
            } else {
                // 400 — bad credentials or topic not allowed
                try {
                    const err = await response.json();
                    console.error(err.detail);
                    if (!skipToasts) showCustomToast(t('Validation failed with error') + ': ' + err.detail, 4);
                } catch (parseErr) {
                    console.error(`Validation failed with status ${response.status}`);
                    if (!skipToasts) showCustomToast(t('Validation failed with status') + ` ${response.status}`, 4);
                }
                return false;
            }
        } catch (err) {
            console.error('Validation error:', err);
            return false;
        }
    }

    if (notificationInfoAndSettings) {
        notificationInfoAndSettings.addEventListener('click', () => toggleNotificationInfoAndSettingsPopup());
    }

    if (firstVisitNotificationHint) {
        firstVisitNotificationHint.addEventListener('click', () => toggleNotificationInfoAndSettingsPopup());
    }

    if (publishSettingsSaveBtn) {
        publishSettingsSaveBtn.addEventListener('click', async () => {
            const url = publishUrlInput.value.trim();
            const topic = publishTopicInput.value.trim();
            const username = publishUsernameInput.value.trim();
            const password = publishPasswordInput.value.trim();

            try {
                localStorage.setItem(PUBLISH_URL_KEY, url);
                localStorage.setItem(PUBLISH_TOPIC_KEY, topic);
                localStorage.setItem(PUBLISH_USERNAME_KEY, username);
                localStorage.setItem(PUBLISH_PASSWORD_KEY, password);
            } catch (e) {}
            toggleNotificationInfoAndSettingsPopup('hide');
            
            // Valida la configurazione
            if(await validPublishConfiguration(url, topic, username, password)){
                document.querySelectorAll('.publish-pokemon-btn').forEach(btn => {
                    btn.classList.remove('d-none');
                });
            }else{
                document.querySelectorAll('.publish-pokemon-btn').forEach(btn => {
                    btn.classList.add('d-none');
                });
            }

        });
    }

    if (publishSettingsClearBtn) {
        publishSettingsClearBtn.addEventListener('click', () => {
            publishUrlInput.value = '';
            publishUsernameInput.value = '';
            publishPasswordInput.value = '';
        });
    }

    if (publishSettingsCloseBtn) {
        publishSettingsCloseBtn.addEventListener('click', () => toggleNotificationInfoAndSettingsPopup('hide'));
    }



    function publishNotification(rawName, publishData, buttonEl) {
        let url, topic, username, password;
        try {
            url = localStorage.getItem(PUBLISH_URL_KEY) || '';
            topic = localStorage.getItem(PUBLISH_TOPIC_KEY) || '';
            username = localStorage.getItem(PUBLISH_USERNAME_KEY) || '';
            password = localStorage.getItem(PUBLISH_PASSWORD_KEY) || '';
        } catch (e) {}
        if (!url) {
            console.warn('publishNotification: no URL configured.');
            return;
        }
        const notificationTitle = publishData?.rawName || rawName;
        const notificationBody = publishData?.body || '';
        const headers = { 'Title': notificationTitle };
        if (publishData?.shareUrl) {
            headers['Actions'] = `view, Open in AlphaList, ${publishData.shareUrl}; view, Call made by ${username}, ${publishData.shareUrl}`;
        }
        if (username && password) {
            headers['Authorization'] = 'Basic ' + btoa(`${username}:${password}`);
        }
        const body = JSON.stringify({
            topic: topic,
            message: notificationBody,
            title: notificationTitle,
            actions: headers['Actions']
        })
        fetch(url, {
            method: 'POST',
            body: body,
            headers: {
                "Content-Type": "application/json",
                ...headers
            }
        }).then(response => {
            console.log('publishNotification response:', response)
            if (buttonEl) {
                if (buttonEl.__publishResetTimeoutId) {
                    clearTimeout(buttonEl.__publishResetTimeoutId);
                }
                if (response.ok) {
                    showCustomToast(t('Published in topic') + ' ' + topic, 5);
                    buttonEl.textContent = t('Published');
                    buttonEl.classList.remove('btn-secondary', 'btn-danger');
                    buttonEl.classList.add('btn-success');
                } else {
                    let customErrorMessage = null;
                    switch (response.status) {
                        case 401:
                        case 403:
                            customErrorMessage = "Missing/Invalid credentials!";
                            break;
                        case 409:
                            customErrorMessage = "Already called!";
                            break;
                        case 502:
                            customErrorMessage = "ntfy is unreachable!";
                            break;
                        case 503:
                            customErrorMessage = "Called outside of a spawn time window!";
                            break;
                        default:
                            customErrorMessage = response.statusText;
                            break;
                    }
                    showCustomToast(t('Error') +  ' ' + response.status + ': ' + customErrorMessage, 5);
                    buttonEl.textContent = `${t('Error')} ${response.status}`;
                    buttonEl.classList.remove('btn-secondary', 'btn-success');
                    buttonEl.classList.add('btn-danger');
                }
                buttonEl.__publishResetTimeoutId = setTimeout(() => {
                    buttonEl.textContent = t('Publish');
                    buttonEl.classList.remove('btn-success', 'btn-danger');
                    buttonEl.classList.add('btn-secondary');
                    buttonEl.__publishResetTimeoutId = null;
                }, 3000);
            }
        }).catch(err => {
            showCustomToast(t('Fetch Error') +  ' ' + err, 5);
            console.error('publishNotification failed:', err);
            if (buttonEl) {
                if (buttonEl.__publishResetTimeoutId) {
                    clearTimeout(buttonEl.__publishResetTimeoutId);
                }
                buttonEl.textContent = t('Fetch Error');
                buttonEl.classList.remove('btn-secondary', 'btn-success');
                buttonEl.classList.add('btn-danger');
                buttonEl.__publishResetTimeoutId = setTimeout(() => {
                    buttonEl.textContent = t('Publish');
                    buttonEl.classList.remove('btn-success', 'btn-danger');
                    buttonEl.classList.add('btn-secondary');
                    buttonEl.__publishResetTimeoutId = null;
                }, 3000);
            }
        });
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

    if (contributeLink) {
        const headerContent = `<span data-i18n="Contributors">Contributors</span>`;
        const bodyContent = `
            <ul class="persistent-toast-popup-list mb-2">
                <li><strong>Dusk</strong> - <span data-i18n="for the push notification system">for the push notification system</span></li>
                <li><strong>BlueQuilava</strong> - <span data-i18n="for help with ES translations">for help with ES translations</span></li>
                <li><strong>ShadoWine [TRØK]</strong> - <span data-i18n="for help with FR translations">for help with FR translations</span></li>
                <li><strong>ZzPSYCHOzZ</strong> - <a href="https://docs.google.com/spreadsheets/d/11MT793njqK8dSIFob-k_T1tCeoUQnGO8ELPDAGbOmAw/" target="_blank" rel="noopener" data-i18n="for the original dataset">for the original dataset</a></li>
            </ul>
            <div class="persistent-toast-popup-donations mb-1">
                <strong data-i18n="Donations leaderboard">Donations leaderboard</strong>
                <div data-i18n="no donations yet :(">no donations yet :(</div>
            </div>
            <div class="d-flex gap-1 align-items-center flex-wrap">
                <a href="https://github.com/F-l-a/AlphaList" target="_blank" rel="noopener" class="text-secondary persistent-toast-popup-github-link" data-i18n="Open GitHub">Open GitHub</a>
                <span class="text-secondary">•</span>
                <a href="https://alpha.pokemmotools.org/" target="_blank" rel="noopener" class="text-secondary persistent-toast-popup-github-link">Dusk's Alpha Website</a>
            </div>
        `;
        
        let openContributePopup = null;
        
        const showContributePopup = () => {
            if (openContributePopup) {
                const closeBtn = openContributePopup.querySelector('.persistent-toast-popup-header .btn-close');
                if (closeBtn) {
                    closeBtn.click();
                }
                openContributePopup = null;
            } else {
                openContributePopup = showPersistentToastPopup(headerContent, bodyContent, () => {
                    openContributePopup = null;
                });
            }
        };
        
        contributeLink.addEventListener('click', showContributePopup);
        contributeLink.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                showContributePopup();
            }
        });
    }

    /**
     * Determina il messaggio di stato per una finestra temporale specifica.
     * @param {number} windowIndex Indice della finestra (0-3)
     * @returns {string} Messaggio di stato: "Active", "Despawned", "Current", "Next", o vuoto
     */
    function getAlphaWindowStatusMessage(windowIndex) {
        // Verifica se è la finestra successiva a quella attuale
        const nextWindow = (currentWindow + 1) % 4;
        if (nextWindow === windowIndex) {
            return ' • Next';
        }
        
        // Se non è la finestra temporale attuale, non mostrare messaggio
        if (currentWindow !== windowIndex) {
            return '';
        }
        
        // È la finestra attuale
        if (isAlphaActive) {
            return ' • Active';
        } else {
            // Alpha è despawnato
            if (alphaWindowTimestamp === windowIndex) {
                return ' • Despawned';
            } else {
                return ' • Current';
            }
        }
    }

    if (latestAlphaInfoButton) {
        let openLatestAlphaInfoPopup = null;
        
        latestAlphaInfoButton.addEventListener('click', () => {
            if (openLatestAlphaInfoPopup) {
                const closeBtn = openLatestAlphaInfoPopup.querySelector('.persistent-toast-popup-header .btn-close');
                if (closeBtn) {
                    closeBtn.click();
                }
                openLatestAlphaInfoPopup = null;
            } else {
                // Calcola gli orari convertiti al timezone locale e normalizzati
                const timeRange1 = `${formatTime(convertUtcToLocalMinutes(HHMMtominutes("00:00")))} - ${formatTime(convertUtcToLocalMinutes(HHMMtominutes("04:45")))}`;
                const timeRange2 = `${formatTime(convertUtcToLocalMinutes(HHMMtominutes("06:00")))} - ${formatTime(convertUtcToLocalMinutes(HHMMtominutes("10:45")))}`;
                const timeRange3 = `${formatTime(convertUtcToLocalMinutes(HHMMtominutes("12:00")))} - ${formatTime(convertUtcToLocalMinutes(HHMMtominutes("16:45")))}`;
                const timeRange4 = `${formatTime(convertUtcToLocalMinutes(HHMMtominutes("18:00")))} - ${formatTime(convertUtcToLocalMinutes(HHMMtominutes("22:45")))}`;
                
                const bodyContent = `
                    <div class="mb-3 p-3 border rounded">
                        <p class="mb-0">Alphas are a special type of Pokémon that have their hidden abillity, a red outline, a bigger follower sprite and have 2×31 + 2×15 IVs minimum. An alpha spawns every in-game day (time span of 6 hours) and lasts for 75 minutes.</p>
                    </div>
                    
                    <div>
                        <h6 class="mb-3"><strong>Spawn Time Windows</strong></h6>
                        <div class="alpha-help-windows-grid">
                            <div class="alpha-help-window-card${currentWindow === 0 ? ' border border-primary' : ''}">
                                <div class="alpha-help-window-content">
                                    <div class="alpha-help-window-label">Day 1${getAlphaWindowStatusMessage(0)}</div>
                                    <div class="alpha-help-window-time">${timeRange1}</div>
                                </div>
                            </div>
                            <div class="alpha-help-window-card${currentWindow === 1 ? ' border border-primary' : ''}">
                                <div class="alpha-help-window-content">
                                    <div class="alpha-help-window-label">Day 2${getAlphaWindowStatusMessage(1)}</div>
                                    <div class="alpha-help-window-time">${timeRange2}</div>
                                </div>
                            </div>
                            <div class="alpha-help-window-card${currentWindow === 2 ? ' border border-primary' : ''}">
                                <div class="alpha-help-window-content">
                                    <div class="alpha-help-window-label">Day 3${getAlphaWindowStatusMessage(2)}</div>
                                    <div class="alpha-help-window-time">${timeRange3}</div>
                                </div>
                            </div>
                            <div class="alpha-help-window-card${currentWindow === 3 ? ' border border-primary' : ''}">
                                <div class="alpha-help-window-content">
                                    <div class="alpha-help-window-label">Day 4${getAlphaWindowStatusMessage(3)}</div>
                                    <div class="alpha-help-window-time">${timeRange4}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                openLatestAlphaInfoPopup = showPersistentToastPopup('Alpha Help', bodyContent, () => {
                    openLatestAlphaInfoPopup = null;
                });
            }
        });
    }

    // Mappe per proprietà di mosse e abilità
    const movePropertiesByMove = new Map();
    const abilityPropertiesByAbility = new Map();

    function setMoveProperties(movePropertiesData) {
        movePropertiesByMove.clear();
        abilityPropertiesByAbility.clear();
        if (!movePropertiesData || typeof movePropertiesData !== 'object' || Array.isArray(movePropertiesData)) {
            return;
        }

        // Sezione mosse: { moves: { "Prop": ["Move1", ...] } }
        if (movePropertiesData.moves && typeof movePropertiesData.moves === 'object') {
            Object.entries(movePropertiesData.moves).forEach(([propertyLabel, moves]) => {
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

        // Sezione abilità: { abilities: { "Prop": ["Ability1", ...] } }
        if (movePropertiesData.abilities && typeof movePropertiesData.abilities === 'object') {
            Object.entries(movePropertiesData.abilities).forEach(([propertyLabel, abilities]) => {
                if (!Array.isArray(abilities)) return;
                abilities.forEach(abilityName => {
                    if (typeof abilityName !== 'string' || abilityName.trim() === '') return;
                    if (!abilityPropertiesByAbility.has(abilityName)) {
                        abilityPropertiesByAbility.set(abilityName, []);
                    }
                    const labels = abilityPropertiesByAbility.get(abilityName);
                    if (!labels.includes(propertyLabel)) {
                        labels.push(propertyLabel);
                    }
                });
            });
        }
    }

    /**
     * Ritorna la descrizione delle proprietà di una mossa o abilità con le etichette tradotte.
     * @param {string} rawName Nome originale (move o ability) da cercare nelle proprietà.
     * @param {string} translatedName Nome già tradotto (se presente).
     * @param {"move"|"ability"} [type="move"] Tipo: "move" o "ability".
     * @returns {string} Stringa formattata con nome e proprietà.
     */
    function formatWithProperties(rawName, translatedName, type = "move") {
        const label = translatedName || rawName || '';
        if (!rawName) return label;

        let propertyLabels = null;
        if (type === "move") {
            propertyLabels = movePropertiesByMove.get(rawName);
        } else if (type === "ability") {
            propertyLabels = abilityPropertiesByAbility.get(rawName);
        }
        if (!propertyLabels || propertyLabels.length === 0) {
            return label;
        }
        const translatedPropertyLabels = propertyLabels.map(l => t(l, 'notes'));
        return `${label} - ${translatedPropertyLabels.join(', ')}`;
    }

    function formatMoveWithProperties(rawMoveName, translatedMoveName) {
        return formatWithProperties(rawMoveName, translatedMoveName, "move");
    }

    function formatAbilityWithProperties(rawAbilityName, translatedAbilityName) {
        return formatWithProperties(rawAbilityName, translatedAbilityName, "ability");
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
        // Case-insensitive match solo per locationPokeapi (non avendo una sorgente decente per la generazione della mappa, le mappe delle specifiche lingue hanno delle inconsistenze nel case delle chiavi)
        // posso rimuovere questo if quando la mappa è consistente tra le varie lingue
        if (mapName === 'locationPokeapi' && translationSets[mapName]) {
            if (translationSets[mapName].has(normalizedKey)) {
                return translationSets[mapName].get(normalizedKey);
            }
            // Cerca case-insensitive
            const lowerKey = normalizedKey.toLowerCase();
            for (const [k, v] of translationSets[mapName].entries()) {
                if (typeof k === 'string' && k.toLowerCase() === lowerKey) {
                    return v;
                }
            }
            return normalizedKey;
        }
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

    function handleAlphaNameClick() {
        const latestAlphaNameSpan = document.getElementById('latestAlphaName');
        const rawPokemon = latestAlphaNameSpan.getAttribute('data-raw-name');
        const rawRegion = latestAlphaNameSpan.getAttribute('data-raw-region');
        const rawLocation = latestAlphaNameSpan.getAttribute('data-raw-location');
        const timestamp = latestAlphaNameSpan.getAttribute('data-timestamp');

        if (!rawPokemon || !rawRegion || !rawLocation){
            showCustomToast("Incomplete data.");
            return;
        }

        // Crea URL con i parametri senza ricaricare la pagina
        const url = new URL(window.location);
        url.searchParams.set('pokemon', rawPokemon);
        url.searchParams.set('region', rawRegion);
        url.searchParams.set('location', rawLocation);
        url.searchParams.set('timestamp', timestamp);
        window.history.replaceState({}, '', url);

        // Esegui le stesse funzioni come se avessi caricato da quel link
        const deepLinkState = applyUrlParams();
        render();
        if (deepLinkState.hasParams && deepLinkState.expandMode !== 'none') {
            expandFirstResult(deepLinkState.expandMode);
        }
    }

    async function getLatestAlpha(){
        try{
            const response = await fetch('https://alpha.pokemmotools.org/latest');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();

            // Aggiorna variabili globali per lo stato dell'Alpha
            isAlphaActive = isTimestampStillValid(data.unix_timestamp);
            let isNewSpawnWindowActive = false;

            if (!isAlphaActive) {
                // Alpha è despawnato: controlla se le finestre temporali sono diverse
                const spawnTimestamp = data.unix_timestamp - (75 * 60); // Sottrai 75 minuti per ottenere lo spawn time
                const timestampDate = new Date(spawnTimestamp * 1000);
                alphaWindowTimestamp = getTimeWindow(timestampDate.getUTCHours(), timestampDate.getUTCMinutes());
                
                const nowDate = new Date();
                currentWindow = getTimeWindow(nowDate.getUTCHours(), nowDate.getUTCMinutes());

                isNewSpawnWindowActive = alphaWindowTimestamp !== currentWindow ? true : false;
            } else {
                // Se Alpha è attivo, aggiorna currentWindow
                const nowDate = new Date();
                currentWindow = getTimeWindow(nowDate.getUTCHours(), nowDate.getUTCMinutes());
            }

            const latestAlphaStatusIcon = document.getElementById('latestAlphaStatusIcon');
            if (latestAlphaStatusIcon) {
                latestAlphaStatusIcon.classList.toggle('d-none', !isAlphaActive);
                latestAlphaStatusIcon.classList.toggle('latest-alpha-status-icon--active', isAlphaActive);
            }

            const latestAlphaStatusSpan = document.getElementById('latestAlphaStatus');
            if (latestAlphaStatusSpan){
                if (isAlphaActive) {
                    latestAlphaStatusSpan.textContent = t("Currently active");
                    latestAlphaStatusSpan.setAttribute('data-i18n', "Currently active");
                } else {
                    if (isNewSpawnWindowActive) {
                        latestAlphaStatusSpan.textContent = t("Not spawned yet");
                        latestAlphaStatusSpan.setAttribute('data-i18n', "Not spawned yet");
                        const latestAlphaSeparatorSpan = document.getElementById('latestAlphaSeparator');
                        if (latestAlphaSeparatorSpan) {
                            latestAlphaSeparatorSpan.textContent = '. ';
                        }
                    } else {
                        latestAlphaStatusSpan.textContent = t("Last active");
                        latestAlphaStatusSpan.setAttribute('data-i18n', "Last active");
                    }
                }
            }
            
            const latestAlphaNameSpan = document.getElementById('latestAlphaName');
            if (latestAlphaNameSpan){
                if (isAlphaActive || !isNewSpawnWindowActive) {
                    if (data.rawPokemon && data.rawRegion && data.rawLocation) {
                        const translatedName = t(data.rawPokemon, 'pokemon-species');
                        latestAlphaNameSpan.textContent = translatedName;
                        latestAlphaNameSpan.classList.add('text-decoration-underline');
                        latestAlphaNameSpan.style.cursor = 'pointer';
                        latestAlphaNameSpan.addEventListener('click', handleAlphaNameClick);
                        latestAlphaNameSpan.setAttribute('data-raw-name', data.rawPokemon);
                        latestAlphaNameSpan.setAttribute('data-raw-region', data.rawRegion);
                        latestAlphaNameSpan.setAttribute('data-raw-location', data.rawLocation);
                        latestAlphaNameSpan.setAttribute('data-timestamp', data.unix_timestamp);
                    } else {
                        latestAlphaNameSpan.textContent = t("Malformed data");
                        latestAlphaNameSpan.setAttribute('data-i18n', "Malformed data");
                    }
                } else {
                    const nextWindowLabel = getWindowLabel(currentWindow);
                    if (nextWindowLabel) {
                        latestAlphaNameSpan.textContent = `${t("Current spawn window")}`;
                        latestAlphaNameSpan.setAttribute('data-i18n', "Current spawn window");
                        const latestAlphaOptionalSpan = document.getElementById('latestAlphaOptional');
                        if (latestAlphaOptionalSpan) {
                            latestAlphaOptionalSpan.textContent = `: ${nextWindowLabel}`;
                        }
                    } else {
                        latestAlphaNameSpan.textContent = "";
                    }
                }
                
            }

        } catch (err) {
            console.error('Failed to fetch latest alpha:', err);
            const latestAlphaStatusIcon = document.getElementById('latestAlphaStatusIcon');
            if (latestAlphaStatusIcon) {
                latestAlphaStatusIcon.classList.add('d-none');
                latestAlphaStatusIcon.classList.remove('latest-alpha-status-icon--active');
            }
            const latestAlphaNameSpan = document.getElementById('latestAlphaName');
            if (latestAlphaNameSpan) {
                latestAlphaNameSpan.textContent = t("Couldn't load");
            }
        }
    }

    // Bootstrap iniziale: carica in parallelo traduzioni e dataset, poi getLatestAlpha() in sequenza
    // (ha bisogno che le traduzioni siano già caricate), poi renderizza.
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
                fetch(`${window.BASE_URL}/special-properties.json`)
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

            getLatestAlpha();
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
        const locationSet = new Set();

        if (region !== 'all') {
            if (db[region]) {
                Object.keys(db[region]).forEach(loc => {
                    locationSet.add(t(loc, 'locationPokeapi'));
                    db[region][loc].forEach(pokemon => {
                        const specificLoc = pokemon.data["Specific Location"];
                        if (specificLoc && specificLoc !== loc) {
                            locationSet.add(t(specificLoc, 'locationPokeapi'));
                        }
                    });
                });
            }
            Array.from(locationSet).sort().forEach(locationName => {
                const option = document.createElement('option');
                option.value = locationName;
                datalistOptions.appendChild(option);
            });
        } else {
            const allLocationsWithRegion = [];
            for (const reg in db) {
                if (db.hasOwnProperty(reg)) {
                    const regionLocations = new Set();
                    for (const loc of Object.keys(db[reg])) {
                        regionLocations.add(loc);
                        db[reg][loc].forEach(pokemon => {
                            const specificLoc = pokemon.data["Specific Location"];
                            if (specificLoc && specificLoc !== loc) {
                                regionLocations.add(specificLoc);
                            }
                        });
                    }

                    const translatedRegion = t(reg, 'region');
                    const regionLetter = translatedRegion.charAt(0).toUpperCase();
                    regionLocations.forEach(loc => {
                        const translatedLocation = t(loc, 'locationPokeapi');
                        allLocationsWithRegion.push({
                            region: reg,
                            location: loc,
                            formatted: `[${regionLetter}] ${translatedLocation}`
                        });
                    });
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

    // Event listener sul reset del form: resetta tutti i filtri e ricarica i risultati
    const filtersForm = document.getElementById('filters-form');
    if (filtersForm) {
        filtersForm.addEventListener('reset', () => {
            // Resetta manualmente i valori degli input
            searchInput.value = '';
            regionSelect.value = 'all';
            locationSelect.value = '';
            groupingSwitch.checked = false;
            
            // Removes query parameters from URL
            window.history.replaceState({}, '', window.location.pathname);
            
            // Poi ricarica le locations e renderizza
            populateLocations('all');
            render();
        });
    }

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
            const specificLocation = p.data["Specific Location"] ? p.data["Specific Location"].toLowerCase() : '';
            const translatedSpecificLocation = p.data["Specific Location"] ? t(p.data["Specific Location"], 'locationPokeapi').toLowerCase() : '';
            const translatedRegion = t(p.region, 'region');
            const formattedRawLocation = `[${p.region.charAt(0).toUpperCase()}] ${p.location}`.toLowerCase();
            const formattedTranslatedLocation = `[${translatedRegion.charAt(0).toUpperCase()}] ${translatedLocation}`.toLowerCase();
            const formattedSpecificLocation = p.data["Specific Location"] ? `[${p.region.charAt(0).toUpperCase()}] ${p.data["Specific Location"]}`.toLowerCase() : '';
            const formattedTranslatedSpecificLocation = p.data["Specific Location"] ? `[${translatedRegion.charAt(0).toUpperCase()}] ${t(p.data["Specific Location"], 'locationPokeapi')}`.toLowerCase() : '';

            const locationMatch = selectedLocation === '' ||
                (selectedRegion === 'all' &&
                    (formattedRawLocation.includes(selectedLocationLower) ||
                        formattedTranslatedLocation.includes(selectedLocationLower) ||
                        (formattedSpecificLocation && formattedSpecificLocation.includes(selectedLocationLower)) ||
                        (formattedTranslatedSpecificLocation && formattedTranslatedSpecificLocation.includes(selectedLocationLower)))) ||
                (selectedRegion !== 'all' &&
                    (p.location.toLowerCase().includes(selectedLocationLower) ||
                        translatedLocation.includes(selectedLocationLower) ||
                        specificLocation.includes(selectedLocationLower) ||
                        translatedSpecificLocation.includes(selectedLocationLower)));
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
                <div class="accordion-body px-1 pb-1">
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
        const abilityWithProperties = formatAbilityWithProperties(data.Ability, translatedAbility);
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

        // Sprites - const imageurl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonID}.png`;
        const lowercaseName = name.toLowerCase();
        const gen5SpriteFolder = useShinySprites ? 'gen5ani-shiny' : 'gen5ani';
        const afdSpriteFolder = useAfdSprites ? 'afd-shiny' : 'afd';
        const imageurl = useAfdSprites
            ? `https://play.pokemonshowdown.com/sprites/${afdSpriteFolder}/${lowercaseName}.png`
            : `https://play.pokemonshowdown.com/sprites/${gen5SpriteFolder}/${lowercaseName}.gif`;
        
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

        // Show publish button only when URL + TOPIC publish settings are configured
        const hasPublishButton = ((localStorage.getItem(PUBLISH_URL_KEY) || '') !== '') && ((localStorage.getItem(PUBLISH_TOPIC_KEY) || '') !== '');
        const publishBtnHtml = `<button class="btn btn-sm btn-secondary publish-pokemon-btn  min-width-10ch${hasPublishButton ? '' : ' d-none'}"
                                        data-pokemon-name="${formattedName}"
                                        data-raw-name="${name}"
                                        data-raw-region="${region}"
                                        data-raw-location="${location}">
                                        ${t('Publish')}
                                    </button>`;
        const copyBtnClass = `btn btn-sm btn-secondary copy-pokemon-btn min-width-10ch`;

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
                                <div class="d-flex align-items-center gap-1 mx-2">
                                    ${publishBtnHtml}
                                    <button class="${copyBtnClass}"
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
                                        data-ability="${abilityWithProperties}" 
                                        data-moveset="${translatedMovesetForCopy}" 
                                        data-notes="${translatedNotes || ''}">
                                        ${t('Copy')}
                                    </button>
                                </div>
                            </h2>
                            <div id="pokemonCollapse-${uid}" class="accordion-collapse collapse" aria-labelledby="pokemonHeader-${uid}" data-bs-parent="#pokemonAccordion-${uid}">
                                <div class="accordion-body">
                                    <span class="pokemon-detail-sprite"><img src="${imageurl}"></span>
                                    <p class="card-text"><strong>${t('Name')}:</strong> ${formattedName}</p>
                                    ${locationHtml}
                                    <p class="card-text"><strong>${t('HMs Required')}:</strong> ${hmsForDisplay}</p>
                                    <p class="card-text"><strong>${t('Egg Group')}:</strong> <code>${eggGroupForDisplay}</code></p>
                                    <p class="card-text"><strong>${t('Male Ratio')}:</strong> <code>${maleRatioDisplay}</code></p>
                                    <p class="card-text"><strong>${t('Ability')}:</strong> <code>${abilityWithProperties}</code></p>
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

        const publishBtnEl = e.target.closest && e.target.closest('.publish-pokemon-btn');
        if (publishBtnEl) {
            const btn = publishBtnEl;
            const { 
                pokemonName, rawName, rawRegion, rawLocation
            } = btn.dataset;

            showPublishConfirmPopup(pokemonName, {
                rawName,
                rawRegion,
                rawLocation
            }, btn);
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

            let markdown = generateMarkdownForPokemon(rawName, rawRegion, rawLocation, pokemonName, region, mapLink, specificLocation, locationNotes, hms, t, eggGroup, maleRatio, formatAbilityWithProperties, ability, moveset, notes);
            
            // Append message Footer
            markdown += `\n-# [${t('Alpha List by FlaProGmr')} - ${t('copy and share the next! (With Notifications!)')}](https://f-l-a.github.io/AlphaList/)`;

            navigator.clipboard.writeText(markdown).then(() => {
                showCustomToast(t('Hi! Please consider a small donation to support my work. In-Game Name (IGN): FlaProGmr. Thank you!'), 5);
                if (btn.__copyResetTimeoutId) {
                    clearTimeout(btn.__copyResetTimeoutId);
                    btn.__copyResetTimeoutId = null;
                }
                btn.textContent = t('Copied!');
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-success');

                btn.__copyResetTimeoutId = setTimeout(() => {
                    btn.textContent = t('Copy');
                    btn.classList.remove('btn-success');
                    btn.classList.add('btn-secondary');
                    btn.__copyResetTimeoutId = null;
                }, 2000);
            }).catch(err => {
                console.error('Copy error:', err);
                showCustomToast(t('Automatic copy failed.'));
            });
        }
    });
});

function generateMarkdownForPokemon(rawName, rawRegion, rawLocation, pokemonName, region, mapLink, specificLocation, locationNotes, hms, t, eggGroup, maleRatio, formatAbilityWithProperties, ability, moveset, notes) {
    const shareUrl = buildShareUrl(rawName, rawRegion, rawLocation);

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
    markdown += `\`${t('Ability')}: ${formatAbilityWithProperties(ability, t(ability, 'ability'))}\`\n\n`;

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
        markdown += `\n## -= ${t('Despawns approximately')} <t:${timestampToUse}:R> =-`;
    }

    return markdown;
}

function generatePublishMessage(rawName, rawRegion, rawLocation) {
    const shareUrl = buildShareUrl(rawName, rawRegion, rawLocation);

    const locationForPublish = rawLocation || '';
    const body = [rawRegion || '', locationForPublish].filter(Boolean).join('\n');
    return {
        pokemonName: rawName || '',
        region: rawRegion || '',
        location: locationForPublish,
        shareUrl,
        body
    };
}

function getOrCreateTimestamp(rawName, rawRegion, rawLocation) {
    let timestampToUse = getUrlTimestampIfMatch(rawName, rawRegion, rawLocation);
    if (!timestampToUse) {
        const nowMs = Date.now();
        const despawnMs = nowMs + (75 * 60 * 1000);
        timestampToUse = Math.floor(despawnMs / 1000);
    }
    return timestampToUse;
}

function isTimestampStillValid(timestamp) {
    if(timestamp * 1000 < Date.now()) return false; //se timestamp è più piccolo di "Adesso", alpha è già despawnato ed è inutile
    return true;
}

// Struttura centralizzata delle finestre temporali (in UTC)
// Ogni finestra contiene: intervallo di controllo (6 ore) e tempi di spawn
const TIME_WINDOWS_CONFIG = [
    { start: 0, end: 5 * 60 + 59, spawnStart: 0, spawnEnd: 4 * 60 + 45 },           // 0:00-5:59 (finestra), 0:00-4:45 (spawn)
    { start: 6 * 60, end: 11 * 60 + 59, spawnStart: 6 * 60, spawnEnd: 10 * 60 + 45 }, // 6:00-11:59 (finestra), 6:00-10:45 (spawn)
    { start: 12 * 60, end: 17 * 60 + 59, spawnStart: 12 * 60, spawnEnd: 16 * 60 + 45 }, // 12:00-17:59 (finestra), 12:00-16:45 (spawn)
    { start: 18 * 60, end: 23 * 60 + 59, spawnStart: 18 * 60, spawnEnd: 22 * 60 + 45 }  // 18:00-23:59 (finestra), 18:00-22:45 (spawn)
];

/**
 * Converte minuti dall'inizio della giornata a formato HH:MM
 * @param {number} totalMinutes Minuti dall'inizio della giornata (0-1439)
 * @returns {string} Formato HH:MM
 */
function minutesToHHMM(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Converte una stringa di orario in formato HH:MM a minuti dall'inizio della giornata
 * @param {string} timeString Orario in formato HH:MM (es. "13:45")
 * @returns {number} Minuti dall'inizio della giornata (0-1439)
 */
function HHMMtominutes(timeString) {
    const [hours, mins] = timeString.split(':').map(Number);
    return hours * 60 + mins;
}

/**
 * Rileva se il browser preferisce il formato 12h o 24h dalla locale
 * @returns {boolean} true se 12h (AM/PM), false se 24h
 */
function isBrowser12HourFormat() {
    try {
        const formatter = new Intl.DateTimeFormat(navigator.language, { hour: 'numeric', minute: 'numeric' });
        const parts = formatter.formatToParts(new Date(2000, 0, 1, 13, 0, 0)); // 13:00 = 1 PM
        // Se contiene "PM" o "AM", è formato 12h
        return parts.some(part => part.type === 'dayPeriod');
    } catch (e) {
        return false; // Default a 24h se errore
    }
}

/**
 * Converte minuti a formato HH:MM o format 12h (es. 1:00 PM) a seconda della preferenza del browser
 * @param {number} totalMinutes Minuti dall'inizio della giornata (0-1439)
 * @param {boolean} [use12Hour] Se specificato, forza questo formato. Altrimenti usa la preferenza del browser
 * @returns {string} Orario formattato
 */
function formatTime(totalMinutes, use12Hour) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    // Determina il formato da usare
    const format12h = use12Hour !== undefined ? use12Hour : isBrowser12HourFormat();
    
    if (format12h) {
        const displayHours = hours % 12 === 0 ? 12 : hours % 12;
        const period = hours < 12 ? 'AM' : 'PM';
        return `${displayHours}:${String(mins).padStart(2, '0')} ${period}`;
    } else {
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
}

/**
 * Converte minuti UTC a minuti locali normalizzati al fuso orario del browser
 * @param {number} minutes Minuti UTC dall'inizio della giornata
 * @returns {number} Minuti localizzati e normalizzati a 24 ore (0-1439)
 */
function convertUtcToLocalMinutes(minutes) {
    const offset = -new Date().getTimezoneOffset();
    const adjusted = minutes + offset;
    return ((adjusted % 1440) + 1440) % 1440;
}

/**
 * Genera il label della finestra temporale in formato breve (es. "0:00-4:45" o "12:00 AM-4:45 AM")
 * @param {number} windowIndex Indice della finestra (0-3)
 * @param {number} [timezoneOffsetMinutes] Offset del fuso orario in minuti. Se non passato, rileva automaticamente dal browser
 * @returns {string} Label della finestra o stringa vuota se indice invalido
 */
function getWindowLabel(windowIndex, timezoneOffsetMinutes) {
    if (windowIndex < 0 || windowIndex >= TIME_WINDOWS_CONFIG.length) {
        return '';
    }
    
    // Se non è passato un offset, rileva automaticamente dal browser
    if (timezoneOffsetMinutes === undefined) {
        timezoneOffsetMinutes = -new Date().getTimezoneOffset();
    }
    
    const config = TIME_WINDOWS_CONFIG[windowIndex];
    let startMin = convertUtcToLocalMinutes(config.spawnStart);
    let endMin = convertUtcToLocalMinutes(config.spawnEnd);
    
    // Normalizzazione già inclusa in convertUtcToLocalMinutes
    return `${formatTime(startMin)} - ${formatTime(endMin)}`;
}

function getTimeWindow(hours, minutes) {
    const totalMinutes = hours * 60 + minutes;
    
    for (let i = 0; i < TIME_WINDOWS_CONFIG.length; i++) {
        const window = TIME_WINDOWS_CONFIG[i];
        if (totalMinutes >= window.start && totalMinutes <= window.end) {
            return i;
        }
    }
    return -1; // Non in una finestra (impossibile)
}

function buildShareUrl(rawName, rawRegion, rawLocation) {
    try {
        const base = 'https://f-l-a.github.io/AlphaList/';
        const p = new URLSearchParams();
        if (rawName) p.set('pokemon', rawName);
        if (rawRegion) p.set('region', rawRegion);
        if (rawLocation) p.set('location', rawLocation);
        p.set('timestamp', getOrCreateTimestamp(rawName, rawRegion, rawLocation));
        return `${base}?${p.toString()}`;
    } catch (_) {
        return '';
    }
}

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

        if(!isTimestampStillValid(n)) return null;

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
