# Peak Music 1.7.2 — démarrage des imports

Correction de l’appel à AbortSignal.throwIfAborted dans l’expansion des playlists : certaines implémentations mobiles ne proposent pas cette méthode. L’appel échouait avant la première requête, y compris pour un lien de vidéo individuel. Le code teste désormais la propriété aborted et lève une erreur d’annulation explicite, sans dépendre de la méthode optionnelle.

Les lignes encore en attente passent en échec si la préparation globale échoue.

Le problème a été reproduit par deux tests avec un signal sans throwIfAborted, puis corrigé : 24 tests réussissent. Export du bundle iOS réalisé. Exécution sur appareil et compilation Xcode à confirmer.

Cette archive contient aussi le correctif de durée 1.7.1. Remplacer les fichiers du dépôt, y compris scripts, lancer GitHub Actions puis installer l’IPA via SideStore par-dessus l’application existante. Ne pas désinstaller.

Commit : Corrige le démarrage des imports sur iPhone
