# Cloud Engineer Technical Test — UserAPI Infrastructure

Infrastructure cloud production-ready pour une API REST de gestion d'utilisateurs, déployée sur AWS EKS avec PostgreSQL RDS, pipeline CI/CD GitHub Actions, et stack de monitoring Prometheus/Grafana.

---

## Architecture Diagram

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  AWS Region : eu-west-1                                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  VPC : 10.0.0.0/16                                   │   │
│  │                                                       │   │
│  │  ┌──────────────┐    ┌──────────────┐               │   │
│  │  │ Public Subnet│    │ Public Subnet│               │   │
│  │  │  AZ-A        │    │  AZ-B        │               │   │
│  │  │ ┌──────────┐ │    │ ┌──────────┐ │               │   │
│  │  │ │   ALB    │ │    │ │ NAT GW   │ │               │   │
│  │  │ └────┬─────┘ │    │ └──────────┘ │               │   │
│  │  └──────┼───────┘    └──────────────┘               │   │
│  │         │                                            │   │
│  │  ┌──────▼───────────────────────────────────────┐   │   │
│  │  │  Private Subnets (EKS Nodes + RDS)           │   │   │
│  │  │                                               │   │   │
│  │  │  ┌────────────────────────────────────────┐  │   │   │
│  │  │  │  EKS Cluster (Kubernetes 1.29)          │  │   │   │
│  │  │  │                                         │  │   │   │
│  │  │  │  Namespace: userapi                     │  │   │   │
│  │  │  │  ┌──────────┐  ┌──────────┐            │  │   │   │
│  │  │  │  │ userapi  │  │ userapi  │  (2-10     │  │   │   │
│  │  │  │  │  pod     │  │  pod     │   replicas)│  │   │   │
│  │  │  │  └─────┬────┘  └────┬─────┘            │  │   │   │
│  │  │  │        └─────┬──────┘                   │  │   │   │
│  │  │  │         ClusterIP Service                │  │   │   │
│  │  │  │                                         │  │   │   │
│  │  │  │  Namespace: monitoring                   │  │   │   │
│  │  │  │  ┌──────────┐  ┌──────────┐            │  │   │   │
│  │  │  │  │Prometheus│  │ Grafana  │            │  │   │   │
│  │  │  │  └──────────┘  └──────────┘            │  │   │   │
│  │  │  └────────────────────────────────────────┘  │   │   │
│  │  │                                               │   │   │
│  │  │  ┌────────────────────┐                      │   │   │
│  │  │  │  RDS PostgreSQL 16 │ (Multi-AZ en prod)   │   │   │
│  │  │  │  Port 5432 (privé) │                      │   │   │
│  │  │  └────────────────────┘                      │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  AWS Services :                                             │
│  • ECR (images Docker)     • Secrets Manager (secrets)     │
│  • S3 (tfstate, ALB logs)  • KMS (chiffrement)             │
│  • DynamoDB (state lock)   • CloudWatch (logs EKS)         │
└─────────────────────────────────────────────────────────────┘
```

**Flux de déploiement CI/CD :**
```
Git push → GitHub Actions → Terraform validate → Trivy scan
         → Build Docker → Push ECR → Helm deploy staging
         → Smoke test → [tag v*] → Approbation manuelle → Deploy prod
```

---

## Structure du repository

```
.
├── README.md
├── .gitignore
├── terraform/
│   ├── main.tf                   # Entrée, orchestration des modules
│   ├── variables.tf              # Variables globales typées et validées
│   ├── outputs.tf
│   ├── backend.tf                # Remote state S3 + DynamoDB
│   ├── terraform.tfvars.example  # Template (jamais les vraies valeurs)
│   └── modules/
│       ├── networking/           # VPC, subnets, NAT, ALB, Security Groups
│       ├── compute/              # EKS cluster, node group, ECR
│       ├── database/             # RDS PostgreSQL
│       └── security/             # IAM roles, Secrets Manager, KMS
├── k8s/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── deployment.yaml           # Production-ready (probes, resources, securityContext)
│   ├── service.yaml              # ClusterIP + Ingress ALB avec TLS
│   ├── rbac/
│   │   ├── rbac.yaml             # ServiceAccount, Role, RoleBinding, NetworkPolicy
│   │   └── external-secrets.yaml # ESO : sync depuis AWS Secrets Manager
│   ├── monitoring/
│   │   └── prometheus-rules.yaml # ServiceMonitor + PrometheusRule (5 alertes)
│   └── helm/
│       ├── Chart.yaml
│       ├── values.yaml
│       ├── values-dev.yaml
│       └── values-prod.yaml
├── .github/workflows/
│   └── ci-cd.yml                 # Pipeline complet : lint → scan → build → deploy
└── scripts/
    ├── README.md
    └── health_report.py          # Rapport de santé cluster avec SDK K8s
