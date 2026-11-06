# Peak Music 1.7.9 — recherches YouTube simplifiées

Les noms d’artistes et titres sont normalisés avant l’envoi à YouTube : étoiles, décorations et ponctuation sont remplacées par des espaces ; lettres et chiffres Unicode restent pris en charge. Les titres affichés et les métadonnées conservées ne sont pas modifiés.

Recherche initiale : artiste + titre + official audio. Si aucun résultat exploitable n’est extrait, ou si la requête échoue, un second essai utilise artiste + titre. Maximum deux recherches, annulation respectée. Aucun contournement d’une restriction YouTube n’est ajouté.

Les critères de sélection automatique restent identiques : titre, artiste, durée et absence de version différente. Les résultats ambigus demandent toujours un choix. La détection des doublons reste fondée sur les liens/identifiants, conformément au choix de l’utilisateur.

Après deux échecs, le message propose un lien YouTube direct plutôt que d’affirmer que la vidéo n’existe pas. Cette amélioration ne garantit pas que YouTube renverra des résultats pour chaque requête.

Installation : remplacer le projet complet, reconstruire l’IPA avec GitHub Actions, installer par-dessus Peak Music sans désinstaller.

Validation : 41 tests JavaScript, incluant artiste décoré, premier résultat vide suivi de recherche simplifiée, absence de sélection automatique d’un live et limite des tentatives. Export iOS généré. Pas de validation sur iPhone ici ; réessayer les liens VIRA et Deftones après installation.
