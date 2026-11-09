# Peak Music 1.8.5 — Synchronisation manuelle

Ouvrir un morceau, puis Paroles. Ajouter le texte si nécessaire.
1. Toucher « Synchroniser depuis le début » : la lecture repart à zéro.
2. À chaque début de ligne chantée, toucher « Cette ligne commence maintenant ».
   La ligne à marquer est surlignée en violet.
3. « Pause / Lecture » permet de prendre une pause.
   « Annuler le dernier » retire le dernier repère et revient deux secondes avant pour le refaire.
4. Une fois toutes les lignes marquées, la lecture se met en pause. Toucher « Enregistrer les repères ».
5. Aux prochaines écoutes, la ligne active est surlignée et défile selon la position du lecteur, y compris après un déplacement dans le morceau.

Les refrains doivent être écrits en entier à chaque répétition (pas « x2 »).
Les lignes vides sont ignorées. Ne pas inclure les titres de sections comme des lignes à chanter.
Le défilement manuel désactive le suivi ; toucher « Défilement automatique » pour le réactiver.
La synchronisation précédente reste conservée jusqu'à l'enregistrement d'une nouvelle.
Modifier/remplacer le texte annule les anciens repères. Les repères sont stockés dans la bibliothèque locale avec le morceau, disponibles hors connexion.
La synchronisation est ligne par ligne, sans IA. La dernière ligne reste surlignée jusqu'à la fin du morceau.

Installation : remplacer les fichiers du projet GitHub, reconstruire l'IPA, installer par-dessus l'application sans la désinstaller.
Commit : feat: add manual lyrics timing and synchronized highlighting

Validation : tests automatisés de chronologie, sauvegarde/échec, export JavaScript iOS.
La compilation IPA et le test sur iPhone restent à effectuer.
