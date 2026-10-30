# Peak Music 1.6.1 — correctif bêta

## SoundCloud

Le lien fourni redirigeait vers une page mobile dépourvue des données attendues. Les requêtes utilisent désormais la version classique du site et les liens mobiles sont normalisés. Le client de la page est prioritaire sur le cache (durée limitée à cinq minutes).

Pour le morceau « the cure », la page classique fournit les métadonnées mais les flux observés sont protégés. Le moteur ne les déchiffre pas. Il propose de choisir une correspondance YouTube : aucune autre source n’est téléchargée automatiquement.

## YouTube

Le moteur conserve plusieurs adresses pour un même format, les en-têtes du client correspondant et la bonne association entre réponse et flux. Il attend six secondes avant le premier accès puis essaie au maximum six adresses par extraction et deux extractions en cas de refus 403/410. Un refus persistant reste un échec explicite.

Ces changements constituent un correctif à tester sur iPhone : la cause exacte du 403 de la capture n’a pas été confirmée. Ils ne garantissent pas le téléchargement de chaque lien.

## Validation et installation

18 tests JavaScript réussis et bundle iOS exporté. Pas de compilation Swift/Xcode ni de téléchargement de bout en bout sur iPhone dans cet environnement.

Reconstruire l’IPA avec le workflow GitHub Actions inclus, puis l’installer via SideStore par-dessus Peak Music. Ne pas désinstaller l’application. Le moteur fonctionne toujours sur le téléphone, sans serveur de conversion.

Commit proposé : `Corrige les imports SoundCloud et améliore les essais YouTube après un refus 403`.
