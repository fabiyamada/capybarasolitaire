# Capybara Solitaire

A lightweight browser-based solitaire game with a friendly capybara theme. This repo contains the playable UI and simple game logic intended for learning, demos, or lightweight deployment.

## Features
- Classic solitaire-style gameplay (single-player, in-browser).
- No build tools required — playable by opening files in a browser or using a static server.
- Small, readable codebase: HTML, CSS, and JavaScript.

## Quick start
- Open `index.html` in your browser.
- Or serve locally (recommended for consistent behavior):
  - From the project root: `python -m http.server 8000`
  - Open http://localhost:8000 in your browser

## Controls & gameplay
- Click or tap cards to select/move them (standard solitaire rules apply).
- Use your browser's refresh to restart the current deal.
- Keyboard shortcuts: (if implemented) — check `script.js` for any bound keys.

## Project structure
- index.html — main UI / entry point
- script.js — game logic and interaction handlers
- style.css — styles and responsive layout
- README.md — this file
- LICENSE — project license

## Development notes
- No tooling required. Edit files directly and refresh the browser to see changes.
- For debugging: open the browser DevTools (Console) to see game logs or errors.
- Keep JavaScript modular and comment gameplay rules in `script.js` for clarity.

## Contributing
- Always open an issue first to discuss bugs or proposed changes. This helps ensure your work aligns with the project's direction and avoids duplicated effort.
- Use the issue templates in `.github/ISSUE_TEMPLATE/` when creating an issue — they prompt for browser, OS, steps, and console output which speeds triage.
- After an issue is opened and discussed, submit a pull request that references the issue and includes clear steps to reproduce and tests or screenshots where appropriate.

## Reporting issues
Always open an issue first (use the templates):
- Use the templates in `.github/ISSUE_TEMPLATE/` to provide consistent details.
- Include: browser and version, operating system, steps to reproduce, and console output or screenshots if relevant

## License
- MIT — see `LICENSE` for details.

## Contact
- Developer: Fabi Yamada

<!-- End of README -->