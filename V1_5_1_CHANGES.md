# Peak Music V1.5.1 — nouveau nom et nouvelle icône

## Changements visuels
- Nom affiché sur l’écran d’accueil iPhone : **Peak Music**.
- Titre de la bibliothèque dans l’application : **Peak Music**.
- Icône iOS/Android personnalisée : note de musique métallique argentée, halo et montagne rouge/noir (illustration validée par l’utilisateur).
- Aucune nouvelle pochette de morceau ou de playlist n’est ajoutée.

## Continuité des données — ne pas modifier
- Bundle ID iOS : `com.alexandre.localmusic`.
- Package Android : `com.alexandre.localmusic`.
- Slug Expo interne : `local-music`.
- Dossier de stockage de la bibliothèque : `Documents/LocalMusic/`.
- Le moteur audio RNTP, les paroles, les playlists et le stockage V1.4.2 ne sont pas modifiés.

## Compilation
- Le workflow GitHub Actions détecte le workspace Xcode généré et utilise son scheme au lieu de supposer `LocalMusic`.
- Artifact GitHub : `PeakMusic-iOS-IPA`.
- IPA non signée : `PeakMusic-unsigned.ipa`.

## Installation
Installer la nouvelle IPA par-dessus l’ancienne application, avec le même compte Apple dans SideStore ; ne pas supprimer l’ancienne application afin de conserver les fichiers locaux.
