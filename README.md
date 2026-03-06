# The Last Harvest

A 3D browser survival game built with Babylon.js. Chop trees, collect lumber, and make it back to your cabin before the tigers come out at night.

---

## Getting a Copy of This Repo

These steps will fork the project into your own GitHub account so you can make changes and deploy your own version.

### 1. Fork the repository

1. Go to [https://github.com/alesul10/thelastharvest](https://github.com/alesul10/thelastharvest)
2. Click the **Fork** button in the top-right corner
3. Choose your personal GitHub account as the destination

You now have your own copy at `https://github.com/<your-username>/thelastharvest`.

### 2. Clone it to your machine

Open a terminal and run:

```bash
git clone https://github.com/<your-username>/thelastharvest.git
cd thelastharvest
```

### 3. Install dependencies and run locally

```bash
# Install and run the game (frontend)
cd game
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`) in your browser.

---

## Deploying to Azure

The project uses **Azure Static Web Apps** for hosting and **Azure Functions** (inside the `api/` folder) for the backend. The GitHub Actions workflow in `.github/workflows/azure-static-web-apps.yml` handles automatic deployments on every push to `main`.

### Prerequisites

- An [Azure account](https://azure.microsoft.com/free) (free tier works)
- The [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed, or use the Azure Portal in your browser

---

### Step 1 — Create an Azure Static Web App

#### Option A: Azure Portal (recommended for beginners)

1. Go to [portal.azure.com](https://portal.azure.com) and sign in
2. Search for **Static Web Apps** and click **Create**
3. Fill in the form:
   - **Subscription**: your subscription
   - **Resource Group**: create a new one, e.g. `the-last-harvest-rg`
   - **Name**: `the-last-harvest` (or anything you like)
   - **Region**: pick the one closest to you
   - **Plan type**: Free
4. Under **Deployment details**, choose **GitHub** and sign in
5. Select your forked repository and the `main` branch
6. Set the build details:
   - **App location**: `game`
   - **API location**: `api`
   - **Output location**: `dist`
7. Click **Review + create**, then **Create**

Azure will automatically add a deploy token to your GitHub repository and trigger a first deployment.

#### Option B: Azure CLI

```bash
az login

az group create --name the-last-harvest-rg --location eastus

az staticwebapp create \
  --name the-last-harvest \
  --resource-group the-last-harvest-rg \
  --source https://github.com/<your-username>/thelastharvest \
  --branch main \
  --app-location game \
  --api-location api \
  --output-location dist \
  --login-with-github
```

---

### Step 2 — Add the deploy token to GitHub (Portal only)

> Skip this step if you used the Azure CLI — it handles this automatically.

1. In the Azure Portal, open your new Static Web App resource
2. Go to **Settings > Deployment tokens** and copy the token
3. In your GitHub repo, go to **Settings > Secrets and variables > Actions**
4. Click **New repository secret**
   - Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - Value: paste the token you copied
5. Click **Add secret**

---

### Step 3 — Deploy

Push any change to the `main` branch and GitHub Actions will build and deploy automatically:

```bash
git add .
git commit -m "my change"
git push
```

You can watch the deployment under the **Actions** tab in your GitHub repo. Once it finishes, your game will be live at the URL shown in the Azure Static Web App overview page.

---

## Project Structure

```
the-last-harvest/
├── game/          # Babylon.js frontend (Vite + TypeScript)
│   └── src/
│       ├── scenes/
│       ├── systems/
│       └── ui/
├── api/           # Azure Functions backend (TypeScript)
│   └── src/functions/
└── .github/
    └── workflows/ # CI/CD pipeline
```
