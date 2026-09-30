import http from 'node:http';

const DEFAULT_TIMEOUT_MS = 800;

export function detectBackendOnPort(
  port,
  host = '127.0.0.1',
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  return new Promise((resolve) => {
    let connected = false;
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const request = http.get(
      { host, port, path: '/api/health', timeout: timeoutMs },
      (response) => {
        connected = true;
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          if (body.length < 4096) body += chunk;
        });
        response.on('end', () => {
          try {
            const payload = JSON.parse(body);
            finish(
              payload?.service === 'polarops-backend'
                ? 'polarops'
                : 'occupied',
            );
          } catch {
            finish('occupied');
          }
        });
      },
    );

    request.on('socket', (socket) => {
      socket.once('connect', () => {
        connected = true;
      });
    });

    request.on('timeout', () => {
      request.destroy();
      finish(connected ? 'occupied' : 'free');
    });

    request.on('error', (error) => {
      if (error.code === 'ECONNREFUSED') finish('free');
      else finish(connected ? 'occupied' : 'free');
    });
  });
}
