# Peak Music 1.8.20 — lecture iOS

- Boucle native : attendre la fin du retour à zéro avant de relancer le morceau. Une pause ou un changement de morceau annule une relance devenue obsolète.
- Synchronisation des préférences de boucle et de lecture aléatoire avec le lecteur natif après leur chargement.
- Commandes iOS gérées directement par le lecteur natif. Réactivation de la session audio et actualisation des informations de lecture lors des reprises et transitions de l’application.
- Page de lecture : taille de pochette adaptée, espacements réduits et défilement disponible pour accéder au volume sur les petits écrans.

## Vérifications
104 tests JavaScript réussis ; export iOS réussi. Test de séquencement Swift ajouté au workflow GitHub. Compilation native et essais sur iPhone non exécutés dans cet environnement.

## Installation et essais
Remplacer les fichiers du projet, pousser sur GitHub puis reconstruire l’IPA. Installer la mise à jour sans désinstaller Peak Music.

Tester Boucle 1 près de la fin du morceau, dans le lecteur puis écran verrouillé ; vérifier aussi Boucle tout. Tester les commandes de l’écran verrouillé, une pause pendant le retour au début et l’accès au volume. Ces essais sur appareil restent nécessaires pour confirmer la correction des problèmes intermittents.
