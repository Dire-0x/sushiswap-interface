import { useMemo } from 'react'
import { useUserMistXTipMargin } from '../state/user/hooks'
import useLatestGasPrice from './useLatestGasPrice'
import { BribeEstimate, Trade } from '@alchemistcoin/sdk'
import { DEFAULT_MISTX_TIP_MARGIN } from '../constants'

export default function useMistXMinerTipEstimate(): BribeEstimate | null {
  const [userMistXTipMargin] = useUserMistXTipMargin()
  const userTipMarginString = String(userMistXTipMargin || DEFAULT_MISTX_TIP_MARGIN)
  const gasPrice = useLatestGasPrice()
  let gasPriceString: string | null = null
  if (gasPrice) gasPriceString = gasPrice.toString()
  return useMemo(() => {
    if (!gasPriceString) return null
    return Trade.estimateBribeAmounts(gasPriceString, userTipMarginString)
  }, [gasPriceString, userTipMarginString])
}
