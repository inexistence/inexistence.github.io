import { access, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const requirements = join(root, 'tools', 'font-subset-requirements.txt');
const virtualEnvironment = join(root, '.fonttools');
const requirementsMarker = join(virtualEnvironment, '.requirements-hash');
const isWindows = process.platform === 'win32';
const environmentPython = join(virtualEnvironment, isWindows ? 'Scripts/python.exe' : 'bin/python');
const environmentPip = join(virtualEnvironment, isWindows ? 'Scripts/pip.exe' : 'bin/pip');

function isPython3(command) {
  // Prefer a runtime check: `python --version` can succeed for Python 2,
  // and Windows `py` may launch either depending on install.
  const probe = spawnSync(
    command,
    ['-c', 'import sys; raise SystemExit(0 if sys.version_info[0] >= 3 else 1)'],
    { cwd: root, stdio: 'ignore' },
  );
  return probe.status === 0;
}

function resolveSystemPython() {
  // Windows installs usually expose `python` / `py`, not `python3`.
  const candidates = process.env.PYTHON
    ? [process.env.PYTHON]
    : isWindows
      ? ['python', 'py', 'python3']
      : ['python3', 'python'];

  for (const candidate of candidates) {
    if (isPython3(candidate)) return candidate;
  }

  return null;
}

function run(command, arguments_, message) {
  const result = spawnSync(command, arguments_, { cwd: root, stdio: 'inherit' });
  if (result.status === 0) return;

  const reason = result.error?.message || `exit code ${result.status ?? 'unknown'}`;
  throw new Error(`${message}\n${reason}`);
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const requirementContents = await readFile(requirements);
  const requirementHash = createHash('sha256').update(requirementContents).digest('hex');

  if (!(await exists(environmentPython))) {
    console.log('Initializing the project FontTools environment…');
    const systemPython = resolveSystemPython();
    if (!systemPython) {
      throw new Error(
        'Python 3 is required to generate fonts. Install Python 3, or set PYTHON to a Python 3 executable. (no usable python3/python found)',
      );
    }
    run(systemPython, ['-m', 'venv', virtualEnvironment], 'Could not create .fonttools/.');
  }

  const installedHash = (await exists(requirementsMarker))
    ? (await readFile(requirementsMarker, 'utf8')).trim()
    : '';
  const fontToolsAvailable = spawnSync(environmentPython, ['-c', 'import fontTools'], {
    cwd: root,
    stdio: 'ignore',
  }).status === 0;
  if (installedHash !== requirementHash || !fontToolsAvailable) {
    console.log('Installing the pinned FontTools dependency…');
    run(
      environmentPip,
      ['install', '--disable-pip-version-check', '-r', requirements],
      'Could not install FontTools. Check the network connection and Python package source.',
    );
    await writeFile(requirementsMarker, `${requirementHash}\n`);
  }

  run(environmentPython, [join(root, 'scripts', 'generate-font-subsets.py')], 'Font subset generation failed.');
}

main().catch((error) => {
  console.error(`\n[fonts:ensure] ${error.message}`);
  process.exitCode = 1;
});
