import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { receiveFile, makeSink, canStreamToDisk, type Meta, type Sink, type P2PHandle } from '../p2p'
import { humanSize, humanRate, humanDuration } from '../format'
import { useTransferStats } from '../useTransferStats'
import { AlertIcon, DownloadIcon, FileIcon } from '../components/icons'
const BIG = 1024 * 1024 * 1024 // 1 GB
export function P2PReceivePage() {
  const { room = '' } = useParams()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [status, setStatus] = useState('Connecting to the sender…')
  const [pct, setPct] = useState(0)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const { stats, sample } = useTransferStats()
  const handleRef = useRef<P2PHandle | null>(null)
  const totalRef = useRef(0)
  const resolveSink = useRef<((s: Sink | null) => void) | null>(null)

  useEffect(() => {
    handleRef.current = receiveFile(
      room,
      (m) =>
        new Promise<Sink | null>((res) => {
          setMeta(m)
          totalRef.current = m.size
          setStatus('Ready to download.')
          resolveSink.current = res
        }),
      {
        onStatus: setStatus,
        onProgress: (p, bytes) => { setPct(p); sample(bytes, totalRef.current) },
        onError: setErr,
      },
    )
    return () => handleRef.current?.cancel()
  }, [room, sample])

  async function accept() {
    if (!meta || !resolveSink.current) return
    try {
      const sink = await makeSink(meta)
      setSaving(true)
      resolveSink.current(sink)
    } catch {
      // user dismissed the save dialog
      setStatus('Save cancelled. Click to try again.')
    }
  }

  const tooBigForMemory = meta && !canStreamToDisk && meta.size > BIG
  return (
    <Layout>
      <div className="page">
        <section className="hero">
          <span className="eyebrow">Peer-to-peer</span>
          <h1>
            Incoming <span className="grad">file</span>
          </h1>
          <p>Someone is sending you a file directly from their device.</p>
        </section>
        <section className="card">
          {err ? (
            <div className="notice error">
              <AlertIcon className="notice-ico" />
              <span>{err}</span>
            </div>
          ) : !meta ? (
            <p className="loading">{status}</p>
          ) : (
            <>
              <div className="file-row">
                <span className="file-badge">
                  <FileIcon />
                </span>
                <div>
                  <div className="result-name">{meta.name}</div>
                  <div className="result-meta">{humanSize(meta.size)} · direct transfer</div>
                </div>
              </div>
              <div className="notice warn">
                <AlertIcon className="notice-ico" />
                <span>
                  <strong>Only accept files from people you really trust.</strong> This
                  comes straight from the sender’s device. It hasn’t been scanned for
                  anything, and they can see your IP address.
                </span>
              </div>
              {tooBigForMemory && (
                <div className="notice warn">
                  <AlertIcon className="notice-ico" />
                  <span>
                    Your browser can’t stream this to disk, so it’ll be held in memory
                    first. A file this large may fail. Chrome or Edge handle it best.
                  </span>
                </div>
              )}
              {!saving ? (
                <div className="actions" style={{ marginTop: 16 }}>
                  <button className="btn primary" onClick={accept}>
                    <DownloadIcon /> Save file
                  </button>
                </div>
              ) : (
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
              )}
            </>
          )}
        </section>
      </div>
    </Layout>
  )
}