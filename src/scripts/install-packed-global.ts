import { type SpawnSyncOptionsWithStringEncoding } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnPlatformCommandSync } from '../utils/platform-command.js';
import { ensureRepoDependencies } from './smoke-packed-install.js';

type StringSpawnOptions = Omit<SpawnSyncOptionsWithStringEncoding, 'encoding'> & {
  encoding?: BufferEncoding;
};

function usage(): string {
  return [
    'Usage: node dist/scripts/install-packed-global.js',
    '',
    'Creates an npm tarball from the current workspace and installs it globally.',
  ].join('\n');
}

function parseArgs(argv: string[]): void {
  for (const token of argv) {
    if (token === '--help' || token === '-h') {
      console.log(usage());
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}\n${usage()}`);
  }
}

function formatCommandFailure(
  cmd: string,
  args: string[],
  result: { stdout?: string; stderr?: string; error?: NodeJS.ErrnoException | Error | null },
): string {
  return [
    `Command failed: ${cmd} ${args.join(' ')}`,
    result.error?.message ? `error:\n${result.error.message}` : '',
    result.stdout?.trim() ? `stdout:\n${result.stdout.trim()}` : '',
    result.stderr?.trim() ? `stderr:\n${result.stderr.trim()}` : '',
  ].filter(Boolean).join('\n\n');
}

function run(
  cmd: string,
  args: readonly string[],
  options: StringSpawnOptions = {},
) {
  const spawnOptions: SpawnSyncOptionsWithStringEncoding = {
    ...options,
    encoding: options.encoding ?? 'utf-8',
    stdio: options.stdio ?? 'pipe',
  };
  const { result } = spawnPlatformCommandSync(cmd, [...args], spawnOptions);
  if (result.status !== 0) {
    throw new Error(formatCommandFailure(cmd, [...args], result));
  }
  return result;
}

function resolveTarballName(packStdout: string): string {
  const jsonStart = packStdout.indexOf('[');
  if (jsonStart === -1) {
    throw new Error(`npm pack did not return JSON output\n${packStdout}`);
  }
  const packOutput = JSON.parse(packStdout.slice(jsonStart)) as Array<{ filename?: string }>;
  const tarballName = packOutput[0]?.filename;
  if (!tarballName) {
    throw new Error('npm pack did not return a tarball filename');
  }
  return tarballName;
}

async function main(): Promise<void> {
  parseArgs(process.argv.slice(2));

  const repoRoot = process.cwd();
  let tarballPath: string | undefined;

  try {
    ensureRepoDependencies(repoRoot, {
      log: (message: string) => console.log(message),
    });

    console.log('[install:packed-global] Packing current workspace...');
    const pack = run('npm', ['pack', '--json'], { cwd: repoRoot });
    const tarballName = resolveTarballName(pack.stdout as string);
    tarballPath = join(repoRoot, tarballName);

    console.log(`[install:packed-global] Installing ${tarballName} globally...`);
    run('npm', ['install', '-g', tarballPath], { cwd: repoRoot });
    console.log(`[install:packed-global] Installed ${tarballName} globally.`);
  } finally {
    if (tarballPath) {
      rmSync(tarballPath, { force: true });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      `[install:packed-global] FAILED\n${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
