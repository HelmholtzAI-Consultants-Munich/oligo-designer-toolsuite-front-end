# How to publish this docs site with GitHub Pages

## Option A — Simple (no Actions)
1. Copy the entire `docs/` folder from this package into the root of your repo.
2. On GitHub: **Settings → Pages → Build and deployment**  
   - Source: **Deploy from a branch**  
   - Branch: **main** / **docs folder**  
3. Save. Your site will be available at `https://<user>.github.io/<repo>/`.

## Option B — GitHub Actions
1. Copy `docs/` to your repo root.
2. Copy `.github/workflows/pages.yml` to your repo.
3. On GitHub: **Settings → Pages → Build and deployment**  
   - Source: **GitHub Actions**.
4. Push to `main`. The workflow will publish the site.

---

### Editing the navigation
We used the built-in `minima` theme. Add/rename markdown files in `docs/`.  
GitHub Pages will build them automatically.

### Where to edit content
- `docs/index.md` — homepage
- `docs/getting-started.md`
- `docs/pipelines.md`
- `docs/runs.md`
- `docs/auth.md`
- `docs/troubleshooting.md`