# Mise à jour vers LocalMusic V1.3

Depuis ton projet actuel :

1. Remplace les fichiers avec le contenu de l'archive `LocalMusic-v1.3-update-only.zip`.
2. Dans VS Code :

```powershell
npm install
npx expo install --fix
npx expo-doctor
```

3. Quand Expo Doctor est bon :

```powershell
git add .
git commit -m "LocalMusic V1.3 native lock screen controls"
git push
```

4. GitHub :

```text
Actions
→ Build iOS IPA for SideStore
→ Run workflow
```

5. Télécharge l'artifact `LocalMusic-iOS-IPA`.
6. Récupère `LocalMusic-unsigned.ipa`.
7. Mets-le dans Fichiers sur l'iPhone.
8. Active LocalDevVPN.
9. SideStore → My Apps → + → sélectionne l'IPA.

**Ne supprime pas l'ancienne application avant.**
Installe la V1.3 par-dessus afin de conserver les MP3 et playlists.

## Test recommandé

Après l'installation :

1. ouvre LocalMusic ;
2. lance une playlist de plusieurs morceaux ;
3. verrouille l'iPhone ;
4. vérifie le titre et la pochette ;
5. teste lecture / pause ;
6. teste précédent / suivant ;
7. déplace la barre de progression ;
8. laisse un morceau se terminer pour vérifier le passage automatique ;
9. teste Aléatoire ;
10. teste Boucle tout puis Boucle 1.
