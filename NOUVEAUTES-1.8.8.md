# Peak Music 1.8.8
- Lancer une analyse locale ne met plus explicitement le lecteur en pause.
- Un extrait pour lequel iOS répond « No speech detected » est ignoré ; les extraits suivants sont analysés avec leurs positions réelles dans le morceau.
- Si aucune voix n’est reconnue sur tout le morceau, un message français explique la limite du moteur. Les autres erreurs restent bloquantes.
- Les erreurs affichées ne contiennent plus la trace interne Expo.
- Le fond violet des paroles actives est remplacé par un fin contour blanc et un halo doux, avec un fondu de 280 ms.
- Le fondu respecte le réglage Réduire les animations. Aucun clignotement ni animation en boucle.
- Les repères sauvegardés sont conservés.

Le moteur iOS reste expérimental pour le chant. Ces corrections ne garantissent pas la reconnaissance de Cherry Waves ou d’un remix donné.
Vérifications : 69 tests automatisés et export JavaScript iOS. La compilation native, la reconnaissance sur le morceau réel et le rendu sur iPhone restent à vérifier.
Reconstruire l’IPA et installer par-dessus Peak Music sans désinstaller.
Commit : fix: handle instrumental segments and animate white lyric glow
