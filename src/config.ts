import 'dotenv/config';

/** Read at call time so tests can set env vars before the app is used. */
export function getConfig() {
  return {
    port: Number(process.env.PORT ?? 3000),
    mongoUri: process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/express-jwt-api',
    jwtSecret: process.env.JWT_SECRET ?? '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  };
}
