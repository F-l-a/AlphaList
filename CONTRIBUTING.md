# Contributing

Thank you for helping keep the Alpha List up to date! This project accepts updates to `data.json` via Pull Requests. The recommended workflow for external contributors is to fork the repository and send a PR from your fork.

## Quick workflow (recommended)
1. Fork the repository on GitHub.
2. Clone your fork locally:

   ```bash
   git clone https://github.com/<your-username>/AlphaList.git
   cd AlphaList
   ```

3. Create a feature branch:

   ```bash
   git checkout -b fix/update-data
   ```

4. Update `data.json` following the schema described in `README.md`.

5. Test locally

   Open the Visual Studio Code terminal and run the local static server. If you have `npm` available you can install and run `http-server`:

   ```bash
   # install locally (optional) and run via npx
   npm install http-server
   npx http-server -p 8000 -c-1
   # open http://localhost:8000 in your browser
   ```

   If you don't have `npm`, you can use Python's simple server as an alternative:

   ```bash
   # Python 3
   python -m http.server 8000
   ```

   Note: `-c-1` disables caching for `http-server`. Running the commands in the VS Code integrated terminal is recommended.

6. Commit, push to your fork and open a Pull Request against `main` in the original repository.

   Example commands (replace branch name and message):

   ```bash
   git add data.json
   git commit -m "Update data: <short description>"
   git push origin fix/update-data
   ```

   After pushing, open your fork on GitHub and click "Compare & pull request" (or use the `gh` CLI):

   ```bash
   # optional, using GitHub CLI
   gh pr create --base main --head <your-username>:fix/update-data --title "Update data: <short description>" --body "Description of changes"
   ```

   In the PR description include a short summary of the changes and any notes for maintainers.

## What to include in the Pull Request
- A clear title and description of the changes.
- A short summary of any non-trivial edits (why the change was needed).
- If you added or changed `Map Link` fields, ensure they are direct image URLs (e.g. `https://i.imgur.com/abcd.png`).

## Data validation checklist (please run before opening PR)
- Only modify `data.json`.
- Keep field types consistent (strings). Use `\n` for logical line breaks inside fields.
- `Moveset` lines should start with `- ` (dash + space) for consistent Markdown conversion.
- `Map Link` should point to a direct image URL (prefer `i.imgur.com` to avoid cross-hosting issues).
- Avoid trailing commas and ensure valid JSON; you can validate with `jq` or an online JSON validator:

  ```bash
  jq . data.json > /dev/null
  ```

## Maintainers / Merge policy
- Keep `main` protected; accept PRs after review.
- After merging a PR to `main`, the repository runs the GitHub Actions workflow to publish the site to GitHub Pages automatically.

## Questions
If you're unsure about a change, open an issue or draft PR and request feedback from maintainers.

Thanks for contributing!
