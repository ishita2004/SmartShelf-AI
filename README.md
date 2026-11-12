# SmartShelf AI

A small retail recommendation app with an interactive product catalog. Search products, filter by category, and sort by popularity, rating, or price. Select your interests and SmartShelf ranks three products using a hybrid score: product-description similarity (TF-IDF and cosine similarity, 65%), customer rating (20%), and popularity (15%). The sample products include ratings, review counts, and popularity values. It runs locally, needs no API key or database, and does not save selections.

## Run locally

Requires Node.js 20 or newer.

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). Check the app health at [http://localhost:3000/health](http://localhost:3000/health).

## Test

```sh
npm test
```

The tests exercise the health check, recommendation ranking, catalog filters, and invalid API inputs.

## API

- `GET /api/recommendations?interests=coffee,travel` — returns the top three products for the selected interests.
- `GET /api/products?q=plant&category=Home&sort=rating` — searches and filters the catalog. Sort options: `popular`, `rating`, `price-low`, and `price-high`.

## Build and run with Docker

```sh
docker build -t smartshelf-ai:latest .
docker run --rm -p 3000:3000 smartshelf-ai:latest
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Kubernetes

The manifests create two app replicas and a `LoadBalancer` Service. A cloud cluster will provision an external address for the Service. Before applying the manifests to a remote cluster, build and push the image to a registry accessible by that cluster, then change `image` in `k8s/Deployment.yaml` to the full registry image name and tag.

```sh
docker build -t YOUR_REGISTRY/smartshelf-ai:1.0.0 .
docker push YOUR_REGISTRY/smartshelf-ai:1.0.0
kubectl apply -f k8s/Deployment.yaml
kubectl apply -f k8s/Service.yaml
kubectl get deployments,pods,services
kubectl get service smartshelf-ai --watch
```

When the Service's `EXTERNAL-IP` is assigned, open `http://<EXTERNAL-IP>/`. Provisioning can take a few minutes. Some local clusters do not provide a cloud load balancer by default; enable their load-balancer support (for example, Minikube's tunnel) or use a cloud Kubernetes cluster.
