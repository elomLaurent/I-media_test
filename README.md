Je vais te structurer un **README.md professionnel**, clair pour un recruteur DevOps/Backend et directement utilisable sur **GitHub**.
Je vais aussi organiser l'information pour qu'elle **réponde exactement aux exigences du test** (architecture, exécution, CI/CD, questions techniques, etc.).

Voici une **version bien structurée du README** que tu peux adapter selon ton implémentation.

---

# Backend / DevOps Technical Test

API REST de gestion d’utilisateurs avec **Docker**, **PostgreSQL** et **pipeline CI/CD**.

## Informations du test

* **Début** : 02 Mars 2026 — 08h00
* **Durée maximale** : 48 heures
* **Rendu** : 03 Mars 2026 avant 18h00
* **Type** : Test technique Backend / DevOps

Objectif du test :

Construire une **API REST de gestion d’utilisateurs**, la **containeriser avec Docker**, puis mettre en place un **pipeline CI/CD automatisé** qui :

* exécute les tests
* build l’image Docker
* push l’image vers un registry
* simule ou effectue un déploiement

---

# Stack Technique

Les technologies utilisées dans ce projet sont :

### Backend

* **Framework** : NestJS
* **Langage** : TypeScript
* **ORM** : TypeORM
* **Base de données** : PostgreSQL

### Infrastructure

* Docker
* Docker Compose

### CI/CD

Pipeline implémenté avec **GitHub Actions** sur **GitHub**.

Fonctionnalités du pipeline :

* exécution des tests
* build image Docker
* push vers registry
* simulation de déploiement

---

# Architecture du projet

Structure simplifiée :

```
src
 ├── modules
 │   └── users
 │       ├── controllers
 │       ├── services
 │       ├── entities
 │       └── dto
 │
 ├── health
 │   └── health.controller.ts
 │
 ├── config
 │
 └── main.ts
```

Principe d’architecture :

* **Controller** → gestion HTTP
* **Service** → logique métier
* **Entity** → modèle base de données
* **DTO** → validation des données entrantes

Cette séparation garantit :

* maintenabilité
* testabilité
* séparation des responsabilités

---

# Endpoints API

## Health Check

Endpoint permettant de vérifier l’état de l’API et de la base de données.

```
GET /health
```

### Réponse

```
200 OK
```

```json
{
  "status": "ok",
  "timestamp": "2026-03-10T09:45:00.000Z",
  "version": "1.0.0",
  "db_status": "connected"
}
```

Si PostgreSQL est indisponible :

```
503 Service Unavailable
```

---

# Création d’un utilisateur

```
POST /users
```

### Body

```json
{
  "name": "Alice",
  "email": "alice@test.com"
}
```

### Validation

* name

  * requis
  * max 100 caractères

* email

  * requis
  * format email valide

### Réponses possibles

#### Succès

```
201 Created
```

```json
{
  "id": "uuid",
  "name": "Alice",
  "email": "alice@test.com",
  "created_at": "2026-03-10T09:45:00.000Z"
}
```

#### Validation invalide

```
400 Bad Request
```

#### Email déjà existant

```
409 Conflict
```

---

# Liste des utilisateurs

```
GET /users
```

### Réponse

```
200 OK
```

```json
[
  {
    "id": "uuid",
    "name": "Alice",
    "email": "alice@test.com",
    "created_at": "2026-03-10T09:45:00.000Z"
  }
]
```

Si aucun utilisateur :

```
[]
```

---

# Variables d’environnement

Un fichier `.env.example` est fourni.

```
API_PORT=3000
NODE_ENV=development

DB_HOST=db
DB_PORT=5432
DB_NAME=users_db
DB_USER=appuser
DB_PASSWORD=changeme
```

Le fichier `.env` réel est ignoré par Git via `.gitignore`.

---

# Docker

## Dockerfile

Le Dockerfile utilise un **multi-stage build** :

Stage 1 — build
Stage 2 — runtime léger

Objectifs :

