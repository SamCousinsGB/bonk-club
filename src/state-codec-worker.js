import { encodeState, decodeState } from "./state-codec.js";
import { expandSnapshot } from "./snapshot-wire.js";
import { WreckReplayer } from "./wreck-motion.js";
import { FlightReplayer } from "./flight-replay.js";
import { MatterReplayer } from "./matter-replay.js";
const terrain = new WreckReplayer();
const flights = new FlightReplayer(), motionFlights = new FlightReplayer();
const matter = new MatterReplayer();
self.onmessage = async ({ data: { id, operation, value } }) => {
  try {
    const result = await (operation === "motion" ? motionFlights.expand(value) :
      operation === "expand" ? expandSnapshot(value, () => true, terrain, flights, matter) :
      operation === "encode" ? encodeState(value) : decodeState(value));
    self.postMessage({ id, value: result }, result instanceof Uint8Array ? [result.buffer] : []);
  } catch { self.postMessage({ id, error: true }); }
};
