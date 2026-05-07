import { describe, expect, it } from 'vitest'
import { ariaForPlannerWeekSaveStatus, STATE_MESSAGING_CONTRACT_LABEL } from '../../utils/stateMessagingContract'

describe(STATE_MESSAGING_CONTRACT_LABEL, () => {
  it('uses assertive alert only for planner save error', () => {
    expect(ariaForPlannerWeekSaveStatus('error')).toEqual({
      role: 'alert',
      ariaLive: 'assertive',
    })
  })

  it.each(['saved', 'saving', 'dirty'] as const)('uses polite status for non-error save state %s', (status) => {
    expect(ariaForPlannerWeekSaveStatus(status)).toEqual({
      role: 'status',
      ariaLive: 'polite',
    })
  })
})
