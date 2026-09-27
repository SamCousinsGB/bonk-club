export const COLOSSUS=Object.freeze({
  rise:5.5,eyes:2.5,wake:8,charge:4,fire:3,restMin:3.5,restMax:9.5,
  radius:60,sweep:380,separation:320,
});
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
export const colossusStand=age=>smooth(age/COLOSSUS.rise);
export const colossusEyeOpening=age=>smooth((age-COLOSSUS.rise)/COLOSSUS.eyes);
// chargeAt is scheduled by the host and travels with every snapshot. Age keeps
// increasing through the rests, so the standing pose never restarts with a shot.
export function colossusPhase(age,chargeAt=COLOSSUS.wake){
  const phase=age-chargeAt+1e-9;
  const firing=phase>=COLOSSUS.charge&&phase<COLOSSUS.charge+COLOSSUS.fire;
  return {phase,charge:phase<COLOSSUS.charge?clamp(phase/COLOSSUS.charge):0,
    firing,fire:clamp((phase-COLOSSUS.charge)/COLOSSUS.fire),
    cooling:clamp(1-(phase-COLOSSUS.charge-COLOSSUS.fire)/3)};
}
