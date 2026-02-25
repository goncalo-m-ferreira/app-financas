import { app } from './app.js';
import { env } from './config/env.js';

const host = '0.0.0.0';

app.listen(env.port, host, () => {
  console.log(`API a correr em http://${host}:${env.port}`);
});
