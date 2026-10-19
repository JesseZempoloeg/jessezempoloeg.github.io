# NOVA ARCADE

Een arcade vol browsergames, gemaakt door Jesse Zempoloeg. Alles draait direct in de browser: geen download, geen account. Scores blijven lokaal op het apparaat.

- **Site:** https://jessezempoloeg.github.io/
- **Over de maker:** https://jessezempoloeg.github.io/over.html
- **Stack:** Vite + vanilla JS + three.js

## Lokaal draaien

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # productie in dist/
npm run preview  # dist/ lokaal serveren
```

## Online zetten (GitHub Pages)

De repo heet `jessezempoloeg.github.io`, dus dit is een **user site**: hij staat op de root van het domein. Publiceren gebeurt vanuit de map `pages-deploy/` — dat is de kant-en-klare build, dus GitHub hoeft zelf niets te bouwen.

Na een wijziging:

```bash
npm run build
rm -rf pages-deploy && cp -r dist pages-deploy
```

Zet daarna de inhoud van `pages-deploy/` in de repo (bestanden erin slepen op github.com kan ook). GitHub Pages serveert dan https://jessezempoloeg.github.io/.

- `pages-deploy/index.html` verwijst met absolute paden (`/assets/...`). Dat klopt alleen op de root van het domein, en dat is bij deze repo het geval.
- `pages-deploy/404.html` wordt door GitHub Pages automatisch gebruikt voor onbekende paden.
- De map `sites/` hoort bij een Cloudflare-deploy en doet op GitHub Pages niets.

## Eigen domein (optioneel)

Koop een domein (bijvoorbeeld `jessezempoloeg.nl`) en zet het in **Settings → Pages → Custom domain**. Zet daarna in `public/` een bestand `CNAME` met alleen de domeinnaam erin (dat komt automatisch in `dist/` en `pages-deploy/`), en vervang `https://jessezempoloeg.github.io` in `index.html`, `over.html`, `public/sitemap.xml` en `public/robots.txt` door het nieuwe adres. HTTPS aanvinken.

## Vindbaar worden op je naam

De site heeft alles wat een zoekmachine nodig heeft om hem te begrijpen:

- unieke titel + description per pagina, canonical-URL's en `robots.txt`
- `sitemap.xml` met beide pagina's
- Open Graph- en Twitter-kaarten met een echte afbeelding (`public/og-image.png`, 1200×630)
- structured data: `Person` (Jesse Zempoloeg, websitemaker), `WebSite`, `WebPage`, `ProfilePage` en `BreadcrumbList`
- een eigen over-pagina met de naam in de titel, de kop en de tekst

Dat is de technische kant. Of je bovenaan komt bij een zoekopdracht bepaalt Google zelf; het helpt om deze stappen te doen:

1. **Google Search Console** (search.google.com/search-console): voeg `https://jessezempoloeg.github.io/` toe, verifieer met de HTML-tag of via DNS, en dien `sitemap.xml` in.
2. **Backlinks:** zet de link in je GitHub-profiel (Website-veld), in je bio op sociale media en in elk project waar je aan meedoet. Links van andere sites tellen zwaar.
3. **Tijd:** indexeren duurt dagen tot weken, en posities groeien daarna langzaam. Nieuwe games en een actieve GitHub dragen bij.
4. **Klopt je naam?** Zoek op `"Jesse Zempoloeg"` en kijk of de site verschijnt. Zo niet, vraag dan in Search Console om indexering van de URL.

## Structuur

```
index.html            homepage
over.html             over-pagina (Jesse Zempoloeg)
src/main.js           homepage: kaarten, game-shell, scroll-effecten
src/over.js           over-pagina: reveal + scrollbalk
src/style.css         alle styling
src/hero.js           three.js hero-scene
src/games/            elke game als losse module (lazy loaded)
public/               robots.txt, sitemap.xml, og-image, iconen, manifest, 404
pages-deploy/         kant-en-klare build die op GitHub Pages staat
```