```

---

## Déploiement

### Pré-requis

```bash
terraform >= 1.6.0
kubectl >= 1.29
helm >= 3.12
aws-cli >= 2.0
python >= 3.11
```

### 1. Bootstrap du remote state (une seule fois)

```bash
# Créer le bucket S3 et la table DynamoDB pour le state Terraform
aws s3api create-bucket \
  --bucket my-tfstate-bucket-$(aws sts get-caller-identity --query Account --output text) \
  --region eu-west-1 \
  --create-bucket-configuration LocationConstraint=eu-west-1

aws s3api put-bucket-versioning \
  --bucket my-tfstate-bucket-xxx \
  --versioning-configuration Status=Enabled

aws dynamodb create-table \
  --table-name terraform-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-1
```

### 2. Initialisation Terraform

```bash
cd terraform/
cp terraform.tfvars.example terraform.tfvars
# Éditer terraform.tfvars avec vos valeurs

terraform init \
  -backend-config="bucket=my-tfstate-bucket-xxx" \
  -backend-config="key=userapi/prod/terraform.tfstate" \
  -backend-config="region=eu-west-1" \
  -backend-config="dynamodb_table=terraform-lock" \
  -backend-config="encrypt=true"

terraform plan
terraform apply
```

### 3. Configurer kubectl

```bash
aws eks update-kubeconfig \
  --name userapi-prod-cluster \
  --region eu-west-1
```

### 4. Installer External Secrets Operator

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets-system --create-namespace
```

### 5. Installer la stack de monitoring

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  --set grafana.adminPassword="$(openssl rand -base64 20)"
```

### 6. Déployer l'application

```bash
# Développement
helm upgrade --install userapi ./k8s/helm \
  -f k8s/helm/values-dev.yaml \
  --namespace userapi-dev --create-namespace

# Production (via le pipeline CI/CD sur tag v*)
# ou manuellement :
helm upgrade --install userapi ./k8s/helm \
  -f k8s/helm/values-prod.yaml \
  --namespace userapi --create-namespace
