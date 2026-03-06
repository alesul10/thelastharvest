import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CosmosClient } from '@azure/cosmos';

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING ?? '');
const container = client.database('LastHarvest').container('Players');

interface SaveBody {
  playerId: string;
  totalLumber: number;
  lives: number;
  day: number;
  upgrades: Record<string, number>;
}

async function saveProgress(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  let body: SaveBody;
  try {
    body = (await req.json()) as SaveBody;
  } catch {
    return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
  }

  const { playerId, totalLumber, lives, day, upgrades } = body;
  if (!playerId) return { status: 400, jsonBody: { error: 'playerId required' } };

  const doc = {
    id: playerId,
    playerId,
    totalLumber,
    lives,
    day,
    upgrades,
    savedAt: new Date().toISOString(),
  };

  try {
    await container.items.upsert(doc);
    return { status: 200, jsonBody: { ok: true } };
  } catch (err) {
    ctx.error('saveProgress error', err);
    return { status: 500, jsonBody: { error: 'Internal error' } };
  }
}

app.http('saveProgress', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'players/save',
  handler: saveProgress,
});
