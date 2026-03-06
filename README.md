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
cd game
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`) in your browser.

> **Note:** When running locally, the API (player saves and upgrades) won't work without a local Cosmos DB emulator. The game is fully playable without it — progress just won't be saved between sessions.

---

## Azure Resources Overview

Deploying the full game requires **two Azure resources**:

| Resource | Purpose |
|---|---|
| **Azure Static Web Apps** | Hosts the game frontend and the backend API |
| **Azure Cosmos DB** | Stores player save data (progress, upgrades, lives) |

The diagram below shows how they connect:

```
Browser → Azure Static Web Apps → /api/* → Azure Functions (managed)
                                               ↓
                                         Azure Cosmos DB
                                      (database: LastHarvest)
                                      (container: Players)
```

---

## Step-by-Step Deployment

### Step 1 — Create an Azure Cosmos DB account

This is where player progress is saved.

#### Azure Portal

1. Go to [portal.azure.com](https://portal.azure.com) and sign in
2. Search for **Azure Cosmos DB** and click **Create**
3. Select **Azure Cosmos DB for NoSQL** and click **Create**
4. Fill in the form:
   - **Resource Group**: create a new one, e.g. `the-last-harvest-rg`
   - **Account name**: e.g. `the-last-harvest-db` (must be globally unique)
   - **Location**: pick the one closest to you
   - **Capacity mode**: Serverless *(cheapest option for a game with low traffic)*
5. Click **Review + create**, then **Create** — this takes 2–3 minutes
6. Once created, go to the resource and click **Data Explorer** in the left menu
7. Click **New Container**:
   - **Database id**: `LastHarvest` (select *Create new*)
   - **Container id**: `Players`
   - **Partition key**: `/id`
8. Click **OK**
9. Go to **Settings > Keys** and copy the **PRIMARY CONNECTION STRING** — you'll need it in Step 3

#### Azure CLI

```bash
az login

az group create --name the-last-harvest-rg --location eastus

az cosmosdb create \
  --name the-last-harvest-db \
  --resource-group the-last-harvest-rg \
  --capabilities EnableServerless

az cosmosdb sql database create \
  --account-name the-last-harvest-db \
  --resource-group the-last-harvest-rg \
  --name LastHarvest

az cosmosdb sql container create \
  --account-name the-last-harvest-db \
  --resource-group the-last-harvest-rg \
  --database-name LastHarvest \
  --name Players \
  --partition-key-path /id

# Print the connection string (copy this for Step 3)
az cosmosdb keys list \
  --name the-last-harvest-db \
  --resource-group the-last-harvest-rg \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv
```

---

### Step 2 — Create an Azure Static Web App

This hosts the game and the backend API functions.

#### Azure Portal

1. Search for **Static Web Apps** and click **Create**
2. Fill in the form:
   - **Resource Group**: use the same `the-last-harvest-rg` from Step 1
   - **Name**: `the-last-harvest`
   - **Plan type**: Free
   - **Region**: same as your Cosmos DB
3. Under **Deployment details**, choose **GitHub** and sign in with your account
4. Select your forked repository and the `main` branch
5. Set the build details:
   - **App location**: `game`
   - **API location**: `api`
   - **Output location**: `dist`
6. Click **Review + create**, then **Create**

Azure will automatically add a deploy token to your GitHub repo as a secret called `AZURE_STATIC_WEB_APPS_API_TOKEN`.

#### Azure CLI

```bash
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

If using the CLI, you'll need to add the deploy token to GitHub manually:

1. Run: `az staticwebapp secrets list --name the-last-harvest --resource-group the-last-harvest-rg --query "properties.apiKey" --output tsv`
2. In your GitHub repo go to **Settings > Secrets and variables > Actions**
3. Click **New repository secret**, name it `AZURE_STATIC_WEB_APPS_API_TOKEN`, and paste the token

---

### Step 3 — Add the Cosmos DB connection string to Static Web Apps

The API needs to know how to connect to Cosmos DB. You do this by adding an environment variable to the Static Web App.

#### Azure Portal

1. Open your Static Web App resource
2. Go to **Settings > Environment variables**
3. Click **Add** and fill in:
   - **Name**: `COSMOS_CONNECTION_STRING`
   - **Value**: the connection string you copied in Step 1
4. Click **Save**

#### Azure CLI

```bash
az staticwebapp appsettings set \
  --name the-last-harvest \
  --resource-group the-last-harvest-rg \
  --setting-names COSMOS_CONNECTION_STRING="<your-connection-string>"
```

---

### Step 4 — Deploy

Push any change to the `main` branch and GitHub Actions will build and deploy automatically:

```bash
git add .
git commit -m "my change"
git push
```

Watch the deployment progress under the **Actions** tab in your GitHub repo. Once it finishes, your game will be live at the URL shown in the Azure Static Web App overview page (it looks like `https://<random-name>.azurestaticapps.net`).

---

## Project Structure

```
the-last-harvest/
├── game/                  # Babylon.js frontend (Vite + TypeScript)
│   └── src/
│       ├── scenes/        # 3D scene setup
│       ├── systems/       # Game logic (chopping, enemies, inventory…)
│       └── ui/            # HUD, menus
├── api/                   # Azure Functions backend (TypeScript)
│   └── src/functions/
│       ├── getPlayer.ts   # GET  /api/players/{playerId}
│       ├── saveProgress.ts# POST /api/players/save
│       └── applyUpgrade.ts# POST /api/players/upgrade
└── .github/
    └── workflows/         # CI/CD — auto-deploys on push to main
```
