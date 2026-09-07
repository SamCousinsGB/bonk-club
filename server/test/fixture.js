import { createRoomServer } from "../app.js";
const { server } = createRoomServer(
  {
    hostname: "rooms.example",
    origins: ["https://game.example"],
    turnSecret: "a".repeat(64),
  },
  { revision: "test-revision" },
);
server.listen(0, "127.0.0.1", () => process.send(server.address().port));