* réduire la taille de l’image
* améliorer la sécurité
* supprimer les dépendances inutiles

Caractéristiques :

* image alpine
* utilisateur non-root
* WORKDIR défini
* port exposé

---

# Docker Compose

Le projet peut être lancé avec :

```
docker compose up --build
```

Services :

* API
* PostgreSQL

Fonctionnalités configurées :

* volume persistant PostgreSQL
* réseau dédié
* healthcheck DB
* healthcheck API
* dépendance API → DB

---

# Tests

Les tests sont exécutés avec **Jest**.

Exécution locale :

```
npm run test
```

Dans le pipeline CI/CD, les tests sont exécutés avant le build Docker.

Si un test échoue :

* le pipeline s’arrête
* l’image n’est pas build

---

# Pipeline CI/CD

Le pipeline est implémenté avec **GitHub Actions**.

Fichier :

```
.github/workflows/ci-cd.yml
```

## Structure

Le pipeline comporte 4 jobs :

### 1 Tests

* installation dépendances
* exécution tests

### 2 Build

* build image Docker

### 3 Push

* push vers registry

### 4 Deploy

* simulation de déploiement

---

# Versionnement des images Docker

Les images sont taggées avec :

* `latest` → branche main
* `sha-<commit>` → traçabilité
* `version` → tags Git

Exemple :

```
docker.io/username/api:latest
docker.io/username/api:sha-abc123
docker.io/username/api:1.0.0
```

Créer une nouvelle version :

```
git tag v1.0.0
git push --tags
```

Le pipeline publiera automatiquement l’image correspondante.

---

# Questions Techniques

## Q1 — Différence entre image Docker et container

Une **image Docker** est un template immuable utilisé pour créer des containers.

Elle est composée de **layers** empilés.

Commandes utiles :

```
docker images
```

Un **container** est une instance en exécution d’une image.

Il possède :

* un filesystem éphémère
* un processus principal

Commandes :

```
docker run
docker ps
```

Analogie :

Image = blueprint
Container = bâtiment construit à partir du blueprint.

---

## Q2 — Différence entre CMD et ENTRYPOINT

`CMD`

* définit la commande par défaut

`ENTRYPOINT`

* définit le processus principal du container

Exemple :

```
ENTRYPOINT ["node"]
CMD ["app.js"]
```

Commande exécutée :

```
node app.js
```

Si on lance :

```
docker run image server.js
```

Le résultat sera :

```
node server.js
```

---

## Q3 — Sécurisation d’un pipeline CI/CD

Mesures importantes :

1. secrets dans variables sécurisées
2. scan vulnérabilités images Docker
3. protection branches main
4. limitation des permissions CI
5. dépendances verrouillées

Exemples :

```
GitHub Secrets
Trivy scan
branch protection rules
```

---

## Q4 — Gestion des environnements

Environnements :

* dev
* staging
* production

Stratégie :

* branches Git dédiées
* variables d’environnement
* configuration docker différente

Pipeline :

```
dev → tests → staging → production
```

---

## Q5 — Container qui redémarre en boucle

Diagnostic :

1. vérifier les containers

```
docker ps
```

2. inspecter logs

```
docker logs container
```

3. inspecter container

```
docker inspect container
```

Exit codes :

* 0 → arrêt normal
* 1 → erreur application
* 137 → kill par OOM
* 143 → arrêt SIGTERM

Causes fréquentes :

* crash application
* problème connexion DB
* mémoire insuffisante

---

# Améliorations possibles

Avec plus de temps :

* cache Redis
* scan sécurité avec Trivy
* reverse proxy Nginx
* déploiement VPS automatisé
* monitoring Prometheus / Grafana

---

Si tu veux, je peux aussi te faire **une version encore plus forte pour impressionner le recruteur**, par exemple :

* diagramme d’architecture
* diagramme pipeline CI/CD
* diagramme Docker network
* README **niveau senior DevOps**

(et ça peut vraiment faire la différence lors du débrief).
