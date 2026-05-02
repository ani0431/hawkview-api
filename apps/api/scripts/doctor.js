
```js
const { execSync } = require("child_process");

const commands = [
  "node -v",
  "pnpm -v",
  "pnpm exec prisma -v",
  "docker ps",
];

commands.forEach((cmd) => {
  try {
    console.log(`\n>>> ${cmd}`);
    console.log(execSync(cmd).toString());
  } catch (e) {
    console.error(`FAILED: ${cmd}`);
  }
});