```

### Vérification post-déploiement

```bash
kubectl get pods -n userapi
kubectl get svc,ingress -n userapi
curl https://api.userapi.example.com/health
```

---

## Architecture Decision Records (ADRs)

### ADR-001 : AWS comme cloud provider

**Contexte :** Choix entre AWS, GCP et Azure.

**Décision :** AWS.

**Justification :** Ecosystème le plus mature pour Kubernetes managé (EKS), intégration native IRSA pour l'authentification sans clés statiques, richesse de l'outillage (Secrets Manager, KMS, CloudWatch). EKS est stable en production depuis plusieurs années. La majorité des équipes DevOps disposent d'une expérience AWS.

**Alternatives écartées :**
- GCP/GKE : Kubernetes plus simple à opérer mais moins de maturité sur les outillages périphériques en entreprise.
- Azure/AKS : Pertinent si l'entreprise est déjà dans l'écosystème Microsoft.

---

### ADR-002 : EKS managé vs K8s auto-installé sur VMs

**Décision :** EKS managé.

**Pour :** Le plan de contrôle (API server, etcd, scheduler) est géré par AWS : pas de patching manuel, SLA 99.95%, intégration native IAM/VPC. Les mises à jour de version sont simplifiées.

**Contre :** Coût (environ 70€/mois pour le plan de contrôle), moins de contrôle sur les composants internes.

**Verdict :** En équipe en croissance, le temps opérationnel économisé sur la gestion du plan de contrôle justifie le coût. Un K8s auto-géré (kubeadm, k3s) n'a de sens que pour les très petits projets ou les équipes avec une expertise K8s avancée voulant contrôler chaque composant.

---

### ADR-003 : RDS PostgreSQL managé vs PostgreSQL sur VM

**Décision :** RDS PostgreSQL managé.

**Pour :** Backup automatique, Multi-AZ pour la HA, patching automatique, Performance Insights, chiffrement au repos activable en un paramètre.

**Contre :** Coût supérieur à une VM (+30% environ), moins de flexibilité sur les extensions PostgreSQL exotiques.

**Verdict :** Pour une API de production, la résilience et la réduction de la charge opérationnelle (pas de gestion des backups manuels, pas de gestion des failovers) l'emportent largement. PostgreSQL sur VM est pertinent uniquement pour des contraintes budgétaires extrêmes ou des extensions non supportées par RDS.

---

### ADR-004 : Helm vs Kustomize pour le packaging K8s

**Décision :** Helm.

**Pour :** Templating puissant, gestion du cycle de vie (upgrade, rollback), helm lint intégré, dépôt de charts communautaire pour les dépendances.

**Contre :** Complexité des templates Go, `helm template` peut masquer les erreurs.

**Verdict :** Helm est plus adapté ici car nous avons des différences significatives entre environments (replicas, resources, hosts). Kustomize aurait été préférable pour des configurations proches avec peu de variation.

---

## Choix techniques — Services managés vs DIY

| Composant | Choix | Alternative | Raison |
|---|---|---|---|
| Container runtime | EKS managé | K8s sur VMs | Plan de contrôle managé, patching automatique, SLA AWS |
| Base de données | RDS PostgreSQL | PostgreSQL sur VM | Backup automatique, Multi-AZ, Performance Insights |
| Secrets | AWS Secrets Manager | HashiCorp Vault | Natif AWS, rotation auto, pas d'infra à gérer |
| Container registry | ECR | Docker Hub / GHCR | Intégration native IAM/EKS, scan de vulnérabilités inclus |
| Load Balancer | ALB (AWS LBC) | NGINX Ingress | Intégration native ACM (certificats), WAF possible |
| Monitoring | Prometheus + Grafana | Datadog / New Relic | Open source, pas de coût par host, données restent dans le VPC |
| Logs | Loki + Promtail | EFK / CloudWatch | Léger, natif K8s, intégré à Grafana, moins cher qu'Elasticsearch |
| IaC | Terraform | Pulumi / CDK | Standard de l'industrie, large écosystème de modules |

### Estimation des coûts mensuels (eu-west-1, env prod)

| Service | Type | Coût estimé/mois |
|---|---|---|
| EKS cluster | Plan de contrôle | ~70€ |
| EC2 (2x t3.medium) | Nœuds EKS | ~60€ |
| RDS db.t3.micro | PostgreSQL | ~25€ |
| NAT Gateway | 2 AZs | ~70€ |
| ALB | Load balancer | ~25€ |
| ECR | Stockage images | ~5€ |
| Secrets Manager | 2 secrets | ~1€ |
| **TOTAL estimé** | | **~256€/mois** |

> Optimisations possibles : Spot instances pour les nœuds (-60-70%), Reserved Instances pour RDS (-40%), 1 seul NAT en dev.

---

## Observations sur l'application

L'application est une API REST légère avec 3 endpoints : `GET /health`, `POST /users`, `GET /users`. Elle communique avec PostgreSQL et ne maintient pas d'état en mémoire entre les requêtes (stateless).

**Implications sur l'infrastructure :**

- **Probes K8s :** `readinessProbe` et `livenessProbe` pointent vers `/health` — l'endpoint dédié retourne HTTP 200 quand l'app est prête, permettant au scheduler K8s de ne router le trafic qu'une fois la connexion DB établie.
- **Resources K8s :** Profil mémoire modéré (API REST + connexion PG). `requests: 100m CPU / 128Mi RAM`, `limits: 500m CPU / 256Mi RAM`. Ces valeurs évitent le throttling tout en protégeant le nœud d'un OOM.
- **Variables d'environnement :** `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` — correspondent exactement à ce qu'attend l'application. Le port exposé (8080) est aligné avec le `containerPort` du Deployment.
- **Stateless → scalabilité horizontale :** Aucune session locale, on peut scaler à N replicas sans affinité de session. L'HPA (Horizontal Pod Autoscaler) peut être activé proprement.
- **Logs JSON :** L'application émet des logs structurés — directement indexables par Loki/Promtail sans parser de regex complexe.

---

## Sécurité

### Stratégie IAM — 3 rôles distincts

| Rôle | Usage | Droits |
|---|---|---|
| `userapi-prod-app-role` | Workload applicatif (IRSA) | Lecture Secrets Manager + S3 assets |
| `userapi-prod-cicd-role` | GitHub Actions (OIDC) | Push ECR + DescribeCluster EKS |
| `userapi-prod-eks-cluster-role` | Plan de contrôle EKS | AmazonEKSClusterPolicy uniquement |

**Principes appliqués :**
- Aucune clé d'accès statique (long-lived credentials) : GitHub Actions utilise OIDC federation, les pods utilisent IRSA.
- Aucun rôle admin pour les workloads automatisés.
- Policies scopées sur les ARNs spécifiques, jamais sur `*` pour les actions sensibles.

### Gestion des secrets

Les secrets ne sont jamais en clair dans le code, les manifests ou le pipeline.

**Flux :** `AWS Secrets Manager → External Secrets Operator → K8s Secret (chiffré etcd) → Pod env variable`

**Rotation :** Les secrets AWS Secrets Manager peuvent être configurés pour une rotation automatique via Lambda (30 jours recommandés). Le champ `ignore_changes = [password]` dans Terraform permet de gérer le mot de passe DB externalement sans conflit d'état.

**Ajouter un nouveau secret (procédure) :**
```bash
# 1. Créer le secret dans AWS
aws secretsmanager create-secret \
  --name /userapi/production/new_secret \
  --secret-string '{"value": "my-secret-value"}'

