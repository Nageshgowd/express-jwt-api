import mongoose from 'mongoose';
import { createApp } from './app';
import { getConfig } from './config';

async function main() {
  const { port, mongoUri, jwtSecret } = getConfig();
  if (jwtSecret.length < 16) {
    throw new Error('JWT_SECRET must be set to a random string of at least 16 characters');
  }

  await mongoose.connect(mongoUri);
  const server = createApp().listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
