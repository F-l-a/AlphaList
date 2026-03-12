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
            contentDiv.innerHTML = '<p class="text-center text-muted mt-4">No Pokémon found matching your criteria.</p>';
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
                const formattedName = `Alpha ${name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()}`;
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

    function createPokemonDetail(pokemon, isGroupedByName) {
        const uid = ++uniqueIdCounter; // Generate unique ID for each pokemon detail card
        const { data, location, region, name } = pokemon;
        
        // Format the Pokémon name
        const formattedName = `Alpha ${name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()}`;

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
        const locationHtml = `<p class="card-text"><strong>Location:</strong> ${locationParts.join(' - ')}</p>`;

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
                                    Copy
                                </button>
                            </h2>
                            <div id="pokemonCollapse-${uid}" class="accordion-collapse collapse" aria-labelledby="pokemonHeader-${uid}" data-bs-parent="#pokemonAccordion-${uid}">
                                <div class="accordion-body">
                                    <p class="card-text"><strong>Name:</strong> ${formattedName}</p>
                                    ${locationHtml}
                                    <p class="card-text"><strong>HMs:</strong> ${hmsForDisplay}</p>
                                    <p class="card-text"><strong>Egg Group:</strong> <code>${eggGroupForDisplay}</code></p>
                                    <p class="card-text"><strong>Male Ratio:</strong> <code>${data["Male Ratio"]}%</code></p>
                                    <p class="card-text"><strong>Ability:</strong> <code>${data.Ability}</code></p>
                                    <p class="card-text"><strong>Moves:</strong></p>
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
            
            markdown += `\n\`Egg group: ${eggGroup}\`\n`;
            markdown += `\`Male Ratio: ${maleRatio}%\`\n`;
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
                markdown += `\n## -=Despawns approximately <t:${despawnUnix}:R>=-`;
            } catch (e) {
                console.error('Timestamp generation error:', e);
            }

            // Append message Footer
            markdown += `\n-# [Alpha List - copy and send the next one!](https://f-l-a.github.io/AlphaList/)`;

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
