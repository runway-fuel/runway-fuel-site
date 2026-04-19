# Deployment guide for Runway Fuel

This package is prepared for a professional **GitHub-first** deployment workflow followed by **Vercel** import.

## 1. Local preparation

Open the project folder in your terminal and confirm that you are in the repository root.

```bash
cd runway-fuel-site
ls
```

You should see `index.html`, `package.json`, `src`, `public`, and this guide.

## 2. Verify locally before push

Install dependencies and run the site locally.

```bash
pnpm install
pnpm dev
```

Then build it once to confirm the production output.

```bash
pnpm build
```

## 3. Push to GitHub

Create the repository if it does not already exist, then run:

```bash
git init
git branch -M main
git add .
git commit -m "Initial Runway Fuel website"
git remote add origin https://github.com/runway-fuel/runway-fuel-site.git
git push -u origin main
```

If the repository already exists and already has a remote, check it first:

```bash
git remote -v
```

## 4. Import into Vercel

When the repository is visible in Vercel, use these settings.

| Field | Value |
| --- | --- |
| Framework Preset | `Vite` |
| Root Directory | `./` |
| Install Command | `pnpm install` |
| Build Command | `pnpm build` |
| Output Directory | `dist` |
| Environment Variables | none required for this version |

## 5. Post-deploy checks

After Vercel finishes the first deployment, verify the following in production:

| Check | What to confirm |
| --- | --- |
| Hero section | Branding, headline, and CTA buttons render correctly |
| Navigation | Section links scroll correctly on desktop and mobile |
| Diagrams | Public surface and value map images load correctly |
| Stakeholder switcher | Tabs update the detail panel correctly |
| Contact intake | Form opens the local mail client as expected |
| Mobile layout | Header, cards, and spacing remain clear on small screens |

## 6. Recommended next integration step

The first enhancement after deployment should be replacing the frontend-only intake form behavior with one of the following:

| Option | Use case |
| --- | --- |
| Email service endpoint | Fastest production contact routing |
| CRM form integration | Lead qualification and operational triage |
| Backend API endpoint | Full validation, logging, and workflow routing |
