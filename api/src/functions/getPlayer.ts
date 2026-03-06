import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CosmosClient } from '@azure/cosmos';

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING ?? '');
const container = client.database('LastHarvest').container('Players');

async function getPlayer(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const playerId = req.params.playerId;
  if (!playerId) {
    return { status: 400, jsonBody: { error: 'playerId required' } };
  }

  try {
    const { resource } = await container.item(playerId, playerId).read();
    if (!resource) {
      // New player — return defaults
      return {
        status: 200,
        jsonBody: {
          id: playerId,
          totalLumber: 0,
          lives: 3,
          day: 1,
          upgrades: {
            cuttingSpeed: 0,
            movementSpeed: 0,
            treeCount: 0,
            treeValue: 0,
            maxLives: 0,
          },
        },
      };
    }
    return { status: 200, jsonBody: resource };
  } catch (err) {
    ctx.error('getPlayer error', err);
    return { status: 500, jsonBody: { error: 'Internal error' } };
  }
}

app.http('getPlayer', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'players/{playerId}',
  handler: getPlayer,
});
