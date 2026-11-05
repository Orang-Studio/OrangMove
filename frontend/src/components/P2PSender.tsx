import { useEffect, useRef, useState } from 'react'
import { sendFile, newRoom, type P2PHandle } from '../p2p'
import { humanSize, humanRate, humanDuration } from '../format'
import { useTransferStats } from '../useTransferStats'
import { AlertIcon, CheckIcon, CopyIcon, ShareIcon } from './icons'
export function P2PSender({ file, onCancel }: { file: File; onCancel: () => void }) {
  const [room] = useState(newRoom)
  const [status, setStatus] = useState('Starting…')
  const [pct, setPct] = useState(0)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const { stats, sample, reset } = useTransferStats()
  const handleRef = useRef<P2PHandle | null>(null)

  const link = `${location.origin}/p/${room}`
  useEffect(() => {
    reset()
    handleRef.current = sendFile(file, room, {
      onStatus: setStatus,
      onProgress: (p, bytes) => { setPct(p); sample(bytes, file.size) },
      onError: setErr,
    })
    return () => handleRef.current?.cancel()
  }, [file, room, sample, reset])

  function copy() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="card">
      <div className="file-row">
        <span className="file-badge">
          <ShareIcon />
        </span>
        <div>
          <div className="result-name">{file.name}</div>
          <div className="result-meta">{humanSize(file.size)} · direct peer-to-peer</div>
        </div>
      </div>

      <div className="notice warn">
        <AlertIcon className="notice-ico" />
        <span>
          <strong>Only share this with someone you really trust.</strong> This sends
          the file straight from your device to theirs. It isn’t scanned or stored,
          and the two of you will see each other’s IP address.
        </span>
      </div>

      <div className="link-box">
        <input value={link} readOnly onFocus={(e) => e.target.select()} />
        <button className="btn primary" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <div className="progress">
        <div className="progress-label">
          <span>{status}</span>
          <span className="pct">{pct}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        {pct > 0 && pct < 100 && (
          <div className="result-meta" style={{ marginTop: 8 }}>
            {humanRate(stats.bps)}
            {stats.bps > 0 && Number.isFinite(stats.etaSecs) ? ` · ${humanDuration(stats.etaSecs)} left` : ''}
          </div>
        )}
      </div>

      <p className="result-meta" style={{ marginTop: 14 }}>
        Keep this tab open until they finish downloading. The file lives only on
        your device.
      </p>

      {err && (
        <div className="notice error">
          <AlertIcon className="notice-ico" />
          <span>{err}</span>
        </div>
      )}

      <div className="actions" style={{ marginTop: 16 }}>
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  )
}