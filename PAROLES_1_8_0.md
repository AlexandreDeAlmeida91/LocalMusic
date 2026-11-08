# Peak Music 1.8.0 — Paroles en ligne

Pendant un import par lien, la recherche démarre dès que titre et artiste sont connus,
en parallèle du téléchargement audio. Le son est enregistré avant d’attendre la fin
de la recherche. Une recherche infructueuse ne supprime pas le son.

Sources : LRCLIB (généraliste), AnimeSongLyrics (rōmaji, seulement avec correspondance
artiste + titre et vérification du titre de la page). Ce n’est pas une recherche sur
l’ensemble du Web. Aucun serveur externe de traitement, aucune clé API.
Les sources reçoivent titre et artiste ; le fichier audio ne leur est pas envoyé.

Les TXT sont stockés dans LocalMusic/Lyrics et liés à l’identifiant du morceau.
Ouvrir Paroles dans le lecteur pour lire hors ligne ou réessayer une recherche.
Le menu du morceau permet également de rechercher lorsqu’il n’a pas de TXT.
Les TXT déjà associés, notamment importés manuellement, sont conservés.
Pas de transcription IA, de traduction ou de conversion automatique des kanji.
Les cas ambigus ou sans artiste restent sans TXT. Une chaîne YouTube peut ne pas
correspondre au nom de l’artiste : ces liens peuvent nécessiter une correction
manuelle des informations du morceau puis une nouvelle recherche.

Garder l’application ouverte : passage en arrière-plan ou annulation interrompt
la recherche de l’import. Les MP3/M4A déjà ajoutés restent disponibles.
La recherche peut prolonger la fin d’import (requêtes limitées dans le temps).

Installation : remplacer le projet, construire une nouvelle IPA via GitHub Actions
et l’installer avec SideStore par-dessus l’application existante, sans désinstaller.
Validation : 46 tests JavaScript réussis ; export iOS Expo. Pas de compilation
native Xcode ni de test physique iPhone dans cet environnement.
