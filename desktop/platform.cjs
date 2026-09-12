// No native Steam driver has been selected or verified yet. This status is
// intentionally fail-closed, including when an App ID is supplied for building.
function steamAppId(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!/^[1-9][0-9]{0,9}$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > 0xffffffff || Number(value) === 480)
    throw new Error('Use Bonk Club\'s real Steam App ID. Demo/placeholder IDs are not supported.');
  return Number(value);
}
function platformStatus(config) {
  return {
    platform: 'steam', appId: steamAppId(config.steamAppId),
    network: { available: false, reason: 'steam-integration-pending' },
    account: { status: 'unavailable', subject: null },
    progression: { status: 'unavailable', authority: null },
  };
}
module.exports = { steamAppId, platformStatus };
