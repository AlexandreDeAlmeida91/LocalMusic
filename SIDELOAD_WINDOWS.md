# LocalMusic — installation gratuite sur iPhone depuis Windows

Cette variante du projet utilise :

1. **Windows** pour développer l'application.
2. **GitHub Actions** sur un runner macOS pour compiler l'application iOS.
3. **SideStore** pour signer l'IPA avec un compte Apple gratuit et l'installer sur l'iPhone.
4. Un **rafraîchissement avant 7 jours** pour conserver l'application utilisable.

Aucun Mac personnel et aucun abonnement Apple Developer payant ne sont nécessaires.

---

## A. Créer le dépôt GitHub

Le plus simple pour rester entièrement gratuit est de créer un dépôt GitHub **public**.

1. Crée un compte GitHub si nécessaire.
2. Crée un nouveau dépôt, par exemple :

   `LocalMusic`

3. Décompresse ce projet.
4. Ouvre le dossier `LocalMusicExpoV1` dans VS Code.
5. Dans le terminal :

```powershell
git init
git add .
git commit -m "LocalMusic V1"
git branch -M main
git remote add origin https://github.com/TON-COMPTE/LocalMusic.git
git push -u origin main
```

Si Git n'est pas installé, tu peux aussi envoyer les fichiers depuis l'interface web de GitHub.

### Important

Un dépôt public rend le **code source** visible publiquement.

Tes MP3 ne sont pas présents dans le dépôt : ils sont importés uniquement sur l'iPhone une fois l'application installée.

---

## B. Compiler le fichier IPA gratuitement

Le projet contient déjà :

```text
.github/workflows/build-ios-sidestore.yml
```

Sur GitHub :

1. Ouvre ton dépôt.
2. Va dans l'onglet **Actions**.
3. Clique sur **Build iOS IPA for SideStore**.
4. Clique sur **Run workflow**.
5. Attends la fin du build.

Si tout est vert, ouvre l'exécution terminée.

Dans la section **Artifacts**, télécharge :

```text
LocalMusic-iOS-IPA
```

GitHub télécharge un ZIP.

Décompresse-le et tu obtiendras :

```text
LocalMusic-unsigned.ipa
```

Cet IPA n'est volontairement pas signé. SideStore le signera avec ton compte Apple gratuit.

---

## C. Installer SideStore sur l'iPhone depuis Windows

Suis la documentation officielle SideStore pour l'installation initiale.

La première installation nécessite notamment :

- ton PC Windows ;
- l'iPhone relié au PC ;
- un compte Apple ;
- une connexion Wi-Fi ;
- LocalDevVPN sur l'iPhone.

Après l'installation, iOS peut demander :

```text
Réglages
→ Général
→ VPN et gestion de l'appareil
→ faire confiance à ton compte Apple
```

Puis :

```text
Réglages
→ Confidentialité et sécurité
→ Mode développeur
```

Active le Mode développeur si iOS le demande.

---

## D. Installer LocalMusic

Une fois SideStore fonctionnel :

1. Transfère `LocalMusic-unsigned.ipa` sur l'iPhone.

Le plus simple :
- iCloud Drive ;
- OneDrive ;
- Google Drive ;
- e-mail à toi-même ;
- ou tout autre stockage accessible depuis l'app Fichiers.

2. Sur l'iPhone, ouvre **SideStore**.
3. Ouvre **My Apps**.
4. Appuie sur `+`.
5. Sélectionne :

```text
LocalMusic-unsigned.ipa
```

6. SideStore signe l'application avec ton compte Apple.
7. Attends la fin de l'installation.

Tu devrais ensuite avoir **LocalMusic** directement sur l'écran d'accueil.

---

## E. Tester la lecture écran verrouillé

Dans LocalMusic :

1. Importe un MP3.
2. Lance la musique.
3. Verrouille l'iPhone.

La configuration native du projet contient le mode audio en arrière-plan.

Le son doit donc continuer avec l'écran éteint.

Les contrôles de lecture peuvent également apparaître sur l'écran verrouillé :

```text
précédent
lecture / pause
suivant
```

ainsi que le titre, l'artiste et la pochette lorsque les métadonnées sont disponibles.

---

## F. Renouvellement avant 7 jours

Avec un compte Apple gratuit, l'application signée expire au bout de 7 jours.

Il n'est pas nécessaire de recompiler l'application toutes les semaines si le fichier IPA n'a pas changé.

Avant l'expiration :

1. Active **LocalDevVPN**.
2. Ouvre **SideStore**.
3. Va dans **My Apps**.
4. Rafraîchis LocalMusic.

SideStore resigne l'application.

Tes fichiers MP3 et ta bibliothèque devraient rester dans les données de l'application lors d'un simple rafraîchissement de signature.

Il est préférable de rafraîchir avant la fin des 7 jours.

---

## G. Quand faut-il refaire un build GitHub ?

Seulement lorsque tu modifies le code de LocalMusic.

Par exemple :

```text
ancienne version
     ↓
modification du code
     ↓
git add .
git commit
git push
     ↓
GitHub Actions
     ↓
nouvel IPA
     ↓
SideStore
```

Pour simplement renouveler la signature tous les 7 jours :

```text
pas besoin de GitHub Actions
```

SideStore suffit.

---

## Dépannage

### Le workflow GitHub est rouge

Ouvre l'étape qui a échoué dans GitHub Actions et copie-moi le message d'erreur.

### Le son s'arrête encore quand l'iPhone se verrouille

Vérifie d'abord que tu exécutes bien l'application **LocalMusic installée par SideStore**, et non le projet dans Expo Go.

### L'application ne s'ouvre plus après plusieurs jours

Ouvre SideStore, active LocalDevVPN et rafraîchis l'application.

### SideStore n'arrive pas à rafraîchir

Vérifie :
- Wi-Fi actif ;
- LocalDevVPN connecté ;
- compte Apple toujours connecté dans SideStore.
