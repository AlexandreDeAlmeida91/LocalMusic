# À FAIRE MAINTENANT — avant d'avoir le câble iPhone

Tu peux aller jusqu'au fichier `LocalMusic-unsigned.ipa` sans brancher l'iPhone.

## 1. Ouvrir le projet

Décompresse l'archive et ouvre le dossier `LocalMusicExpoV1` dans VS Code.

Dans le terminal :

```powershell
npm install
npx expo install --fix
npx expo-doctor
```

Si `expo-doctor` ne signale plus d'erreur bloquante, continue.

## 2. Vérifier que l'application fonctionne encore dans Expo Go

```powershell
npx expo start
```

Teste :
- import d'un MP3 ;
- lecture/pause ;
- morceau suivant/précédent ;
- barre de progression.

L'arrêt lors du verrouillage dans Expo Go n'est pas le test définitif du background audio.

## 3. Préparer Git

Vérifie :

```powershell
git --version
```

Si Git n'est pas reconnu, installe Git for Windows.

Puis, à la racine du projet :

```powershell
git init
git add .
git commit -m "LocalMusic V1"
git branch -M main
```

## 4. Créer le dépôt GitHub

Crée un dépôt GitHub nommé :

```text
LocalMusic
```

Un dépôt public est le plus simple pour utiliser les runners GitHub Actions sans facturation de minutes standard.

Ne mets pas de README, .gitignore ou licence depuis l'écran GitHub si ton dossier local contient déjà ces fichiers.

Copie ensuite l'URL HTTPS du dépôt.

Dans VS Code :

```powershell
git remote add origin https://github.com/TON-COMPTE/LocalMusic.git
git push -u origin main
```

## 5. Compiler l'IPA

Sur GitHub :

```text
LocalMusic
→ Actions
→ Build iOS IPA for SideStore
→ Run workflow
→ Run workflow
```

Le workflow se trouve déjà dans :

```text
.github/workflows/build-ios-sidestore.yml
```

Attends que le build soit vert.

## 6. Télécharger l'IPA

Ouvre l'exécution réussie.

En bas de la page, dans `Artifacts`, télécharge :

```text
LocalMusic-iOS-IPA
```

Décompresse le ZIP téléchargé.

Tu dois obtenir :

```text
LocalMusic-unsigned.ipa
```

Garde ce fichier sur ton PC.

Tu peux aussi le déposer dans iCloud Drive / OneDrive / Google Drive pour pouvoir le récupérer plus tard depuis l'iPhone.

# Préparer SideStore sans câble

Tu peux également faire ces préparatifs maintenant :

## Sur l'iPhone

Installe `LocalDevVPN` depuis l'App Store.

Tu peux autoriser sa configuration VPN dès maintenant.

## Sur Windows

Installe iTunes. SideStore recommande de préférence la version directement fournie par Apple ; si elle pose problème, l'app Apple Devices peut servir d'alternative.

Installe ensuite la dernière version officielle d'`iloader` pour Windows.

Tu peux lancer iloader pour vérifier qu'il s'ouvre, mais l'installation de SideStore elle-même devra attendre le câble.

# STOP : ce qui attend le câble

Quand tu auras un câble USB :

```text
iPhone → PC
→ Faire confiance à cet ordinateur
→ ouvrir iloader
→ connexion Apple Account
→ sélectionner l'iPhone
→ Install SideStore (Stable)
```

Puis sur l'iPhone :

```text
Réglages
→ Général
→ VPN et gestion de l'appareil
→ faire confiance à l'application développeur
```

Sur iOS 16+ :

```text
Réglages
→ Confidentialité et sécurité
→ Mode développeur
```

Ensuite :

```text
LocalDevVPN → Connect
SideStore → connexion Apple Account
My Apps → rafraîchir SideStore
+ → sélectionner LocalMusic-unsigned.ipa
```

À ce moment-là, LocalMusic sera une vraie application iOS installée sur l'iPhone et le test de lecture écran verrouillé sera pertinent.
