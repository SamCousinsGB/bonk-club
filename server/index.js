import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRoomServer } from "./app.js";

try {
  const config = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const { server } = createRoomServer(config, { revision });
  server.listen(8787, "127.0.0.1", () =>
    console.log("Room service listening on loopback port 8787."),
  );
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
} catch {
  console.error(
    "Room service could not start. Check its private configuration.",
  );
  process.exitCode = 1;
}
