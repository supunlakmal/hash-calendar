# Contributing to hash-calendar

Thanks for your interest in improving `hash-calendar`.

## Before you start

- Read `README.md` for architecture and current behavior.
- Check existing issues and open PRs to avoid duplicate work.
- For bugs, include clear reproduction steps.

## Development setup

Run locally with a static server:

```bash
npx serve .
```

Or:

```bash
python -m http.server 8080
```

Docker option:

```bash
docker compose up --build
```

## Project principles

Please keep changes aligned with core project goals:

- Privacy-first behavior.
- Client-only architecture (no server-side calendar storage).
- URL-hash compatibility and shareability.
- Backward compatibility where practical.

## How to contribute

1. Fork the repo and create a feature branch.
2. Keep PRs focused and reasonably small.
3. Update docs when behavior changes.
4. Add or update tests when relevant.
5. Open a pull request with:
   - What changed
   - Why it changed
   - How to verify it

## Pull request checklist

- Code is readable and consistent with existing style.
- No accidental breaking changes to existing links/state format.
- Mobile and desktop behavior both checked for UI changes.
- Related docs updated (`README.md`, help/privacy/about pages).

## Reporting issues

When opening an issue, include:

- Expected behavior
- Actual behavior
- Browser and OS
- Steps to reproduce
- Screenshots or sample URLs when possible

## Security issues

Please do not report security vulnerabilities in public issues.
See `SECURITY.md` for the reporting process.
