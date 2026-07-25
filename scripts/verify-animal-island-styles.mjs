import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const componentStylesPath = resolve(root, 'src/styles/animal-island-components.css');
const themeStylesPath = resolve(root, 'src/styles/global.css');
const baseStylesPath = resolve(root, 'src/styles/animal-island-base.css');

function animalVariables(css, pattern) {
  return new Set([...css.matchAll(pattern)].map((match) => match[1]));
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  }));
  return paths.flat().filter((path) => ['.astro', '.ts', '.tsx'].includes(extname(path)) && !path.endsWith('.d.ts'));
}

function importedComponents(source) {
  const components = new Set();
  for (const match of source.matchAll(/from\s+['"]animal-island-ui\/es\/components\/([^/'"]+)\//g)) {
    components.add(match[1]);
  }
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]animal-island-ui['"]/g)) {
    for (const specifier of match[1].split(',')) {
      const name = specifier.trim().split(/\s+as\s+/)[0];
      if (name) components.add(name);
    }
  }
  return components;
}

async function main() {
  const componentStyles = await readFile(componentStylesPath, 'utf8');
  const imports = [...componentStyles.matchAll(/@import\s+['"]([^'"]+)['"];?/g)].map((match) => match[1]);
  const modules = await Promise.all(imports.map(async (path) => readFile(resolve(dirname(componentStylesPath), path), 'utf8')));
  const [themeStyles, baseStyles] = await Promise.all([
    readFile(themeStylesPath, 'utf8'),
    readFile(baseStylesPath, 'utf8'),
  ]);
  const componentStylesheets = new Set(imports.map((path) => path.match(/\/components\/([^/]+)\//)?.[1]).filter(Boolean));
  const sources = await Promise.all((await sourceFiles(resolve(root, 'src'))).map((path) => readFile(path, 'utf8')));
  const components = new Set(sources.flatMap((source) => [...importedComponents(source)]));

  const referenced = animalVariables(
    [...modules, baseStyles].join('\n'),
    /var\((--animal-[\w-]+)/g,
  );
  const defined = animalVariables(themeStyles, /(--animal-[\w-]+)\s*:/g);
  const missing = [...referenced].filter((variable) => !defined.has(variable)).sort();

  if (missing.length) {
    throw new Error(`Missing animal-island theme variables: ${missing.join(', ')}`);
  }
  const missingStyles = [...components].filter((component) => !componentStylesheets.has(component)).sort();
  const unusedStyles = [...componentStylesheets].filter((component) => !components.has(component)).sort();
  const styleErrors = [];
  if (missingStyles.length) {
    styleErrors.push(`Missing animal-island component styles: ${missingStyles.join(', ')}`);
  }
  if (unusedStyles.length) {
    styleErrors.push(`Unused animal-island component styles: ${unusedStyles.join(', ')}`);
  }
  if (styleErrors.length) {
    throw new Error(styleErrors.join('\n'));
  }

  console.log(`Animal Island style verification passed: ${components.size} imported components, ${imports.length} component styles, ${referenced.size} theme variables.`);
}

main().catch((error) => {
  console.error(`\n[styles:verify] ${error.message}`);
  process.exitCode = 1;
});
