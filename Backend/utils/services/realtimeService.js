import { randomUUID } from 'node:crypto';

let expeditionRoomNamespace = null;
const localRooms = new Map();

export function bindExpeditionRoomNamespace(namespace) {
  expeditionRoomNamespace = namespace || null;
}

export function localRoom(expeditionId) {
  const id = Number(expeditionId);
  if (!localRooms.has(id)) localRooms.set(id, new Set());
  return localRooms.get(id);
}

export function makeEvent(
  type,
  expeditionId,
  entityType,
  entityId,
  data = {},
) {
  return {
    event_id: randomUUID(),
    type,
    expedition_id: Number(expeditionId),
    entity_type: entityType || null,
    entity_id: entityId ? Number(entityId) : null,
    occurred_at: new Date().toISOString(),
    data,
  };
}

export async function broadcast(expeditionId, event) {
  const id = Number(expeditionId);

  if (expeditionRoomNamespace) {
    const objectId = expeditionRoomNamespace.idFromName(String(id));
    const stub = expeditionRoomNamespace.get(objectId);
    const response = await stub.fetch(
      new Request('https://polarops-room.internal/broadcast', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
      }),
    );
    if (!response.ok) return 0;
    const payload = await response.json();
    return Number(payload.sent || 0);
  }

  const payload = JSON.stringify(event);
  let sent = 0;
  for (const socket of localRoom(id)) {
    if (
      socket.readyState === 1 &&
      socket.polaropsAuthenticated
    ) {
      socket.send(payload);
      sent += 1;
    }
  }
  return sent;
}
