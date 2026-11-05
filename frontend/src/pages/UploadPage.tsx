import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Logo } from '../components/Logo'
import { Dropzone } from '../components/Dropzone'
import { P2PSender } from '../components/P2PSender'
import { AlertIcon, ArrowRightIcon } from '../components/icons'
import { uploadFile } from '../api'
const MAX = 1024 * 1024 * 1024
const TTLS = [
  { label: '30 sec', v: 30 },
  { label: '5 min', v: 300 },
  { label: '15 min', v: 900 },
  { label: '1 hour', v: 3600 },
]

type Mode = 'normal' | 'p2p'
export function UploadPage() {
  const nav = useNavigate()
  const [mode, setMode] = useState<Mode>('normal')
  const [ttl, setTtl] = useState(300)
  const [pct, setPct] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const [oversize, setOversize] = useState<File | null>(null)
  // active peer-to-peer send session
  const [p2pFile, setP2pFile] = useState<File | null>(null)
  async function handle(file: File) {
    setErr('')
    setOversize(null)
    if (file.size === 0) return setErr('That file is empty.')

    if (mode === 'p2p') {
      setP2pFile(file)
      return
    }

    if (file.size > MAX) {
      setOversize(file)
      return
    }

    try {
      setPct(0)
      const token = await uploadFile(file, ttl, setPct)
      nav(`/f/${token}`)
    } catch (e) {
      setErr((e as Error).message)
      setPct(null)
    }
  }
  if (p2pFile) {
    return (
      <Layout>
        <div className="page">
          <section className="hero">
            <Logo className="hero-mark" />
            <span className="eyebrow">Peer-to-peer</span>
            <h1>
              Direct <span className="grad">transfer</span>
            </h1>
            <p>Send this link to the other person. The file goes straight to them.</p>
          </section>
          <P2PSender file={p2pFile} onCancel={() => setP2pFile(null)} />
        </div>
      </Layout>
    )
  }
  return (
    <Layout>
      <div className="page">
        <section className="hero">
          <Logo className="hero-mark" />
          <span className="eyebrow">No account and also self-destructing</span>
          <h1>
            Orang<span className="grad">Move</span>
          </h1>
          <p>Share a file with a private link. No sign-up, nothing kept. It deletes itself.</p>
        </section>
        <section className="card">
          <span className="field-label">How to send</span>
          <div className="ttl-row">
            <button
              className={mode === 'normal' ? 'ttl-pill active' : 'ttl-pill'}
              onClick={() => { setMode('normal'); setErr(''); setOversize(null) }}
              disabled={pct !== null}
            >
              Normal · up to 1 GiB
            </button>
            <button
              className={mode === 'p2p' ? 'ttl-pill active' : 'ttl-pill'}
              onClick={() => { setMode('p2p'); setErr(''); setOversize(null) }}
              disabled={pct !== null}
            >
              P2P · direct, no limit
            </button>
          </div>

          {mode === 'normal' ? (
            <>
              <span className="field-label">Keep it for</span>
              <div className="ttl-row">
                {TTLS.map((t) => (
                  <button
                    key={t.v}
                    className={t.v === ttl ? 'ttl-pill active' : 'ttl-pill'}
                    onClick={() => setTtl(t.v)}
                    disabled={pct !== null}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="notice warn">
              <AlertIcon className="notice-ico" />
              <span>
                <strong>Peer-to-peer:</strong> the file streams straight from your
                device to theirs. No size limit, nothing stored or scanned. Keep this
                tab open during the transfer, and only use it with people you really
                trust.
              </span>
            </div>
          )}
          {pct === null ? (
            <Dropzone
              onFile={handle}
              hint={mode === 'p2p' ? 'Any size · streamed directly, never uploaded' : 'Up to 1 GiB · no executables'}
            />
          ) : (
            <div className="progress">
              <div className="progress-label">
                <span>Uploading…</span>
                <span className="pct">{pct}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          {oversize && (
            <div className="notice warn">
              <AlertIcon className="notice-ico" />
              <span>
                That file is over 1 GiB, too big for a normal upload.{' '}
                <button
                  className="linklike"
                  onClick={() => { setMode('p2p'); setP2pFile(oversize) }}
                >
                  Send it directly with P2P instead <ArrowRightIcon style={{ width: 13, height: 13, verticalAlign: '-2px' }} />
                </button>
              </span>
            </div>
          )}

          {err && (
            <div className="notice error">
              <AlertIcon className="notice-ico" />
              <span>{err}</span>
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}