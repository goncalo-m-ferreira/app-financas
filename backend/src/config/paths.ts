import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(configDir, '..', '..');

export const reportsPublicDir = path.resolve(backendRoot, 'public', 'reports');
