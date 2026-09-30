import { WebSocketServer } from 'ws';
import { get } from '../config/database.js';
import {
  decodeRealtimeTicket,
  decodeToken,
} from '../security.js';
import { localRoom } from './realtimeService.js';

export function configureRealtime(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const match = url.pathname.match(
        /^\/ws\/expeditions\/(\d+)$/,
      );
      if (!match) {
        socket.destroy();
        return;
      }

      const expeditionId = Number(match[1]);
      const ticket = decodeRealtimeTicket(
        url.searchParams.get('ticket') || '',
      );
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
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.polaropsAuthenticated = false;
        localRoom(expeditionId).add(ws);

        ws.on('message', (buffer) => {
          try {
            const message = JSON.parse(buffer.toString());
            if (message.type === 'auth') {
              const session = decodeToken(message.token || '');
              if (
                Number(session.uid) !== Number(ticket.uid) ||
                Number(session.oid) !== Number(ticket.oid)
              ) {
                ws.close(4401, 'Unauthorized');
                return;
              }
              ws.polaropsAuthenticated = true;
              ws.send(
                JSON.stringify({
                  type: 'auth.ok',
                  expedition_id: expeditionId,
                  user_id: session.uid,
                  server_time: new Date().toISOString(),
                }),
              );
            } else if (message.type === 'ping') {
              ws.send(
                JSON.stringify({
                  type: 'pong',
                  server_time: new Date().toISOString(),
                }),
              );
            }
          } catch {
            ws.send(
              JSON.stringify({
                type: 'error',
                detail: 'Invalid realtime message',
              }),
            );
          }
        });

        ws.on('close', () => {
          localRoom(expeditionId).delete(ws);
        });
      });
    } catch {
      socket.destroy();
    }
  });

  return wss;
}
