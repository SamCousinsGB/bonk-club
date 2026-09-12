// Account progression is an external service, never a field in preferences or
// a gameplay snapshot. There is deliberately no client-side award/set API.
// This is a UI boundary, not a security boundary: enforcement belongs to the
// managed backend and every honest recipient of an entitlement proof.
const unavailable = () => Object.freeze({ status: 'unavailable', account: null, progression: null });
export function createProgressionClient(service = null) {
  return Object.freeze({
    async read() {
      if (!service) return unavailable();
      return service.read();
    },
    async requestEquip(cosmeticId) {
      if (typeof cosmeticId !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(cosmeticId)) throw new Error('Invalid cosmetic selection.');
      if (!service) throw new Error('Account progression is unavailable.');
      // The service derives the active account from authentication and verifies
      // ownership itself. An equip request never carries XP or claimed ownership.
      return service.requestEquip(cosmeticId);
    },
  });
}
