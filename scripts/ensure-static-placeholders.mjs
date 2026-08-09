import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'public', 'images_webp');

// Small neutral WebP. Album pages style the surrounding card, so the important
// guarantee here is a valid local image response rather than another broken URL.
const ALBUM_PLACEHOLDER_WEBP =
  'UklGRj4AAABXRUJQVlA4IDIAAACQAwCdASpAAEAAPlEokkajoqGhIggAcAoJaQAAEDdTUAV4hbkAAP77hEcR2vFwAAAAAA==';

await mkdir(outputDir, { recursive: true });
await writeFile(
  path.join(outputDir, 'album-placeholder.webp'),
  Buffer.from(ALBUM_PLACEHOLDER_WEBP, 'base64'),
);

console.log('[static placeholders] ensured album-placeholder.webp');
