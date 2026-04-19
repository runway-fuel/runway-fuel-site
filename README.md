# Runway Fuel website

This repository contains the public-facing **Runway Fuel** website package prepared for deployment on GitHub and Vercel.

The site is intentionally designed as a disciplined public front door rather than a product-reveal surface. It explains the organization's public positioning, operating model, stakeholder relevance, and operational value while keeping proprietary implementation details private.

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | Main HTML document and metadata |
| `src/main.js` | Page structure, interactions, stakeholder switcher, and form behavior |
| `src/styles.css` | Visual system, layout, and responsive styling |
| `public/assets/` | Public brand and diagram assets |
| `DEPLOYMENT_GUIDE.md` | GitHub and Vercel deployment steps |
| `ideas.md` | Design exploration and chosen direction |
| `implementation_brief.md` | Purpose, functional priorities, and architecture |

## Local development

Install dependencies and start the local development server:

```bash
pnpm install
pnpm dev
```

Create a production build with:

```bash
pnpm build
```

## Production notes

The site is built with **Vite** and outputs to the default `dist` directory.

The contact form is intentionally a frontend-only intake surface. It prepares a mail client message and is ready to be connected later to a live email routing workflow, CRM, or backend submission endpoint.
