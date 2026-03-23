# Pokémon Alpha List

Repository template and data schema for the Pokémon Alpha List used by the site.

## Purpose
Keep `data.json` consistent. Data updates should be submitted as a Pull Request modifying `data.json`. When a PR is merged into `main`, a GitHub Actions workflow will automatically deploy the site to GitHub Pages.

## JSON structure (base)
Top-level structure: an object whose keys are region names. Each region contains locations (objects) with arrays of Pokémon entries.

Example minimal structure - see [data.json](data.json) itself for other examples:

```json
{
  "Kanto": {
    "One Island": [
      {
        "name": "Arcanine",
        "data": {
          "Region": "Kanto",
          "Specific Location": "Mt. Ember",
          "Location Notes": "Optional notes about the location",
          "Map Link": "https://i.imgur.com/....png",
          "HMs": ["Strength", "Surf"],
          "Egg Group": ["Field"],
          "Male Ratio": "75",
          "Ability": "Justified",
          "Moveset": ["Fire Blast", "Bulldoze", "Dragon Pulse", "Safeguard"],
          "Notes": ["**⚠ ADS HAVE RECOIL ⚠**", "Another note"]
        }
      }
    ]
  }
}
```

## Field guide
- `name` (string) — The Pokémon's name, in title case (e.g., "Arcanine").
- `data` (object) — Contains all the detailed information about the spawn.
  - `Region` (string) — The main region (e.g., "Kanto", "Johto").
  - `Specific Location` (string) — The specific map or area (e.g., "Mt. Ember", "Route 18").
  - `Location Notes` (string, optional) — Any additional details about finding the location.
  - `Map Link` (string, optional) — Direct image URL (e.g. `https://i.imgur.com/....png`). If present, the UI uses it to preview the map. Needs to use the `i.imgur.com` domain. (note the `i.` and the file expension: they are required)
  - `HMs` (array of strings, optional) — A list of HMs required (e.g., `["Surf", "Strength"]`).
  - `Egg Group` (array of strings, optional) — A list of egg groups (e.g., `["Field"]`).
  - `Male Ratio` (string) — A number representing the percentage of males (e.g., `"75"`, `"50"`, `"0"`, `"N/A"`).
  - `Ability` (string) — The Pokémon's ability.
  - `Moveset` (array of strings) — A list of moves for the Pokémon.
  - `Notes` (array of strings, optional) — Free text, may contain Markdown for special formatting.

Keep types consistent. Use arrays of strings for lists like `HMs`, `Egg Group`, and `Moveset`.

## Local Testing
To run the site locally for testing, start a simple HTTP server from the project root.

Recommended for local testing without HTTP cache:

```bash
npx http-server . -p 8000 -c-1
```

Alternative with Python's built-in server:

```bash
python -m http.server 8000
```

Python no-cache option (custom server):

```bash
python no_cache_server.py
```

Then open: `http://localhost:8000`

Notes:
- `npx http-server . -p 8000 -c-1` disables HTTP caching, which is useful while changing static assets.
- `python -m http.server 8000` is simpler, but it does not disable caching headers.
- `python no_cache_server.py` serves files with `Cache-Control: no-store` style headers.
- On localhost, this project automatically unregisters service workers and clears Cache Storage at startup.

## How To Contribute
See [CONTRIBUTING.md](CONTRIBUTING.md)

## Credits
- Original data by ZzPSYCHOzZ
- Website by FlaProGmr (me)
- Maps by the community
- All the contributors to this project
