# Solutions PSC — film motion 24,5 s

Film de présentation 1920×1080, 60 i/s, avec bande-son générée par code (120 BPM, la majeur).

| Temps | Séquence |
|---|---|
| 0 – 2 s | Ouverture : les trois cercles de la marque tombent, gravitent, le bleu envahit l'écran |
| 2 – 6,5 s | Santé. Prévoyance. Retraite. — 1,5 s par mot ; chaque point final devient le plan suivant |
| 6,5 – 9,5 s | « La protection sociale complémentaire devient complexe. » — nuage réglementaire, gel, onde de choc |
| 9,5 – 13,3 s | L'ordre : la grille, puis Structurer. Sécuriser. Piloter. et « vos régimes… » |
| 13,5 – 18,5 s | Méthode : État des lieux → Cahier des charges → Mise en concurrence → Suivi annuel (1 s par étape) |
| 18,5 – 20,5 s | Courtier indépendant — ORIAS · RC Professionnelle · Garantie financière |
| 20,5 – 24,5 s | Signature : logo, « Expertise et indépendance. », solutions-psc.fr |

Toutes les durées se règlent en haut de `timeline.js` (`WORD`, `NODE_GAP`, `INDEP`…) : image et son suivent automatiquement.

## Fichiers

- `timeline.js` — la timeline maîtresse (`T`, `DURATION`), partagée par l'image, le son et le rendu.
- `scenes.js` — toute l'animation : `drawScene(ctx, t)` est une fonction pure du temps.
- `engine.js` — easings, ressorts, révélations de texte, helpers de dessin.
- `main.js` — flou de mouvement réel (moyenne de sous-images sur l'obturateur) et lecteur de prévisualisation.
- `audio.mjs` — synthèse de la bande-son, calée sur la même timeline (`T`, `TERMS_LIST`).
- `render.mjs` — rendu image par image dans Chrome headless (en parallèle) puis encodage ffmpeg.

## Refaire le film

```bash
npm install
node audio.mjs          # → out/soundtrack.wav
node render.mjs         # → out/solutions-psc-showreel.mp4
```

Prévisualisation en temps réel : `npx http-server .` puis ouvrir `index.html?preview` (ajouter `&t=6` pour démarrer à 6 s).
Images fixes de contrôle : `node render.mjs --stills 1.2,6.1,12.8 [--blur]` puis `./sheet.sh`.

Prérequis : Node 20+, Google Chrome, ffmpeg.
