import { DurableObject } from 'cloudflare:workers';
import { decodeToken } from '../security.js';

function decodeMessage(message) {
  if (typeof message === 'string') return message;
  return new TextDecoder().decode(message);
}

export class ExpeditionRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (
      url.pathname === '/broadcast' &&
      request.method === 'POST'
    ) {
      const event = await request.json();
      const payload = JSON.stringify(event);
      let sent = 0;

      for (const socket of this.ctx.getWebSockets()) {
        const attachment = socket.deserializeAttachment() || {};
        if (!attachment.authenticated) continue;
        try {
          socket.send(payload);
          sent += 1;
        } catch {
          // The runtime removes disconnected sockets.
        }
      }

      return Response.json({ sent });
    }

    if (
      request.headers.get('Upgrade')?.toLowerCase() !==
      'websocket'
    ) {
      return new Response('Expected WebSocket upgrade', {
        status: 426,
      });
    }

    const expeditionId = Number(
      request.headers.get('x-polarops-expedition-id'),
    );
    const userId = Number(
      request.headers.get('x-polarops-user-id'),
    );
    const organizationId = Number(
      request.headers.get('x-polarops-organization-id'),
    );

    if (
      !Number.isFinite(expeditionId) ||
      !Number.isFinite(userId) ||
      !Number.isFinite(organizationId)
    ) {
      return new Response('Invalid realtime identity', {
        status: 400,
      });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server, [
      'expedition:' + expeditionId,
    ]);
    server.serializeAttachment({
      expeditionId,
      userId,
      organizationId,
      authenticated: false,
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(socket, message) {
    try {
      const payload = JSON.parse(decodeMessage(message));
      const attachment =
        socket.deserializeAttachment() || {};

      if (payload.type === 'auth') {
        const session = decodeToken(
          payload.token || '',
          this.env.AUTH_SECRET,
        );

        if (
          Number(session.uid) !==
            Number(attachment.userId) ||
          Number(session.oid) !==
            Number(attachment.organizationId)
        ) {
          socket.close(4401, 'Unauthorized');
          return;
        }

        socket.serializeAttachment({
          ...attachment,
          authenticated: true,
        });
        socket.send(
          JSON.stringify({
            type: 'auth.ok',
            expedition_id: Number(
              attachment.expeditionId,
            ),
            user_id: Number(attachment.userId),
            server_time: new Date().toISOString(),
          }),
        );
        return;
      }

      if (payload.type === 'ping') {
        socket.send(
          JSON.stringify({
            type: 'pong',
            server_time: new Date().toISOString(),
          }),
        );
        return;
      }

      socket.send(
        JSON.stringify({
          type: 'error',
          detail: 'Invalid realtime message',
        }),
      );
    } catch {
      socket.send(
        JSON.stringify({
          type: 'error',
          detail: 'Invalid realtime message',
        }),
      );
    }
  }

  async webSocketClose(socket, code, reason) {
    try {
      socket.close(code, reason);
    } catch {
      // Close acknowledgement is best-effort.
    }
  }

  async webSocketError(socket) {
    try {
      socket.close(1011, 'Realtime connection error');
    } catch {
      // Socket may already be closed.
    }
  }
}
