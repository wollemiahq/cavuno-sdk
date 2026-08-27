import { runDoctor } from './doctor/run';
import { runSetup } from './setup/run';

// Deterministic two-verb CLI, zero runtime deps, argv parsed by hand:
// `cavuno-board setup`  — copy version-matched skills + print env
// `cavuno-board doctor` — non-destructive static checks and optional
// read probes against `--frontend <url>`.
// The agent-driven wiring lives in the skills, not here.

async function doctor(argv: string[]): Promise<void> {
  const frontendFlag = argv.indexOf('--frontend');
  const frontendUrl = frontendFlag >= 0 ? argv[frontendFlag + 1] : undefined;

  const { results, summary } = await runDoctor({
    env: {
      apiUrl: process.env.PUBLIC_CAVUNO_API_URL,
      boardKey: process.env.PUBLIC_CAVUNO_BOARD,
    },
    frontendUrl,
  });

  console.log('\n@cavuno/board doctor');
  for (const result of results) {
    const mark =
      result.status === 'pass'
        ? '✓'
        : result.status === 'fail'
          ? '✗'
          : result.status === 'warn'
            ? '!'
            : '−';
    console.log(
      `  ${mark} [tier ${result.tier}] ${result.id} — ${result.detail}`,
    );
  }
  console.log(
    `\n${summary.passed.length} passed, ${summary.failed.length} failed, ${summary.skipped.length} skipped, ${summary.warned.length} warned`,
  );
  if (summary.skipped.length > 0) {
    console.log(`  Skipped (NOT verified): ${summary.skipped.join(', ')}`);
  }
  if (summary.warned.length > 0) {
    console.log(`  Warned: ${summary.warned.join(', ')}`);
  }
  if (!frontendUrl) {
    console.log(
      '  Pass --frontend <url> to run the read probes against your board frontend.',
    );
  }
  process.exit(summary.exitCode);
}

function main(): void {
  const verb = process.argv[2];

  if (verb === 'doctor') {
    doctor(process.argv.slice(3)).catch((error: unknown) => {
      console.error('doctor crashed:', error);
      process.exit(1);
    });
    return;
  }

  if (verb !== 'setup') {
    console.error('Usage: cavuno-board <setup|doctor>');
    process.exit(1);
  }

  const result = runSetup();

  console.log(`\n@cavuno/board setup — v${result.version}`);
  console.log(
    `Detected framework: ${result.framework ?? 'none (core skills only)'}`,
  );
  console.log(
    `Copied ${result.copied.length} skills → ${result.targetDirs.join(', ')}`,
  );
  for (const name of result.copied) console.log(`  - ${name}`);

  console.log('\nNext steps:');
  console.log('  1. Set your board publishable key:');
  console.log(
    '       PUBLIC_CAVUNO_BOARD=pk_...   # your board publishable key',
  );
  console.log(
    '       # Optional API override: PUBLIC_CAVUNO_API_URL=https://api.cavuno.com',
  );
  console.log('  2. Ask your coding agent: "set up my Cavuno board".');
  console.log('     It reads the cavuno-board-setup skill first.');
  console.log(
    '\n  Re-run `npx @cavuno/board setup` after upgrading to refresh skills.',
  );
}

main();
