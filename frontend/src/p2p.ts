// Peer-to-peer file transfer over WebRTC.
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

// 16 KiB is the chunk size every browser's data channel handles safely
const CHUNK = 16 * 1024
// pause sending when this much is buffered resume when it drains, which keeps memory
// flat while streaming multi-gigabyte files.
const HIGH_WATER = 8 * 1024 * 1024
const LOW_WATER = 1 * 1024 * 1024

export interface Meta {
  name: string
  size: number
}

export interface P2PCallbacks {
  onStatus?: (s: string) => void
  onProgress?: (pct: number, bytes: number) => void
  onError?: (msg: string) => void
  onDone?: () => void
}

export interface Sink {
  write(chunk: ArrayBuffer): Promise<void>
  close(): Promise<void>
}

export interface P2PHandle {
  cancel(): void
}

function signalUrl(room: string): string {
  const base = API_BASE || location.origin
  return `${base.replace(/^http/, 'ws')}/api/signal/${room}`
}

export function newRoom(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

let iceCache: { servers: RTCIceServer[]; exp: number } | null = null

// Ask our backend for turn credentials and prepend the builtin stun servers
async function getIceServers(): Promise<RTCIceServer[]> {
  if (iceCache && Date.now() < iceCache.exp) return iceCache.servers
  let servers = [...ICE_SERVERS]
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(`${API_BASE}/api/turn`, { signal: ctrl.signal })
    clearTimeout(t)
    if (res.ok) {
      const turn = (await res.json()).iceServers
      if (turn && !Array.isArray(turn) && turn.urls) servers = [...servers, turn as RTCIceServer]
    }
  } catch {
    /* stun only */
  }
  iceCache = { servers, exp: Date.now() + 5 * 60 * 1000 }
  return servers
}

// Shared WebRTC plumbing for both sides
function connect(
  room: string,
  isSender: boolean,
  cb: P2PCallbacks,
  onChannel: (dc: RTCDataChannel) => void,
): P2PHandle {
  let closed = false
  let ws: WebSocket | null = null
  let pc: RTCPeerConnection | null = null

  const cleanup = () => {
    if (closed) return
    closed = true
    try { pc?.close() } catch { /* already gone */ }
    try { ws?.close() } catch { /* already gone */ }
  }

  // Resolve ICE servers (not ones from usa btw :DD)
  void (async () => {
    const iceServers = await getIceServers()
    if (closed) return
    const sock = new WebSocket(signalUrl(room))
    const conn = new RTCPeerConnection({ iceServers })
    ws = sock
    pc = conn
    let negotiated = false
    const pendingIce: RTCIceCandidateInit[] = []
    const send = (m: object) => sock.readyState === WebSocket.OPEN && sock.send(JSON.stringify(m))

    conn.onicecandidate = (e) => {
      if (e.candidate) send({ kind: 'ice', candidate: e.candidate })
    }
    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'connected') cb.onStatus?.('Connected, transferring…')
      if (conn.connectionState === 'failed') {
        cb.onError?.("Couldn't open a direct connection (the network may block P2P). Try a normal upload.")
        cleanup()
      }
    }

    const startOffer = async () => {
      if (negotiated) return
      negotiated = true
      const offer = await conn.createOffer()
      await conn.setLocalDescription(offer)
      send({ kind: 'offer', sdp: offer })
    }

    const drainIce = async () => {
      for (const c of pendingIce.splice(0)) {
        try { await conn.addIceCandidate(c) } catch { /* ignore stray candidate */ }
      }
    }

    sock.onopen = () => {
      cb.onStatus?.(isSender ? 'Waiting for the other person to open the link…' : 'Connecting…')
      send({ kind: 'hello' })
    }

    sock.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data)
      switch (msg.kind) {
        case 'hello':
          if (isSender) await startOffer()
          else send({ kind: 'hello' })
          break
        case 'offer':
          await conn.setRemoteDescription(msg.sdp)
          await drainIce()
          {
            const answer = await conn.createAnswer()
            await conn.setLocalDescription(answer)
            send({ kind: 'answer', sdp: answer })
          }
          break
        case 'answer':
          await conn.setRemoteDescription(msg.sdp)
          await drainIce()
          break
        case 'ice':
          if (conn.remoteDescription) {
            try { await conn.addIceCandidate(msg.candidate) } catch { /* stray */ }
          } else {
            pendingIce.push(msg.candidate)
          }
          break
      }
    }

    sock.onclose = () => {
      // the relay closes our socket when the other peer leaves
      if (!negotiated && isSender) {
        cb.onError?.('The other person disconnected before the transfer started.')
      }
    }
    sock.onerror = () => cb.onError?.('Signaling connection failed.')

    if (isSender) {
      const dc = conn.createDataChannel('file', { ordered: true })
      onChannel(dc)
    } else {
      conn.ondatachannel = (e) => onChannel(e.channel)
    }
  })()

  return { cancel: cleanup }
}

