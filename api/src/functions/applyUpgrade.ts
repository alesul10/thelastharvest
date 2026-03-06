import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CosmosClient } from '@azure/cosmos';

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING ?? '');
const container = client.database('LastHarvest').container('Players');

const UPGRADE_COSTS: Record<string, number[]> = {
  cuttingSpeed:  [10, 25, 50, 100],
  movementSpeed: [15, 35, 70, 140],
  treeCount:     [5,  15, 35, 75],
  treeValue:     [8,  20, 45, 90],
  maxLives:      [30, 65, 120, 220],
};

const MAX_LEVEL = 4;

interface UpgradeBody {
  playerId: string;
  upgradeId: string;
}

async function applyUpgrade(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  let body: UpgradeBody;
  try {
    body = (await req.json()) as UpgradeBody;
  } catch {
    return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
  }

  const { playerId, upgradeId } = body;
  if (!playerId || !upgradeId) {
    return { status: 400, jsonBody: { error: 'playerId and upgradeId required' } };
  }

  if (!UPGRADE_COSTS[upgradeId]) {
    return { status: 400, jsonBody: { error: `Unknown upgrade: ${upgradeId}` } };
  }

  try {
    const { resource: player } = await container.item(playerId, playerId).read();
    if (!player) return { status: 404, jsonBody: { error: 'Player not found' } };

    const currentLevel = player.upgrades?.[upgradeId] ?? 0;
    if (currentLevel >= MAX_LEVEL) {
      return { status: 409, jsonBody: { error: 'Already maxed' } };
    }

    const cost = UPGRADE_COSTS[upgradeId][currentLevel];
    if (player.totalLumber < cost) {
      return { status: 402, jsonBody: { error: 'Insufficient lumber', cost, have: player.totalLumber } };
    }

    player.totalLumber -= cost;
    player.upgrades[upgradeId] = currentLevel + 1;
    if (upgradeId === 'maxLives') player.lives = (player.lives ?? 3) + 1;
    player.savedAt = new Date().toISOString();

    await container.items.upsert(player);
    return { status: 200, jsonBody: { ok: true, upgrades: player.upgrades, totalLumber: player.totalLumber } };
  } catch (err) {
    ctx.error('applyUpgrade error', err);
    return { status: 500, jsonBody: { error: 'Internal error' } };
  }
}

app.http('applyUpgrade', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'players/upgrade',
  handler: applyUpgrade,
});
