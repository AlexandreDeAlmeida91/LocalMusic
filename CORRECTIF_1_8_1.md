# Peak Music 1.8.1

Corrige l’import FileSystem manquant dans MusicContext qui empêchait
l’enregistrement du TXT puis déclenchait une deuxième erreur lors du nettoyage.
Une erreur de sauvegarde des paroles ne remplace plus le statut « Ajouté » du son.

Installer la nouvelle IPA par-dessus la version actuelle sans désinstaller.
Pour les morceaux déjà ajoutés, ouvrir Paroles > Rechercher les paroles en ligne.
Il n’est pas nécessaire de télécharger à nouveau le son.

Tests : écriture du TXT et association à l’identifiant ; erreur disque et nettoyage ;
préservation des paroles existantes. Export iOS Expo, sans test sur iPhone physique.