# 2. Ajouter une entrée dans l'ExternalSecret (k8s/rbac/external-secrets.yaml)
# 3. kubectl apply - ESO crée automatiquement le K8s Secret
# 4. Référencer dans le Deployment via secretKeyRef
```

---

## Monitoring & SLOs

### SLO définis

| SLO | Objectif | Alerte |
|---|---|---|
| Disponibilité | > 99.5% / 30 jours | Pod NoPodsAvailable depuis 1min |
| Latence P99 | < 2 secondes | HighLatency depuis 5min |
| Taux d'erreur HTTP 5xx | < 0.5% | HighErrorRate depuis 5min |

### Alertes configurées (PrometheusRule)

1. **CrashLoopBackOff** : Pod en restart loop depuis > 5min → severity: critical
2. **HighErrorRate** : Taux d'erreur HTTP 5xx > 5% sur 5min → severity: warning
3. **HighLatency** : P99 > 2s → severity: warning
4. **HighMemoryUsage** : Mémoire > 80% des limits depuis 10min → severity: warning
5. **NoPodsAvailable** : 0 pod Ready → severity: critical

### Requête Loki utile pour le debugging

```logql
# Toutes les erreurs des dernières 30 minutes sur l'application
{namespace="userapi", app="userapi"} | json | level="error" | line_format "{{.ts}} [{{.level}}] {{.msg}}"

# Requêtes lentes (> 1s) par endpoint
{namespace="userapi"} | json | duration > 1000 | line_format "{{.method}} {{.path}} {{.duration}}ms"
```

**Politique de rétention des logs :**
- Dev/Staging : 14 jours
- Production : 90 jours (conformité légale)

---

## Stratégie de Rollback

### En cas d'échec du déploiement

Le flag `--atomic` dans `helm upgrade` déclenche un rollback automatique si le déploiement ne passe pas les health checks dans le timeout configuré.

**Rollback manuel :**
```bash
# Voir l'historique
helm history userapi -n userapi

# Revenir à la version précédente
helm rollback userapi -n userapi

# Revenir à une révision spécifique
helm rollback userapi 3 -n userapi
```

**Rollback au niveau image Docker :**
```bash
# Déployer une image spécifique (SHA court)
helm upgrade userapi ./k8s/helm \
  --reuse-values \
  --set image.tag=sha-abc1234 \
  -n userapi
