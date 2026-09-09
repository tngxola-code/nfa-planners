import fs from 'node:fs';

const requiredWorkspaceScripts = {
  backend: ['lint', 'typecheck', 'test', 'build'],
  frontend: ['lint', 'typecheck', 'test', 'build']
};

let failed = false;

for (const [workspace, requiredScripts] of Object.entries(
  requiredWorkspaceScripts
)) {
  const packagePath = `${workspace}/package.json`;

  if (!fs.existsSync(packagePath)) {
    console.error(`FAIL: missing ${packagePath}`);
    failed = true;
    continue;
  }

  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const scripts = pkg.scripts ?? {};

  for (const script of requiredScripts) {
    if (!scripts[script]) {
      console.error(
        `FAIL: workspace "${workspace}" is missing required script "${script}"`
      );
      failed = true;
    }
  }
}

if (failed) {
  console.error('\nWorkspace quality contract FAILED.');
  process.exit(1);
}

console.log(
  'Workspace quality contract PASSED: backend/frontend expose lint, typecheck, test and build.'
);
