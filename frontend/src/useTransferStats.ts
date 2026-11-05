import { useCallback, useRef, useState } from 'react'
export interface TransferStats {
  /** smooth transfer rate in bytes/sec */
  bps: number
  /** estimated seconds remaining */
  etaSecs: number
}

export function useTransferStats() {
  const last = useRef<{ t: number; bytes: number } | null>(null)
  const ema = useRef(0)
  const [stats, setStats] = useState<TransferStats>({ bps: 0, etaSecs: Infinity })
  const sample = useCallback((bytes: number, total: number) => {
    const now = performance.now()
    const prev = last.current
    if (!prev) {
      last.current = { t: now, bytes }
      return
    }
    const dt = (now - prev.t) / 1000
    if (dt < 0.25) return // measure at most ~4x/sec
    const db = bytes - prev.bytes
    last.current = { t: now, bytes }
    if (db < 0) return
    const inst = db / dt
    ema.current = ema.current === 0 ? inst : ema.current * 0.6 + inst * 0.4
    const remaining = Math.max(0, total - bytes)
    setStats({
      bps: ema.current,
      etaSecs: ema.current > 0 ? remaining / ema.current : Infinity,
    })
  }, [])
  const reset = useCallback(() => {
    last.current = null
    ema.current = 0
    setStats({ bps: 0, etaSecs: Infinity })
  }, [])

  return { stats, sample, reset }
}