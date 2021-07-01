import { Currency, CurrencyAmount, Pair, Trade, TradeType } from '@sushiswap/sdk'
import {
  MinTradeEstimate,
  Exchange,
  Trade as MistXTrade,
  Pair as MistXPair,
  CurrencyAmount as MistXCurrencyAmount,
  Currency as MistXCurrency,
  Token as MistXToken,
} from '@alchemistcoin/sdk'
import { PairState, useV2Pairs } from './useV2Pairs'

import { BETTER_TRADE_LESS_HOPS_THRESHOLD } from '../constants'
import { isTradeBetter } from '../functions/trade'
import { useAllCurrencyCombinations } from './useAllCurrencyCombinations'
import { useMemo } from 'react'
import { BigNumber } from '@ethersproject/bignumber'
import useLatestGasPrice from './useLatestGasPrice'
import { useUserMistXTipMargin } from '../state/user/hooks'

function useAllCommonPairs(currencyA?: Currency, currencyB?: Currency): Pair[] {
  const allCurrencyCombinations = useAllCurrencyCombinations(currencyA, currencyB)

  const allPairs = useV2Pairs(allCurrencyCombinations)

  // only pass along valid pairs, non-duplicated pairs
  return useMemo(
    () =>
      Object.values(
        allPairs
          // filter out invalid pairs
          .filter((result): result is [PairState.EXISTS, Pair] => Boolean(result[0] === PairState.EXISTS && result[1]))
          // filter out duplicated pairs
          .reduce<{ [pairAddress: string]: Pair }>((memo, [, curr]) => {
            memo[curr.liquidityToken.address] = memo[curr.liquidityToken.address] ?? curr
            return memo
          }, {})
      ),
    [allPairs]
  )
}

const MAX_HOPS = 3

/**
 * Returns the best trade for the exact amount of tokens in to the given token out
 */
export function useV2TradeExactIn(
  currencyAmountIn?: CurrencyAmount<Currency>,
  currencyOut?: Currency,
  { maxHops = MAX_HOPS } = {}
): Trade<Currency, Currency, TradeType.EXACT_INPUT> | null {
  const allowedPairs = useAllCommonPairs(currencyAmountIn?.currency, currencyOut)

  return useMemo(() => {
    if (currencyAmountIn && currencyOut && allowedPairs.length > 0) {
      if (maxHops === 1) {
        return (
          Trade.bestTradeExactIn(allowedPairs, currencyAmountIn, currencyOut, {
            maxHops: 1,
            maxNumResults: 1,
          })[0] ?? null
        )
      }
      // search through trades with varying hops, find best trade out of them
      let bestTradeSoFar: Trade<Currency, Currency, TradeType.EXACT_INPUT> | null = null
      for (let i = 1; i <= maxHops; i++) {
        const currentTrade: Trade<Currency, Currency, TradeType.EXACT_INPUT> | null =
          Trade.bestTradeExactIn(allowedPairs, currencyAmountIn, currencyOut, {
            maxHops: i,
            maxNumResults: 1,
          })[0] ?? null
        // if current trade is best yet, save it
        if (isTradeBetter(bestTradeSoFar, currentTrade, BETTER_TRADE_LESS_HOPS_THRESHOLD)) {
          bestTradeSoFar = currentTrade
        }
      }
      return bestTradeSoFar
    }

    return null
  }, [allowedPairs, currencyAmountIn, currencyOut, maxHops])
}

/**
 * Returns the best trade for the token in to the exact amount of token out
 */
export function useV2TradeExactOut(
  currencyIn?: Currency,
  currencyAmountOut?: CurrencyAmount<Currency>,
  { maxHops = MAX_HOPS } = {}
): Trade<Currency, Currency, TradeType.EXACT_OUTPUT> | null {
  const allowedPairs = useAllCommonPairs(currencyIn, currencyAmountOut?.currency)

  return useMemo(() => {
    if (currencyIn && currencyAmountOut && allowedPairs.length > 0) {
      if (maxHops === 1) {
        return (
          Trade.bestTradeExactOut(allowedPairs, currencyIn, currencyAmountOut, {
            maxHops: 1,
            maxNumResults: 1,
          })[0] ?? null
        )
      }
      // search through trades with varying hops, find best trade out of them
      let bestTradeSoFar: Trade<Currency, Currency, TradeType.EXACT_OUTPUT> | null = null
      for (let i = 1; i <= maxHops; i++) {
        const currentTrade =
          Trade.bestTradeExactOut(allowedPairs, currencyIn, currencyAmountOut, {
            maxHops: i,
            maxNumResults: 1,
          })[0] ?? null
        if (isTradeBetter(bestTradeSoFar, currentTrade, BETTER_TRADE_LESS_HOPS_THRESHOLD)) {
          bestTradeSoFar = currentTrade
        }
      }
      return bestTradeSoFar
    }
    return null
  }, [currencyIn, currencyAmountOut, allowedPairs, maxHops])
}

export function useMistXMinTradeAmount(currencyIn?: Currency, currencyOut?: Currency): MinTradeEstimate {
  const gasPriceToBeat = useLatestGasPrice()
  const [tipMargin] = useUserMistXTipMargin()
  const allowedPairs = useAllCommonPairs(currencyIn, currencyOut).map((pair: Pair): MistXPair => {
    const r1 = MistXCurrencyAmount.fromRawAmount(
      pair.token0 as unknown as MistXToken,
      pair.reserve0.quotient.toString()
    )
    const r2 = MistXCurrencyAmount.fromRawAmount(
      pair.token1 as unknown as MistXToken,
      pair.reserve1.quotient.toString()
    )
    return new MistXPair(r1, r2, Exchange.SUSHI)
  })
  console.log('minTradeAmount', tipMargin, currencyIn, currencyOut, gasPriceToBeat)
  const sushiMinTradeEstimate = useMemo(() => {
    if (!currencyIn || !currencyOut || !gasPriceToBeat || !tipMargin || !allowedPairs.length) return null
    return MistXTrade.estimateMinTradeAmounts(
      allowedPairs,
      currencyIn as unknown as MistXCurrency,
      currencyOut as unknown as MistXCurrency,
      gasPriceToBeat.toString(),
      tipMargin.toString(),
      1
    )
  }, [currencyIn, currencyOut, gasPriceToBeat, tipMargin, allowedPairs])
  return sushiMinTradeEstimate
}
