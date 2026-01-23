# Pokémon Alpha List

Repository template and data schema for the Pokémon Alpha List used by the site.

## Purpose
Keep `data.json` consistent. Data updates should be submitted as a Pull Request modifying `data.json`. When a PR is merged into `main`, a GitHub Actions workflow will automatically deploy the site to GitHub Pages.

## JSON structure (base)
Top-level structure: an object whose keys are region names. Each region contains locations (objects) with arrays of Pokémon entries.

Example minimal structure - see [data.json](data.json) itself for other examples:

```json
{
  "Unova": {
    "Route 18": [
      {
        "data": {
          "Name": "Alpha Tropius",
          "Full Location": "Unova\nRoute 18",
          "Map Link": "https://i.imgur.com/tlRBjy6.png",
          "HMs": "Strength/Surf",
          "Egg Group": "Monster/Plant",
          "Gender": "50/50",
          "Ability": "Harvest - Has Sitrus Berry",
          "Moveset": "- Leaf Blade\n- Body Slam\n- Earthquake\n- Swords Dance",
          "Notes": "Some notes about this spawn."
        }
      }
    ]
  }
}
```

## Field guide
- `Name` (string) — canonical display name.
- `Full Location` (string) — multi-line string where lines are separated by `\n`. First line is general area, second line can be a sub-area label. Examples: `"Unova\nP2 Lab"`.
- `Map Link` (string, optional) — direct image URL (e.g. `https://i.imgur.com/abcd.png`). If present, the UI uses it to preview the map. Needs to use the `i.imgur.com` domain.
- `Moveset` (string) — lines separated by `\n`; each move start with `- ` (with a space after the dash); the app will render as a bulleted list and copy them to Markdown for discord.
- `Notes` (string, optional) — free text, may contain Markdown.
- `HMs` (string, optional) — textual list slash(`/`)-separated.
- `Egg Group` (string, optional) — textual list slash(`/`)-separated.
- `Gender` (string) — Eg: `"50/50"` or `"75% Male"`.
- `Ability` (string)

Keep types consistent: strings for textual fields; use `\n` to separate logical lines inside a field, do not insert literal line breaks directly into the JSON editor, which can break JSON parsing.

## How To Contribute
See [CONTRIBUTING.md](CONTRIBUTING.md)

## Credits
- Original data by ZzPSYCHOzZ
- Website by FlaProGmr (me)
- Maps by the community
- All the contributors to this project