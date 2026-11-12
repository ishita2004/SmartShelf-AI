# SmartShelf AI microservices

SmartShelf is a sample retail application split into five independently deployable Node.js services:

1. **Storefront** serves the browser UI and routes browser API requests to the backend services.
2. **Catalog** owns the sample product descriptions, prices, tags, and categories.
3. **Search** combines catalog products with review metrics and searches, filters, and sorts them.
4. **Recommendations** combines catalog and review data and ranks products using text similarity (TF-IDF and cosine similarity, 65%), ratings (20%), and popularity (15%).
5. **Reviews** provides sample ratings, review counts, and popularity metrics.

The data is in memory for this demo. No database, external AI API, or Node package installation is required. Review metrics are sample data, not live customer reviews.

## Run locally

Requires Node.js 20 or newer. Stop any previous SmartShelf server using port 3000, then from the project directory run:

```powershell
npm start
```

The launcher starts all five services. Open the storefront at [http://localhost:3000](http://localhost:3000). Local ports:

| Service | Port | Local endpoint |
|---|---:|---|
| Storefront | 3000 | http://localhost:3000 |
| Catalog | 3001 | http://localhost:3001/api/products |
| Search | 3002 | http://localhost:3002/api/search |
| Recommendations | 3003 | http://localhost:3003/api/recommendations?interests=coffee |
| Reviews | 3004 | http://localhost:3004/api/reviews |

Press **Ctrl+C** in the terminal to stop all five services.

## Test

```powershell
npm test
npm run check
```

Integration tests run the five services on temporary local ports and verify their health and API communication.

## Build images in Azure Container Registry

You do not need Docker Desktop for this step. Sign in with Azure CLI, set your registry name, and run these commands from the project root:

```powershell
az login
$ACR_NAME = "YOUR_ACR_NAME"

az acr build --registry $ACR_NAME --image smartshelf-storefront:v1 --file services/storefront/Dockerfile .
az acr build --registry $ACR_NAME --image smartshelf-catalog:v1 --file services/catalog/Dockerfile .
az acr build --registry $ACR_NAME --image smartshelf-search:v1 --file services/search/Dockerfile .
az acr build --registry $ACR_NAME --image smartshelf-recommendations:v1 --file services/recommendations/Dockerfile .
az acr build --registry $ACR_NAME --image smartshelf-reviews:v1 --file services/reviews/Dockerfile .
```

Each command builds one service image remotely and pushes it to ACR. Replace `YOUR_ACR_NAME` in `k8s/Deployment.yaml` with the actual registry name before applying the manifests.

## Deploy to AKS

Attach ACR to your AKS cluster and connect `kubectl`:

```powershell
$RESOURCE_GROUP = "YOUR_RESOURCE_GROUP"
$AKS_NAME = "YOUR_AKS_CLUSTER"

az aks update --resource-group $RESOURCE_GROUP --name $AKS_NAME --attach-acr $ACR_NAME
az aks get-credentials --resource-group $RESOURCE_GROUP --name $AKS_NAME
kubectl get nodes
```

After updating the image registry name in `k8s/Deployment.yaml`, deploy all five Deployments and Services:

```powershell
kubectl apply -f k8s/Deployment.yaml
kubectl apply -f k8s/Service.yaml
kubectl get deployments,pods,services
kubectl get service smartshelf-storefront --watch
```

Only the storefront uses a `LoadBalancer` and is exposed publicly. The catalog, search, recommendations, and reviews services use internal `ClusterIP` Services and are accessed by DNS names inside Kubernetes. When Azure assigns an external IP to `smartshelf-storefront`, open `http://<EXTERNAL-IP>/`.

The storefront runs two replicas; the four backend services run one replica each to keep this learning deployment smaller. AKS nodes, ACR builds, and the public load balancer may incur Azure charges. Review costs and remove resources when finished.
