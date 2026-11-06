# Peak Music 1.7.5 — correction du contrôle AAC

La version 1.7.4 rejetait tout bloc AAC dont CMSampleBufferGetDuration ne donnait pas une durée positive, même lorsque les informations de paquets permettaient de la calculer. La capture utilisateur confirme le rejet par ce contrôle ; elle ne permet pas à elle seule de distinguer une durée manquante d’une position manquante.

Le nouveau code utilise la durée fournie lorsqu’elle est valide. Sinon il calcule la durée à partir des descriptions de paquets et du format AAC (frames par paquet / fréquence). Les canaux ne multiplient jamais cette durée. Les blocs vides sans données sont ignorés. Une position absente ou des données réellement incohérentes restent une erreur avec un message distinct.

Le flux AAC reste copié sans réencodage. Les originaux des morceaux déjà en bibliothèque restent intacts. Pour un nouvel import qui échoue, le fichier source reste dans le cache temporaire seulement et n’est pas garanti après le prochain téléchargement.

## Installation
Copier tout le projet, y compris modules, tests, scripts et .github/workflows. Lancer GitHub Actions puis installer l’IPA via SideStore par-dessus Peak Music, sans désinstallation. Réessayer le même lien. Pour les anciens morceaux : menu ••• → Réparer la durée du morceau.

## Vérification
31 tests JavaScript réussis localement. Les modifications de cette version concernent Swift, la version et les tests ; le bundle JavaScript fonctionnel reste celui de 1.7.4.

Un nouveau test natif macOS fait partie de GitHub Actions AVANT la construction de l’IPA. Il utilise un son synthétique de 2,23 secondes (440 Hz, stéréo AAC 44,1 kHz), teste une durée manquante, vérifie que les données AAC sont identiques avant/après et que la durée ne double pas. Aucun morceau utilisateur n’est inclus.

Ce test natif ne peut pas être exécuté ici (Linux sans AVFoundation). Il devra réussir sur GitHub Actions ; la lecture sur iPhone reste à vérifier. La correction vise la durée AAC manquante, sans prétendre avoir reproduit le fichier « Kiss » sur appareil.
