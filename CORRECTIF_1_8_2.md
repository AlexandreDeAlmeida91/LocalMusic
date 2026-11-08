# Peak Music 1.8.2

Corrige le fichier package-lock.json : le remplacement global de 1.8.0 par
1.8.1 avait modifié par erreur @expo/spawn-async et les contraintes de ses
consommateurs. Les entrées des dépendances sont restaurées à l’identique
à partir du verrouillage 1.7.9 ; seule la version du projet est mise à jour.

Conserve le correctif FileSystem et l’isolation des erreurs de paroles de 1.8.1.
Remplacer aussi package-lock.json dans GitHub, créer un nouveau commit, puis
lancer le workflow sur ce nouveau commit. Ne pas relancer l’ancien commit échoué.
