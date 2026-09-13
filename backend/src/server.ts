import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../.env",
  ),
});

const [{ createApp }, { prisma }, { createPrismaStore }] = await Promise.all([
  import("./app.js"),
  import("./lib/prisma.js"),
  import("./prismaStore.js"),
]);

const port = Number(process.env.PORT ?? 4000);

await prisma.$connect();

const store = createPrismaStore(prisma);
const app = await createApp({ store, prisma });

const server = app.listen(port, () => {
  console.log(`[nfa-console] backend listening on http://127.0.0.1:${port}`);
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[nfa-console] ${signal} received, closing`);

  server.close(async (error) => {
    try {
      await prisma.$disconnect();
    } finally {
      if (error) {
        console.error("[nfa-console] shutdown failed", error);
        process.exit(1);
      }

      process.exit(0);
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
