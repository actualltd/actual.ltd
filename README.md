# ACTUAL LTD.

Static company site for `actual.ltd`.

## Local

```sh
npm ci
npm run dev
```

## GitHub Pages

```sh
npm run build
```

The static output is written to `dist`. Push `main` to run the Pages workflow. In the repository settings, set Pages to use GitHub Actions and enter `actual.ltd` as the custom domain.

## Sound

The public site ships Opus and MP3 editions of the original procedural score. Its WAV master is generated locally with `scripts/render-signal-study.py` and is not deployed.
