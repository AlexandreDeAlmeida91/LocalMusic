# Peak Music 1.8.13 — Nettoyage des originaux normalisés

Après enregistrement réussi de la bibliothèque, les copies originales suivies par originalAudioPath sont supprimées lorsque la version normalisée existe, est non vide et possède une durée positive issue de la réparation. Cela concerne les nouveaux téléchargements, imports et réparations.

Au démarrage, les anciennes copies suivies sont également nettoyées. Aucun balayage destructif des fichiers non référencés : seuls les originaux identifiés par les métadonnées de réparation sont éligibles. Un original encore utilisé comme audio principal par un autre morceau reste conservé. Les échecs de nettoyage ne bloquent pas la lecture et sont retentés plus tard.

Le champ originalAudioPath reste dans les métadonnées pour empêcher la récupération accidentelle de ces anciennes copies. Il ne signifie plus que le fichier existe encore. Les pochettes, paroles et playlists ne sont pas modifiées.

La normalisation de durée reste nécessaire pour les flux concernés. Ce correctif évite de conserver deux fichiers après réparation ; il ne modifie pas le moteur de téléchargement.

82 tests automatisés réussis. Vérifier sur iPhone après installation de la nouvelle IPA sans désinstaller Peak Music.
