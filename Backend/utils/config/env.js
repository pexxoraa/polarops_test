export const env = {
  port: Number(process.env.PORT || 5000),
  databaseUrl:
    process.env.DATABASE_URL || './data/polarops.sqlite',
  authSecret: process.env.AUTH_SECRET || '',
  weatherApiUrl:
    process.env.WEATHER_API_URL ||
    'https://api.open-meteo.com/v1/forecast',
  operationsFeedUrl:
    process.env.OPERATIONS_FEED_URL || '',
  frontendOrigin: process.env.FRONTEND_ORIGIN || '',
};

export function configureWorkerEnv(bindings = {}) {
  env.authSecret = String(
    bindings.AUTH_SECRET || env.authSecret || '',
  );
  env.weatherApiUrl = String(
    bindings.WEATHER_API_URL || env.weatherApiUrl,
  );
  env.operationsFeedUrl = String(
    bindings.OPERATIONS_FEED_URL ||
      env.operationsFeedUrl ||
      '',
  );
  env.frontendOrigin = String(
    bindings.FRONTEND_ORIGIN ||
      env.frontendOrigin ||
      '',
  );
}

export function assertRuntimeConfig() {
  if (!env.authSecret) {
    throw new Error('AUTH_SECRET is required');
  }
}
