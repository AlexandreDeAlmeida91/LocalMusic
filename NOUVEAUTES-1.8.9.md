# Peak Music 1.8.9 — Alignement par repères partiels
L’analyse ne rejette plus tout le résultat à cause d’une première ligne non reconnue.
Elle conserve les correspondances suffisamment fortes trouvées dans le texte, dans l’ordre de l’audio.
Une phrase peut servir de repère même si son premier mot n’a pas été reconnu : elle est alors étiquetée Estimée, car le début affiché correspond au premier mot reconnu.
Les courts trous entre deux repères peuvent être estimés selon le nombre de mots (3 lignes et 20 secondes maximum). Cette estimation ne mesure pas le chant et doit être vérifiée.
Aucune extrapolation avant le premier repère ni après le dernier.
Les longues zones inconnues restent sans horaire et sans animation.
L’aperçu affiche le nombre de lignes datées et distingue Détectée, Estimée et Non repérée.
Les repères sont sauvegardés uniquement après validation. Les anciennes synchronisations complètes restent compatibles.
Les refrains répétés et les remixes restent susceptibles d’erreurs : écouter les propositions avant de valider.

Validation : 74 tests automatisés réussis et export JavaScript iOS réussi.
Tests ciblés : première ligne inconnue, ancrage plus loin, premier mot manquant, courte interpolation bornée, absence d’extrapolation, sauvegarde JSON et lecture des repères partiels, rejet de chronologies invalides.
La qualité sur le morceau réel reste à tester sur iPhone.
Reconstruire l’IPA et installer par-dessus Peak Music sans désinstaller.
Commit : feat: align lyrics from partial anchors and preserve unmatched lines
