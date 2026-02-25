import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.log(`API a correr em http://localhost:${env.port}`);
});
