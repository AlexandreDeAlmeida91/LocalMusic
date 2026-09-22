# LocalMusic Expo V1

Une application React Native + Expo qui permet d'importer des fichiers MP3 depuis l'app **Fichiers** de l'iPhone, de les copier dans le stockage privé de l'application et de les écouter hors ligne.

Le projet cible **Expo SDK 57 stable / React Native 0.86**.

## Fonctions de cette V1

- Import de plusieurs MP3 depuis Fichiers / iCloud Drive
- Copie permanente dans le stockage local de l'application
- Bibliothèque persistante
- Lecture 100 % hors ligne
- Lecture / pause
- Morceau précédent / suivant
- Passage automatique au morceau suivant
- Barre de progression avec seek
- Volume
- Mini-player
- Lecteur plein écran
- Lecture en arrière-plan
- Métadonnées de l'écran verrouillé
- Titre, artiste, album et pochette lus depuis les tags ID3v2.3/v2.4
- Suppression d'un morceau par appui long

## 1. Installer les outils sur Windows

Installe :

1. Node.js 22.13 ou plus récent
2. Visual Studio Code
3. Git (optionnel mais conseillé)

Puis ouvre PowerShell dans le dossier du projet.

## 2. Installer les dépendances

```powershell
npm install
npx expo install --fix
```

Vérifie ensuite le projet :

```powershell
npx expo-doctor
```

## 3. Tester pendant le développement

Lance :

```powershell
npx expo start
```

Tu peux utiliser Expo Go pour tester une grande partie de l'interface.

Important : la configuration native `enableBackgroundPlayback` n'est réellement appliquée qu'après création d'un build natif. Pour tester correctement la lecture en arrière-plan / écran verrouillé, utilise un build EAS.

## 4. Créer ton compte Expo

```powershell
npx eas-cli@latest login
```

Si tu n'as pas encore de compte, crée-en un sur expo.dev.

Puis lie/configure le projet :

```powershell
npx eas-cli@latest build:configure
```

Le projet contient déjà un `eas.json`, mais cette commande associe notamment le projet local à ton compte Expo.

## 5. Modifier l'identifiant de l'application

Dans `app.json`, remplace si nécessaire :

```json
"bundleIdentifier": "com.alexandre.localmusic"
```

par un identifiant unique, par exemple :

```json
"bundleIdentifier": "fr.tonnom.localmusic"
```

Fais pareil pour `android.package` si tu souhaites aussi Android.

## 6. Enregistrer ton iPhone

Pour une installation interne iOS :

```powershell
npx eas-cli@latest device:create
```

Ouvre le lien/QR code avec l'iPhone et suis les instructions.

Cette étape nécessite un abonnement Apple Developer pour une distribution Ad Hoc.

## 7. Compiler l'application iOS dans le cloud

```powershell
npm run build:ios:preview
```

Ce raccourci exécute :

```powershell
eas build --platform ios --profile preview
```

EAS envoie le projet sur un Mac dans le cloud, exécute la compilation Xcode et signe le `.ipa`.

Pendant le premier build, EAS peut demander tes identifiants Apple afin de créer ou récupérer :
- le certificat de distribution
- l'App ID
- le provisioning profile

Tu peux laisser EAS gérer automatiquement ces éléments.

## 8. Installer sur l'iPhone

À la fin du build, Expo fournit une page avec un QR code / lien.

Ouvre-la sur l'iPhone et installe l'application.

Selon la méthode de build et ta version d'iOS, tu peux devoir activer :

`Réglages > Confidentialité et sécurité > Mode développeur`

## 9. Build production / TestFlight

Quand tu voudras passer par TestFlight :

```powershell
npm run build:ios:production
```

Puis :

```powershell
npx eas-cli@latest submit --platform ios
```

Le build sera envoyé vers App Store Connect.

## Structure

```text
LocalMusicExpoV1/
├── App.js
├── app.json
├── eas.json
├── package.json
├── babel.config.js
└── src/
    ├── components/
    │   ├── Artwork.js
    │   ├── MiniPlayer.js
    │   ├── PlayerModal.js
    │   └── SongRow.js
    ├── context/
    │   └── MusicContext.js
    └── services/
        ├── id3.js
        └── library.js
```

## Notes ID3

Le lecteur ID3 intégré gère les tags ID3v2.3 et ID3v2.4 courants :
- `TIT2` : titre
- `TPE1` : artiste
- `TALB` : album
- `APIC` : pochette

Si un MP3 n'a pas ces informations, l'application utilise le nom du fichier et affiche « Artiste inconnu » / « Album inconnu ».

Pour rester simple, la V1 limite la lecture du bloc ID3 à 8 Mo.

## En cas de problème de versions

Lance :

```powershell
npx expo install --fix
npx expo-doctor
```

Cela permet à Expo d'aligner les versions des dépendances avec le SDK utilisé.

---

## Installation iPhone gratuite sans Mac

Pour la méthode **Windows + GitHub Actions + SideStore**, consulte :

`SIDELOAD_WINDOWS.md`

Le workflow `.github/workflows/build-ios-sidestore.yml` fabrique automatiquement un IPA non signé sur un runner macOS GitHub.
