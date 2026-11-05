import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { getMeta, fileUrl, viewUrl, type Meta } from '../api'
import { humanSize } from '../format'
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  FileIcon,
} from '../components/icons'

function useCountdown(expiresAt: number | undefined) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (!expiresAt) return
    const tick = () => setLeft(Math.max(0, expiresAt - Math.floor(Date.now() / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  return left
}

export function ResultPage() {
  const { token = '' } = useParams()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const [show, setShow] = useState(false)
  const link = `${location.origin}/f/${token}`
  const left = useCountdown(meta?.expires_at)

  useEffect(() => {
    getMeta(token)
      .then(setMeta)
      .catch((e) => setErr(e.message))
  }, [token])

  function copy() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (err || (meta && left === 0)) {
    return (
      <Layout>
        <div className="page">
          <section className="hero">
            <span className="eyebrow">Expired</span>
            <h1>
              <span className="grad">Propal</span>
            </h1>
            <p>This file has expired or never existed. Files self-destruct on their timer.</p>
          </section>
          <div style={{ textAlign: 'center' }}>
            <a className="btn primary" href="/">
              Share another file
            </a>
          </div>
        </div>
      </Layout>
    )
  }

  if (!meta) {
    return (
      <Layout>
        <div className="page">
          <section className="card">
            <p className="loading">Loading…</p>
          </section>
        </div>
      </Layout>
    )
  }

  const mins = Math.floor(left / 60)
  const secs = left % 60
  const countdown = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`

  return (
    <Layout>
      <div className="page">
        <section className="hero">
          <span className="eyebrow">Link ready</span>
          <h1>
            Ready to <span className="grad">share</span>
          </h1>
          <p>Anyone with this link can grab it for the next {countdown}.</p>
        </section>

        <section className="card">
          <div className="file-row">
            <span className="file-badge">
              <FileIcon />
            </span>
            <div>
              <div className="result-name">{meta.name}</div>
              <div className="result-meta">
                {humanSize(meta.size)} · expires in {countdown}
              </div>
            </div>
          </div>

          <div className="link-box">
            <input value={link} readOnly onFocus={(e) => e.target.select()} />
            <button className="btn primary" onClick={copy}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="actions">
            <a className="btn" href={fileUrl(token)}>
              <DownloadIcon /> Download
            </a>
            <button className="btn" onClick={() => setShow((s) => !s)}>
              {show ? <EyeOffIcon /> : <EyeIcon />}
              {show ? 'Hide preview' : 'View in browser'}
            </button>
          </div>

          {show && (
            <iframe className="preview" title="preview" src={viewUrl(token)} sandbox="" />
          )}
        </section>
      </div>
    </Layout>
  )
}