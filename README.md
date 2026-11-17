# PacNation League Archive

Sixteen seasons of PacNation fantasy football history, from 2010 through 2025. Browse the all-time record book, standings, draft boards, matchups, lineups, transactions, and league settings. The website uses the JSON files in `public/data` and can run on any static web host.

## Publish with GitHub Pages

1. Put the contents of this folder at the root of a GitHub repository on the `main` branch. Include the hidden `.github` folder.
2. Open **Settings → Pages**. Under **Build and deployment**, select **GitHub Actions** as the source.
3. In **Actions → Deploy PacNation Archive**, choose **Run workflow**. Open the deployment URL reported by the workflow once it succeeds. Subsequent pushes to `main` deploy automatically.

For a repository named `pacnation-archive`, the default site address is `https://YOUR-USERNAME.github.io/pacnation-archive/`. Existing season and record-book query parameters work when carried over to the new site URL.

## Run locally

Use Node.js 24 and run `npm ci` followed by `npm run dev`. For a production build, run `npm run build`. The static output is in `dist`. Set `VITE_SITE_URL` to the full public site URL to use its social preview image on an alternate static host.