export function sendFile(file: File, room: string, cb: P2PCallbacks): P2PHandle {
  const handle = connect(room, true, cb, (dc) => {
    dc.binaryType = 'arraybuffer'
    dc.bufferedAmountLowThreshold = LOW_WATER

    dc.onopen = () => {
      dc.send(JSON.stringify({ t: 'meta', name: file.name, size: file.size }))
    }

    dc.onmessage = async (ev) => {
      const ctrl = JSON.parse(ev.data)
      if (ctrl.t !== 'accept') return

      cb.onStatus?.('Sending…')
      let offset = 0
      while (offset < file.size) {
        // back off while the send buffer is full so we don't blow up memory
        if (dc.bufferedAmount > HIGH_WATER) {
          await new Promise<void>((res) => {
            dc.onbufferedamountlow = () => res()
          })
        }
        const slice = file.slice(offset, offset + CHUNK)
        const buf = await slice.arrayBuffer()
        if (dc.readyState !== 'open') return
        dc.send(buf)
        offset += buf.byteLength
        cb.onProgress?.(Math.round((offset / file.size) * 100), offset)
      }
      dc.send(JSON.stringify({ t: 'done' }))
      cb.onStatus?.('Sent ✓. Keep this tab open until they finish downloading.')
      cb.onDone?.()
    }
  })
  return handle
}

export function receiveFile(
  room: string,
  openSink: (meta: Meta) => Promise<Sink | null>,
  cb: P2PCallbacks,
): P2PHandle {
  let sink: Sink | null = null
  let total = 0
  let received = 0

  const handle = connect(room, false, cb, (dc) => {
    dc.binaryType = 'arraybuffer'

    dc.onmessage = async (ev) => {
      if (typeof ev.data === 'string') {
        const ctrl = JSON.parse(ev.data)
        if (ctrl.t === 'meta') {
          total = ctrl.size
          sink = await openSink({ name: ctrl.name, size: ctrl.size })
          if (!sink) {
            handle.cancel()
            return
          }
          dc.send(JSON.stringify({ t: 'accept' }))
          cb.onStatus?.('Receiving…')
        } else if (ctrl.t === 'done') {
          await sink?.close()
          cb.onProgress?.(100, received)
          cb.onStatus?.('Done ✓')
          cb.onDone?.()
          handle.cancel()
        }
        return
      }
      // Binary: a file chunk.
      if (!sink) return
      await sink.write(ev.data as ArrayBuffer)
      received += (ev.data as ArrayBuffer).byteLength
      if (total) cb.onProgress?.(Math.round((received / total) * 100), received)
    }
  })
  return handle
}


// build a Sink for the incoming file
export async function makeSink(meta: Meta): Promise<Sink> {
  const picker = (window as unknown as {
    showSaveFilePicker?: (o: { suggestedName?: string }) => Promise<FileSystemFileHandle>
  }).showSaveFilePicker

  if (picker) {
    const fileHandle = await picker({ suggestedName: meta.name })
    const writable = await fileHandle.createWritable()
    return {
      write: (chunk) => writable.write(chunk),
      close: () => writable.close(),
    }
  }

  // collect in memory, then save as a Blob.
  const parts: ArrayBuffer[] = []
  return {
    write: async (chunk) => { parts.push(chunk) },
    close: async () => {
      const blob = new Blob(parts)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = meta.name
      a.click()
      URL.revokeObjectURL(url)
    },
  }
}

export const canStreamToDisk = 'showSaveFilePicker' in window