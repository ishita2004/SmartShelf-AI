# SmartShelf AI microservices

SmartShelf is a retail recommendation application made of five independently deployable Node.js microservices:

1. **Storefront** serves the browser UI and routes browser API requests.
2. **Catalog** owns product descriptions, prices, tags, and categories in **PostgreSQL**.
3. **Search** combines catalog products with review metrics and searches, filters, and sorts them.
4. **Recommendations** combines catalog and review data and ranks products using text similarity (TF-IDF and cosine similarity, 65%), ratings (20%), and popularity (15%).
5. **Reviews** stores sample ratings, review counts, and popularity metrics in **MongoDB**.

The two databases are separate dependencies of the Catalog and Reviews services. The other services use their HTTP APIs. Initial sample records are inserted when the services first start with empty tables/collections. The scores are a lightweight recommendation algorithm, not a trained model; review data is sample data, not live customer reviews.

## Run locally

Requires Node.js 20 or newer, PostgreSQL, and MongoDB running locally. No Docker Desktop is required to run the Node services, but both databases must be available first. By default, the app expects:

- PostgreSQL at `127.0.0.1:5432`, database/user/password `smartshelf`
- MongoDB at `127.0.0.1:27017`, user/password `smartshelf` authenticated against `admin`

Install the two database drivers from the project root:

```powershell
npm ci --prefix services\catalog
npm ci --prefix services\reviews
```

Set environment variables in PowerShell if your local database credentials differ:

```powershell
$env:PGHOST = "127.0.0.1"
$env:PGPORT = "5432"
$env:PGDATABASE = "smartshelf"
$env:PGUSER = "your-postgres-user"
$env:PGPASSWORD = "your-postgres-password"
$env:MONGO_HOST = "127.0.0.1"
$env:MONGO_PORT = "27017"
$env:MONGO_USER = "your-mongo-user"
$env:MONGO_PASSWORD = "your-mongo-password"
$env:MONGO_AUTH_SOURCE = "admin"
npm start
```

The launcher starts all five services. Open the storefront at [http://localhost:3000](http://localhost:3000). Press **Ctrl+C** in that terminal to stop all five.

| Service | Port | Local endpoint |
|---|---:|---|
| Storefront | 3000 | http://localhost:3000 |
| Catalog | 3001 | http://localhost:3001/api/products |
| Search | 3002 | http://localhost:3002/api/search |
| Recommendations | 3003 | http://localhost:3003/api/recommendations?interests=coffee |
| Reviews | 3004 | http://localhost:3004/api/reviews |

## Test

```powershell
npm test
npm run check
```

Integration tests use in-memory repository fixtures, so they do not require live database servers.

## Build images in Azure Container Registry

You do not need Docker Desktop for Azure's remote builds. Sign in, set your registry name, and run these commands from the project root:

```powershell
az login
$ACR_NAME = "YOUR_ACR_NAME"

az acr build --registry $ACR_NAME --image smartshelf-storefront:v1 --file services/storefront/Dockerfile .
az acr build --registry $ACR_NAME --image smartshelf-catalog:v1 --file services/catalog/Dockerfile .
az acr build --registry $ACR_NAME --image smartshelf-search:v1 --file services/search/Dockerfile .
az acr build --registry $ACR_NAME --image smartshelf-recommendations:v1 --file services/recommendations/Dockerfile .
az acr build --registry $ACR_NAME --image smartshelf-reviews:v1 --file services/reviews/Dockerfile .
```

Each command builds and pushes one image. Replace `YOUR_ACR_NAME` in `k8s/Deployment.yaml` with the actual registry name.

## Deploy to AKS

The demo deploys PostgreSQL and MongoDB in the cluster, each with a 1 GiB persistent volume claim. Create database credentials locally; the generated `k8s/Secret.yaml` is gitignored:

```powershell
Copy-Item k8s\Secret.example.yaml k8s\Secret.yaml
```

Edit `k8s\Secret.yaml` and replace both placeholder passwords with strong, different passwords. Do not commit this file. Apply the secret and database resources:

```powershell
kubectl apply -f k8s/Secret.yaml
kubectl apply -f k8s/Database.yaml
kubectl apply -f k8s/Service.yaml
kubectl rollout status deployment/smartshelf-postgres --timeout=180s
kubectl rollout status deployment/smartshelf-mongodb --timeout=180s
```

Connect ACR to AKS and configure `kubectl`:

```powershell
$RESOURCE_GROUP = "YOUR_RESOURCE_GROUP"
$AKS_NAME = "YOUR_AKS_CLUSTER"

az aks update --resource-group $RESOURCE_GROUP --name $AKS_NAME --attach-acr $ACR_NAME
az aks get-credentials --resource-group $RESOURCE_GROUP --name $AKS_NAME
kubectl get nodes
```

Build all five images in ACR, update the registry name in `k8s/Deployment.yaml`, then deploy the application:

```powershell
kubectl apply -f k8s/Deployment.yaml
kubectl get deployments,pods,services
kubectl get service smartshelf-storefront --watch
```

Only the storefront uses a public `LoadBalancer`. The other services and both databases use internal `ClusterIP` Services. Open `http://<EXTERNAL-IP>/` after Azure assigns the storefront an external IP.

**Learning/demo deployment:** these single-replica databases and credentials-in-a-Kubernetes-Secret are for a project demo, not production. For production, use managed databases, managed secret storage, backups, and appropriate network policies. AKS nodes, persistent disks, ACR builds, and the public load balancer can incur Azure charges; check costs and remove resources when finished.
