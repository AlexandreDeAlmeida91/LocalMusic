# LocalMusic V1.3.2 — commandes écran verrouillé

Ce correctif cible uniquement les commandes iOS de l'écran verrouillé.

## Problème observé

La carte Now Playing apparaissait et lecture/pause fonctionnait, mais :
- précédent était grisé ;
- suivant était grisé ;
- la barre de durée ne permettait pas de déplacer la lecture.

Les commandes RNTP étaient configurées au démarrage du lecteur, alors que
la file était encore vide. iOS pouvait conserver cet état désactivé même
après le chargement des morceaux.

## Correctif

Les commandes système suivantes sont désormais reconfigurées :
- juste avant le chargement d'une nouvelle file ;
- juste après `setMediaItems`;
- après application de shuffle/répétition ;
- après le démarrage effectif de la lecture.

Commandes :
- Play/Pause
- Previous
- Next
- Seek

Le traitement reste `native`, donc ces actions ne dépendent pas du thread
JavaScript lorsque l'iPhone est verrouillé.

## Test

1. Lancer un morceau depuis une bibliothèque contenant au moins 2 morceaux.
2. Verrouiller l'iPhone.
3. Vérifier que les flèches précédent/suivant ne sont plus grisées.
4. Tester les deux flèches.
5. Faire glisser la barre de progression.
6. Refaire le test depuis une playlist contenant plusieurs morceaux.
