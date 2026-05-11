// scripts/build.js
import { cpSync, mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Ensure dist directories exist
mkdirSync(resolve(root, 'dist/icons'), { recursive: true });
mkdirSync(resolve(root, 'dist/popup'), { recursive: true });

// Copy static files
cpSync(resolve(root, 'public/icons'), resolve(root, 'dist/icons'), { recursive: true });

// Copy popup HTML with path transformation (index.ts -> index.js)
const popupHtml = readFileSync(resolve(root, 'src/popup/popup.html'), 'utf-8');
const transformedHtml = popupHtml.replace('./index.ts', './index.js');
writeFileSync(resolve(root, 'dist/popup/popup.html'), transformedHtml);

// Copy popup styles
cpSync(resolve(root, 'src/popup/styles.css'), resolve(root, 'dist/popup/styles.css'));

// Copy manifest
cpSync(resolve(root, 'manifest.json'), resolve(root, 'dist/manifest.json'));

console.log('Static files copied to dist/');
