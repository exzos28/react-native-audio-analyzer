// The README and LICENSE live at the monorepo root (that is what GitHub
// shows). Copy them next to package.json right before packing so that the
// npm tarball and the npm package page ship the same documentation.
//
// The README uses repository-relative links and images, which work on GitHub
// in any branch and in editor previews. npm cannot resolve them, so the copy
// gets absolute URLs to the main branch.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = join(packageDir, '..', '..');

const REPOSITORY = 'exzos28/react-native-audio-analyzer';
const RAW = `https://raw.githubusercontent.com/${REPOSITORY}/main/`;
const BLOB = `https://github.com/${REPOSITORY}/blob/main/`;

/** Relative paths only: not absolute URLs, anchors or root-relative paths. */
const isRelative = (path) => !/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(path);

export function absolutizeReadme(markdown) {
  return markdown
    .replace(/\b(src|srcset)="([^"]+)"/g, (match, attribute, path) =>
      isRelative(path) ? `${attribute}="${RAW}${path}"` : match
    )
    .replace(/\b(href)="([^"]+)"/g, (match, attribute, path) =>
      isRelative(path) ? `${attribute}="${BLOB}${path}"` : match
    )
    .replace(/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g, (match, image, text, path) =>
      isRelative(path)
        ? `${image}[${text}](${image ? RAW : BLOB}${path})`
        : match
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const readme = readFileSync(join(rootDir, 'README.md'), 'utf8');
  writeFileSync(join(packageDir, 'README.md'), absolutizeReadme(readme));
  copyFileSync(join(rootDir, 'LICENSE'), join(packageDir, 'LICENSE'));
}