```

---

## Questions Techniques

### Q1 — Gestion des coûts cloud sur le long terme

**Visibilité :** AWS Cost Explorer + budgets d'alerte par tag (`Project`, `Environment`). Les ressources Terraform sont toutes taguées — ce qui permet de filtrer les coûts par projet et environnement directement dans la console AWS.

**Actions concrètes que j'ai prises ou prendrai :**

- **Reserved Instances / Savings Plans** : Pour les nœuds EKS et RDS avec usage prévisible (baseline), les Savings Plans 1 an réduisent la facture de 30-40% vs On-Demand.
- **Spot Instances pour les nœuds non-critiques** : Les workloads Kubernetes tolèrent l'interruption si bien configurés (PodDisruptionBudget + requests/limits propres). En dev/staging, 70-80% de réduction sur les nœuds.
- **Right-sizing** : Analyser le P95 des métriques CPU/RAM réelles sur 2 semaines et ajuster les types d'instances. Un `t3.medium` inutilisé à 10% peut être downsizé en `t3.small`.
- **NAT Gateway** : En dev, un seul NAT Gateway (vs 2 pour la HA) économise ~35€/mois. En prod, on garde 2 pour la résilience.
- **ECR Lifecycle Policies** : Supprimer automatiquement les images Docker non taguées et garder seulement les 10 derniers SHAs — évite l'accumulation silencieuse de Go de stockage.
- **Outils** : AWS Cost Explorer, Infracost (dans le pipeline CI pour estimer l'impact financier d'un PR Terraform avant d'appliquer), Kubecost pour les coûts par namespace/workload.

---

### Q2 — Terraform vs Pulumi vs CloudFormation

| Critère | Terraform | Pulumi | CloudFormation |
|---|---|---|---|
| Langage | HCL (DSL déclaratif) | Python, TypeScript, Go, C# | YAML / JSON |
| Portabilité cloud | Multi-cloud natif | Multi-cloud | AWS uniquement |
| Courbe d'apprentissage | Faible (HCL lisible) | Moyenne (langage de programmation) | Faible mais verbeux |
| State management | Remote state (S3, GCS...) | Pulumi Cloud ou self-hosted | Géré par AWS (stacks CF) |
| Écosystème | Très riche (Terraform Registry) | En croissance | AWS officiel uniquement |
| Tests | tflint, tfsec, checkov | Tests unitaires natifs (Python/TS) | cfn-lint, cfn-nag |
| Drift detection | `terraform plan` | `pulumi preview` | Drift detection CF |

**Mon choix : Terraform.**

HCL est assez expressif pour de l'infrastructure sans la complexité d'un vrai langage de programmation. L'écosystème est le plus riche (providers, modules Terraform Registry). La majorité des équipes cloud connaissent Terraform. Le state management avec S3+DynamoDB est éprouvé et bien documenté.

**Limitations de Terraform :** La logique conditionnelle complexe (boucles imbriquées, conditions) devient vite illisible en HCL. Pour des infrastructures génératives très dynamiques (créer 50 microservices similaires avec variations fines), Pulumi avec Python est plus adapté car on bénéficie des abstractions d'un vrai langage.

**Quand choisir Pulumi :** Équipes de développeurs souhaitant coder leur infra dans leur langage habituel, ou infrastructures nécessitant une logique métier dans le provisioning.

**Quand choisir CloudFormation :** Entreprises full-AWS souhaitant éviter un outil tiers, ou pour des déploiements via AWS Service Catalog et StackSets.

---

### Q3 — Diagnostic d'un pod en CrashLoopBackOff

Voici l'ordre exact de mes commandes :

```bash
# 1. Voir l'état du pod et le nombre de restarts
kubectl get pod <pod-name> -n <namespace>

# 2. Lire les événements K8s récents sur le pod (souvent la cause)
kubectl describe pod <pod-name> -n <namespace>
# → Chercher la section "Events" : OOMKilled, ImagePullBackOff, Liveness probe failed...

# 3. Lire les logs du container qui crashe
kubectl logs <pod-name> -n <namespace>

# 4. Si le container redémarre en boucle, lire les logs du container PRÉCÉDENT
kubectl logs <pod-name> -n <namespace> --previous

