document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
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
    let uniqueIdCounter = 0;
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = themeToggleBtn ? themeToggleBtn.querySelector('i') : null;

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

    function getStoredTheme() {
        try {
            return localStorage.getItem('theme');
        } catch (e) {
            return null;
        }
    }

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

    fetch('data.json?v=' + Date.now())
        .then(response => response.json())
        .then(data => {
            db = data;
            allPokemons = flattenData(db);
            populateRegions();
            populateLocations('all'); // Populate locations on initial load
            render();
        })
        .catch(err => console.error("Error loading data.json:", err));

    function flattenData(data) {
        const flat = [];
        for (const region in data) {
            for (const location in data[region]) {
                data[region][location].forEach(pokemon => {
                    if (pokemon.data && pokemon.data.Name) {
                        flat.push({ ...pokemon, region, location });
                    }
                });
            }
        }
        return flat;
    }

    function populateRegions() {
        Object.keys(db).forEach(region => {
            const option = document.createElement('option');
            option.value = region;
            option.textContent = region;
            regionSelect.appendChild(option);
        });
    }

    function populateLocations(region) {
        const datalistOptions = document.getElementById('location-datalist-options');
        datalistOptions.innerHTML = '';

        if (region !== 'all') {
            const locations = Object.keys(db[region]).sort((a, b) => a.localeCompare(b));
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
                    for (const loc of Object.keys(db[reg]).sort((a, b) => a.localeCompare(b))) { 
                        const regionLetter = reg.charAt(0).toUpperCase();
                        allLocationsWithRegion.push({
                            region: reg,
                            location: loc,
                            formatted: `[${regionLetter}] ${loc}`
                        });
                    }
                }
            }

            allLocationsWithRegion.sort((a, b) => {
                const regionComparison = regionOrderMap.get(a.region) - regionOrderMap.get(b.region);
                if (regionComparison !== 0) {
                    return regionComparison;
                }
                return a.location.localeCompare(b.location); 
            });

            allLocationsWithRegion.forEach(item => {
                const option = document.createElement('option');
                option.value = item.formatted;
                datalistOptions.appendChild(option);
            });
        }
    }

    regionSelect.addEventListener('change', () => {
        const region = regionSelect.value;
        locationSelect.value = ''; // Clear the location filter
        populateLocations(region);
        render();
    });

    // Keyboard support: Enter or Space on the inline map link opens the modal
    contentDiv.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            const el = e.target.closest && e.target.closest('.map-preview-link');
            if (el) {
                e.preventDefault();
                el.click();
            }
        }
    });

    locationSelect.addEventListener('input', render);
    searchInput.addEventListener('input', render);
    groupingSwitch.addEventListener('change', render);

    function render() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedRegion = regionSelect.value;
        const selectedLocation = locationSelect.value;
        const groupByPokemon = groupingSwitch.checked;

        let filteredPokemons = allPokemons.filter(p => {
            const nameMatch = p.data.Name.toLowerCase().includes(searchTerm);
            const regionMatch = selectedRegion === 'all' || p.region === selectedRegion;
            const locationMatch = selectedLocation === '' || 
                (selectedRegion === 'all' && 
                 `[${p.region.charAt(0).toUpperCase()}] ${p.location}`.toLowerCase().includes(selectedLocation.toLowerCase())) ||
                (selectedRegion !== 'all' && 
                 p.location.toLowerCase().includes(selectedLocation.toLowerCase()));
            return nameMatch && regionMatch && locationMatch;
        });

        // Sort the filtered Pokemons for consistent display
        filteredPokemons.sort((a, b) => {
            if (a.region !== b.region) return a.region.localeCompare(b.region);
            if (a.location !== b.location) return a.location.localeCompare(b.location);
            return a.data.Name.localeCompare(b.data.Name);
        });

        contentDiv.innerHTML = '';

        if (filteredPokemons.length === 0) {
            contentDiv.innerHTML = '<p class="text-center text-muted mt-4">No Pokémon found matching your criteria.</p>';
            return;
        }

        if (groupByPokemon) {
            const groupedByName = filteredPokemons.reduce((acc, p) => {
                if (!acc[p.data.Name]) acc[p.data.Name] = [];
                acc[p.data.Name].push(p);
                return acc;
            }, {});
            Object.keys(groupedByName).sort().forEach(name => {
                const group = groupedByName[name];
                const card = createGroupCard(name, group);
                contentDiv.appendChild(card);
            });
        } else {
            const groupedByLocation = filteredPokemons.reduce((acc, p) => {
                const key = `${p.region} - ${p.location}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(p);
                return acc;
            }, {});
            Object.keys(groupedByLocation).sort().forEach(location => {
                const group = groupedByLocation[location];
                const card = createGroupCard(location, group);
                contentDiv.appendChild(card);
            });
        }
    }

    function createGroupCard(title, pokemons) {
        const accordionItem = document.createElement('div');
        accordionItem.className = 'accordion-item';
        // Ensure the ID is safe for both HTML and JavaScript selectors
        const uid = ++uniqueIdCounter;
        const safeTitle = title.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
        const uniqueId = `collapse-${safeTitle}-${uid}`;

        let pokemonsHtml = '';
        pokemons.forEach(p => {
            pokemonsHtml += createPokemonDetail(p, groupingSwitch.checked);
        });

        accordionItem.innerHTML = `
            <h2 class="accordion-header" id="header-${uniqueId}">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${uniqueId}">
                    ${title} (${pokemons.length})
                </button>
            </h2>
            <div id="${uniqueId}" class="accordion-collapse collapse"><!-- data-bs-parent="#content"  per chiudere gli accordion precedenti all'apertura di quello nuovo-->
                <div class="accordion-body">
                    <div class="row g-3">
                        ${pokemonsHtml}
                    </div>
                </div>
            </div>
        `;

        // Add event listener for when the accordion body is shown
        const accordionBody = accordionItem.querySelector(`#${uniqueId}`);
        accordionBody.addEventListener('shown.bs.collapse', () => {
            // Scroll to the header of the opened accordion item (smooth)
            const headerEl = document.getElementById(`header-${uniqueId}`);
            if (headerEl) {
                headerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });

        return accordionItem;
    }

    function createPokemonDetail(pokemon, isGroupedByName) {
        const { data, location, region } = pokemon;
        const displayTitle = isGroupedByName ? `${region} - ${location}` : data.Name;
        
        // Build Full Location display. If a Map Link exists and Full Location has at least two lines,
        // show the second line as a clickable button that opens the modal (do not display the raw URL).
        const fullLocationLines = data["Full Location"] ? data["Full Location"].split('\n') : [];
        let fullLocationHtml = '';
        if (data["Map Link"] && fullLocationLines.length >= 2) {
            // first line plain, second line is a button that triggers the modal preview
            // Render inline (no <br>) - use separator for subsequent parts
            const rest = fullLocationLines.slice(2).filter(l => l.trim() !== '').map(l => ` - ${l}`).join('');
            // Use a span with role=button and tabindex for accessibility to avoid button styling
            fullLocationHtml = `<p class="card-text"><strong>Location:</strong> ${fullLocationLines[0]} - <span class="map-preview-link" role="button" tabindex="0" data-map-link="${data["Map Link"]}">${fullLocationLines[1]}</span>${rest}</p>`;
        } else {
            fullLocationHtml = `<p class="card-text"><strong>Location:</strong> ${data["Full Location"] ? data["Full Location"].replace(/\n/g, ' - ') : ''}</p>`;
        }

        const movesetForDisplay = data.Moveset.split('\n').filter(line => line.trim() !== '').map(m => `<li>${m.replace(/^-/, '').trim()}</li>`).join('');
        const notesForDisplay = data.Notes ? `<p class="card-text notes">${data.Notes}</p>` : '';

        return `
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-body">
                        <h5 class="card-title">${displayTitle}
                            <button class="btn btn-sm btn-outline-secondary float-end copy-pokemon-btn" 
                                data-pokemon-name="${data.Name}" 
                                data-full-location="${data["Full Location"]}" 
                                data-map-link="${data["Map Link"] || ''}"
                                data-hms="${data.HMs}" 
                                data-egg-group="${data["Egg Group"]}" 
                                data-gender="${data.Gender}" 
                                data-ability="${data.Ability}" 
                                data-moveset="${data.Moveset}" 
                                data-notes="${data.Notes || ''}">
                                Copy
                            </button>
                        </h5>
                        <p class="card-text"><strong>Name:</strong> ${data.Name}</p>
                        ${fullLocationHtml}
                        <p class="card-text"><strong>HMs:</strong> ${data.HMs}</p>
                        <p class="card-text"><strong>Egg Group:</strong> <code>${data["Egg Group"]}</code></p>
                        <p class="card-text"><strong>Gender:</strong> <code>${data.Gender}</code></p>
                        <p class="card-text"><strong>Ability:</strong> <code>${data.Ability}</code></p>
                        <p class="card-text"><strong>Moves:</strong></p>
                        <ul>
                            ${movesetForDisplay}
                        </ul>
                        ${notesForDisplay}
                    </div>
                </div>
            </div>
        `;
    }

    // Event delegation for map preview and copy buttons
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
            const { pokemonName, fullLocation, hms, eggGroup, gender, ability, moveset, notes } = btn.dataset;

            let markdown = `**${pokemonName}**\n`;
            const fullLocLines = fullLocation ? fullLocation.split('\n') : [];
            const mapLink = btn.dataset.mapLink || '';
            if (mapLink && fullLocLines.length >= 2) {
                markdown += `_${fullLocLines[0]}_\n`;
                markdown += `_[${fullLocLines[1]}](${mapLink}) _\n`;
                for (let i = 2; i < fullLocLines.length; i++) {
                    if (fullLocLines[i].trim() !== '') markdown += `_${fullLocLines[i]}_\n`;
                }
            } else {
                markdown += `_${fullLocation.split('\n').join('_\n_')}_\n`;
            }
            if (hms) markdown += `_${hms}_\n`;
            
            markdown += `\n\`Egg group: ${eggGroup}\`\n`;
            markdown += `\`Gender: ${gender}\`\n`;
            markdown += `\`Ability: ${ability}\`\n\n`;
            
            markdown += `**MOVESET**\n`;
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
                markdown += `\n# -= Despawns approximately <t:${despawnUnix}:R> =- # `;
            } catch (e) {
                console.error('Timestamp generation error:', e);
            }

            navigator.clipboard.writeText(markdown).then(() => {
                const originalText = btn.textContent;
                btn.textContent = "Copied!";
                btn.classList.remove('btn-outline-secondary');
                btn.classList.add('btn-success');

                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.classList.remove('btn-success');
                    btn.classList.add('btn-outline-secondary');
                }, 2000);
            }).catch(err => {
                console.error('Copy error:', err);
                alert("Automatic copy failed.");
            });
        }
    });
});