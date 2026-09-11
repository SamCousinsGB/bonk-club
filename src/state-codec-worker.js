import { encodeState, decodeState } from "./state-codec.js";
import { expandSnapshot } from "./snapshot-wire.js";
import { WreckReplayer } from "./wreck-motion.js";
const terrain = new WreckReplayer();
self.onmessage = async ({ data: { id, operation, value } }) => {
  try {
    const result = await (operation === "expand" ? expandSnapshot(value, () => true, terrain) :
      operation === "encode" ? encodeState(value) : decodeState(value));
    self.postMessage({ id, value: result }, result instanceof Uint8Array ? [result.buffer] : []);
  } catch { self.postMessage({ id, error: true }); }
};
