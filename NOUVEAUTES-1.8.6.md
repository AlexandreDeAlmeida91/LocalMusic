# Peak Music 1.8.6 — Essai de synchronisation automatique

## Paroles déjà synchronisées
Les résultats LRCLIB contenant des repères LRC conservent maintenant leurs temps.
Dans « Ajouter des paroles » > « Rechercher en ligne », les résultats concernés portent la mention « Synchronisées ».
Choisir puis enregistrer un résultat associe aussi ses repères. La récupération automatique conserve également les temps lorsqu’ils sont présents.
Les paroles déjà téléchargées ne sont pas modifiées rétroactivement : relancer la recherche et choisir une version synchronisée si souhaité.

## Prototype local pour les autres versions
Dans le lecteur > Paroles > « Essayer la synchronisation automatique locale » :
1. Ajouter un texte correspondant exactement au morceau, avec les répétitions écrites en entier.
2. Choisir anglais, français, portugais ou espagnol.
3. Toucher « Analyser le fichier audio ». La lecture est mise en pause.
4. Autoriser la reconnaissance vocale si iOS le demande. Aucun accès au microphone n’est utilisé.
5. Garder l’application ouverte. Un bouton permet d’annuler.
6. Si l’analyse fournit assez de correspondances, toucher les lignes proposées pour écouter et vérifier leurs positions.
7. « Valider ces repères » les conserve dans la bibliothèque pour les prochaines écoutes hors connexion.

Ce prototype utilise le modèle de reconnaissance vocale local fourni par iOS, puis rapproche la transcription horodatée du texte. Ce n’est pas un modèle spécialisé dans le chant, ni un alignement forcé neuronal. Il peut refuser beaucoup de remixes. La vérification humaine reste nécessaire : un score de correspondance n’est pas une garantie de justesse des temps.
Si la langue n’est pas disponible localement, l’analyse échoue sans solution de secours distante. L’application ne télécharge pas de modèle supplémentaire.
Le japonais en romaji n’est pas pris en charge par cet essai.
L’analyse est limitée à 15 minutes et divisée en extraits de 40 secondes pour limiter la taille des requêtes. Les coupures peuvent affecter les mots situés aux frontières.
Elle s’arrête lors du passage en arrière-plan. Aucun traitement automatique permanent ni analyse de toute la bibliothèque.
Les repères ne sont pas enregistrés sans validation. Les anciens restent en place en cas d’échec ou d’annulation.
Une fois enregistrés, le modèle n’est plus sollicité pour la lecture. Relancer l’analyse nécessite une action explicite.
Il n’y a pas encore de file d’attente ni de mode « recharge uniquement ».

## Installation et vérification
Cette version ajoute un module natif : reconstruire l’IPA par GitHub Actions et l’installer par-dessus Peak Music sans désinstaller.
L’export JavaScript iOS et les 66 tests automatisés passent. Les dépendances npm restent identiques.
La compilation Swift/Speech et l’utilisation sur iPhone ne peuvent pas être vérifiées dans cet environnement Linux.
Il faut tester quelques morceaux connus avant de compter sur cette fonction : exactitude des repères, annulation, conservation après redémarrage, fonctionnement hors ligne.
Aucune mesure de consommation, de vitesse ou de précision réelle sur le chant n’est annoncée.

Commit : feat: preserve synced lyrics and add experimental on-device alignment

Références Apple :
https://developer.apple.com/documentation/speech/sfspeechrecognizer/supportsondevicerecognition
https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition
https://developer.apple.com/documentation/speech/sftranscriptionsegment
