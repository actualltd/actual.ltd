# ACTUAL LTD.

The official, single-page company site for ACTUAL LTD. Five engraved animal scenes rotate through a responsive field index with full-resolution archive cards.

## Local

```sh
npm ci
npm run dev -- --port 5174
```

## GitHub Pages

```sh
npm run build
```

The static output is written to `dist`. Push `main` to run the Pages workflow. In the repository settings, set Pages to use GitHub Actions. The committed `CNAME` configures `actual.ltd` as the custom domain.

The experience is silent by design. Pointer movement provides restrained parallax, while reduced-motion mode uses static scenes. Company information remains available as a native dialog.

## Animal assets

```sh
npm run build:animal-posters
npm run build:scene-previews
npm run build:animal-gallery
```

The responsive desktop, portrait, transparent cutout, and archive preview assets are generated independently.
Original full-field source plates are kept in `source-assets/animals` so they are not copied into the public GitHub Pages bundle.
