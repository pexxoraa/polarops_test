import { httpServerHandler } from 'cloudflare:node';
import { createApp } from './utils/app.js';
import {
  bindD1Database,
  get,
} from './utils/config/database.js';
import {
  assertRuntimeConfig,
  configureWorkerEnv,
} from './utils/config/env.js';
import {
  decodeRealtimeTicket,
} from './utils/security.js';
import {
  bindExpeditionRoomNamespace,
} from './utils/services/realtimeService.js';

export { ExpeditionRoom } from './utils/cloudflare/ExpeditionRoom.js';

const app = createApp();
app.listen(3000);
const expressHandler = httpServerHandler({ port: 3000 });

function bindRuntime(bindings) {
  configureWorkerEnv(bindings);
  assertRuntimeConfig();
  bindD1Database(bindings.DB);
  bindExpeditionRoomNamespace(bindings.EXPEDITION_ROOM);
}

async function handleRealtime(request, bindings) {
  const url = new URL(request.url);
  const match = url.pathname.match(
    /^\/ws\/expeditions\/(\d+)$/,
  );

  if (
    !match ||
    request.headers.get('Upgrade')?.toLowerCase() !==
      'websocket'
  ) {
    return null;
  }

  const expeditionId = Number(match[1]);
  const ticketValue = url.searchParams.get('ticket') || '';

  let ticket;
  try {
    ticket = decodeRealtimeTicket(
      ticketValue,
      bindings.AUTH_SECRET,
    );
  } catch {
    return new Response('Invalid realtime ticket', {
      status: 401,
    });
  }

  const user = await get(
    'SELECT * FROM users WHERE id=? AND active=1',
    Number(ticket.uid),
  );
  const expedition = await get(
    'SELECT * FROM expeditions WHERE id=?',
    expeditionId,
  );

  if (
    Number(ticket.eid) !== expeditionId ||
    !user ||
    !expedition ||
    Number(user.organization_id) !== Number(ticket.oid) ||
    Number(expedition.organization_id) !==
      Number(user.organization_id)
  ) {
    return new Response('Realtime access denied', {
      status: 403,
    });
  }

  const objectId =
    bindings.EXPEDITION_ROOM.idFromName(
      String(expeditionId),
    );
  const room = bindings.EXPEDITION_ROOM.get(objectId);
  const headers = new Headers(request.headers);
  headers.set(
    'x-polarops-expedition-id',
    String(expeditionId),
  );
  headers.set(
    'x-polarops-user-id',
    String(user.id),
  );
  headers.set(
    'x-polarops-organization-id',
    String(user.organization_id),
  );

  return room.fetch(
    new Request(request, {
      headers,
    }),
  );
}

export default {
  async fetch(request, bindings, ctx) {
    bindRuntime(bindings);

    const realtimeResponse = await handleRealtime(
      request,
      bindings,
    );
    if (realtimeResponse) return realtimeResponse;

    return expressHandler.fetch(request, bindings, ctx);
  },
};
