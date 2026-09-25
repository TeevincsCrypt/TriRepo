import 'dotenv/config';
import app from './app.js';
import { port, host } from './config.js';

app.listen(port, host, () => {
  console.log(`Vaultline listening on http://${host}:${port}`);
});
