/** True when Nitro should log cold-start migration timing. */
export function isStartupTimingEnabled(): boolean {
  return process.env.MEALPREPPER_STARTUP_TIMING === '1'
}
