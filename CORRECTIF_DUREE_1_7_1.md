# Peak Music 1.7.1 — durée des fichiers locaux

Le MP3 fourni a été décodé entièrement avec FFmpeg : environ 541,13 secondes d’audio, durée déclarée 541,176 secondes, stéréo 48 kHz / 320 kbit/s. L’utilisateur confirme 9:01 dans Fichiers iOS, contre environ 18 minutes dans Peak Music.

Le moteur RNTP chargeait les fichiers sans demander une analyse précise de leur durée. Cette version active AVURLAssetPreferPreciseDurationAndTimingKey pour les fichiers locaux, au niveau du moteur réel de lecture. La validation des nouveaux téléchargements demande également une durée précise. Le type MIME transmis distingue désormais M4A et MP3.

Il ne s’agit pas d’une division par deux de l’affichage ni d’une coupe du fichier. Les fichiers audio, leur qualité et les playlists sont conservés. La même source AVPlayer alimente la progression, la fin de lecture et l’écran verrouillé.

Le patch RNTP est appliqué par npm postinstall ; inclure impérativement le dossier scripts dans le dépôt. Il vérifie la version 5.9.2 et échoue si le code attendu a changé. Ne pas désactiver les scripts npm. Ce patch ne redistribue pas le code de la dépendance et ne change pas sa licence.

Validation : tests JavaScript et application répétée du patch, export iOS. Pas de compilation Xcode ni d’exécution sur iPhone dans cet environnement. L’hypothèse de durée estimée reste à confirmer par essai sur l’appareil.

Recompiler l’IPA via GitHub Actions, installer par-dessus l’app existante dans SideStore, puis relancer le morceau existant. Vérifier une durée proche de 9:01, la recherche vers 8:50 et le passage au morceau suivant à la fin. Vérifier également les commandes et la durée sur l’écran verrouillé. Aucun nouveau téléchargement n’est nécessaire pour ce test.

Référence Apple : https://developer.apple.com/documentation/avfoundation/avurlassetpreferprecisedurationandtimingkey

Commit : Corrige la mesure de durée des fichiers audio locaux sur iOS
