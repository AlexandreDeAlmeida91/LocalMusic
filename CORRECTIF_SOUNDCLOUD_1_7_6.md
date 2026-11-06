# Peak Music 1.7.6 — SoundCloud direct

Les deux liens fournis (snowlightt/rise-again-snowlight-nxc et lil_peep/kiss-prod-smokeasac) proposent des flux AAC complets à 160 et 96 kb/s. Leur endpoint et leurs segments utilisent playback.media-streaming.soundcloud.cloud, absent de la liste des domaines acceptés par Peak Music.

Ce refus provoquait le repli vers YouTube avant le téléchargement. La correction ajoute le domaine observé à la validation JavaScript et Swift (manifestes, segments et redirections). Les contrôles HTTPS, hôte, identifiants et flux protégés sont conservés. La qualité 160 kb/s reste prioritaire ; l’AAC est conservé sans réencodage et le M4A est normalisé comme en 1.7.5.

Vérifications : requêtes réelles aux deux pages et aux endpoints, accès aux manifestes complets, sans EXT-X-KEY. 33 tests JavaScript réussis, dont préparation HLS directe sans recherche YouTube et rejet d’un domaine ressemblant. Le téléchargement complet et la lecture sur iPhone ne sont pas vérifiés ici. Le test natif macOS ajouté en 1.7.5 reste dans GitHub Actions.

Installation : remplacer le projet complet dans le dépôt, reconstruire l’IPA et installer avec SideStore par-dessus l’application existante sans désinstaller. Réessayer les liens SoundCloud. Le repli vers YouTube reste disponible pour d’autres morceaux réellement incompatibles.