# 5. Si le pod ne démarre pas du tout, lancer un pod de debug
kubectl run debug --image=busybox -it --rm -- sh
```

**Interprétation des exit codes :**
- `Exit code 0` : Terminaison normale mais inattendue — le process principal s'est arrêté (CMD manquant, script qui termine)
- `Exit code 1` : Erreur applicative générique — lire les logs
- `Exit code 137` (128+9) : SIGKILL — souvent un OOMKill (limite mémoire dépassée) ou un `kubectl delete pod`
- `Exit code 139` (128+11) : Segmentation fault
- `Exit code 143` (128+15) : SIGTERM non géré — le pod n'a pas terminé proprement dans le `terminationGracePeriod`

**Cause fréquente et résolution :** Variable d'environnement manquante (connexion DB impossible). L'app démarre, tente de se connecter à la DB, échoue et crash. Résolution : vérifier que le Secret K8s existe (`kubectl get secret userapi-secrets -n userapi`) et que les valeurs sont correctes (`kubectl get secret userapi-secrets -o jsonpath='{.data.db_password}' | base64 -d`).

---

### Q4 — Stratégie de Disaster Recovery

**RTO (Recovery Time Objective) :** Temps maximum acceptable avant retour à la normale.
**RPO (Recovery Point Objective) :** Perte de données maximale acceptable.

**Trois stratégies DR :**

| Stratégie | RTO | RPO | Coût | Description |
|---|---|---|---|---|
| **Backup & Restore** | Heures | Heures | Faible | Backups réguliers, restauration en cas de sinistre. Convient pour des données non critiques. |
| **Warm Standby** | Minutes | Minutes | Moyen | Infra réduite en veille dans une 2ème région, prête à monter en charge. Bases de données répliquées. |
| **Active-Active (Multi-Region)** | Secondes | Secondes | Élevé | Infra complète dans 2+ régions avec load balancing global. Aucune interruption perceptible. |

**Pour l'UserAPI**, je choisirais **Warm Standby** :
- RTO cible : 15 minutes. RPO cible : 5 minutes.
- RDS Multi-AZ (dans la même région) pour les pannes d'AZ.
- Snapshot RDS automatique quotidien + réplication cross-region pour la DR inter-région.
- EKS dans une 2ème région avec 0 replicas — scalable en quelques minutes via automation.
- Route 53 health checks pour basculer le DNS automatiquement.

**Test du plan DR :**
- Exercice trimestriel : simuler une panne en stoppant la région primaire (feature `--dry-run` de l'automation DR).
- Documenter le RTO réel mesuré à chaque exercice.
- Chaos Engineering (pod kill, node drain) pour valider la résilience K8s en continu.

---

### Q5 — Sécuriser un cluster Kubernetes en production

**Axe 1 : Contrôle d'accès RBAC strict**
- Risque : accès non autorisé à l'API K8s.
- Mitigation : Désactiver le ServiceAccount par défaut (`automountServiceAccountToken: false`), créer des Roles spécifiques, auditer régulièrement les ClusterRoleBindings (`kubectl get clusterrolebindings -o wide | grep -v system:`).

**Axe 2 : Sécurité des containers (SecurityContext)**
- Risque : container root compromettant le nœud.
- Mitigation : `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `capabilities: drop: ALL`, Pod Security Standards en mode `Restricted` sur les namespaces applicatifs.

**Axe 3 : Réseau — NetworkPolicies**
- Risque : mouvement latéral entre namespaces si un pod est compromis.
- Mitigation : NetworkPolicy `deny-all` sur chaque namespace applicatif, puis ouvertures sélectives sur les ports et namespaces nécessaires uniquement.

**Axe 4 : Gestion des secrets**
- Risque : secrets en clair dans etcd ou les logs.
- Mitigation : Chiffrement etcd avec KMS (`encryption-config`), External Secrets Operator (secrets jamais dans le repo), rotation automatique, audit des accès dans Secrets Manager.

**Axe 5 : Mise à jour et patching**
- Risque : CVEs sur les images Docker et les composants K8s.
- Mitigation : Scan Trivy à chaque build CI, ECR scan-on-push, mises à jour régulières des nœuds EKS (managed node groups), désabonnement des images `latest` (toujours tagger avec SHA).

**Axe 6 (bonus) : Audit logging**
- Risque : intrusion non détectée.
- Mitigation : Activer les audit logs EKS (`api`, `audit`, `authenticator`), centraliser dans CloudWatch, alerter sur les actions `create/delete` dans les namespaces sensibles.

---

## Ce que j'aurais fait avec plus de temps

- **ArgoCD / GitOps :** Mettre en place ArgoCD pour une synchronisation automatique du cluster depuis le repo Git, avec health checks et visualisation de l'état de sync dans une UI.
- **Progressive Delivery :** Canary deployments avec Argo Rollouts — rollback automatique si le taux d'erreur dépasse un seuil après déploiement.
- **Dashboard Grafana :** Exporter un dashboard JSON complet avec les métriques RED Method et les panels SLO/SLI.
- **Tests d'intégration** dans le pipeline CI : tester les endpoints `/health` et `/users` avant de pousser vers staging.
- **Infracost :** Intégrer l'estimation de coût Terraform dans les PR GitHub pour voir l'impact financier de chaque changement d'infrastructure.
- **Chaos Engineering :** Un scénario Chaos Mesh basique (pod kill aléatoire) pour valider la résilience du Deployment.
- **Module networking READMEs :** Chaque module Terraform mériterait un README détaillé avec schéma de la couche réseau.