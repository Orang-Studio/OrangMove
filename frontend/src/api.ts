//in production the API + files live on their own subdomain
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

export interface Meta {
  name: string
  content_type: string
  size: number
  expires_at: number
}

export function uploadFile(
  file: File,
  ttl: number,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('ttl', String(ttl))
    form.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/api/upload`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status === 201) {
        resolve(JSON.parse(xhr.responseText).token)
      } else if (xhr.status === 429) {
        reject(new Error('Too many uploads, slow down for a moment.'))
      } else {
        reject(new Error(xhr.responseText || `Upload failed (${xhr.status}).`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error.'))
    xhr.send(form)
  })
}

export async function getMeta(token: string): Promise<Meta> {
  const res = await fetch(`${API_BASE}/api/meta/${token}`)
  if (!res.ok) throw new Error('not found or expired')
  return res.json()
}

export const fileUrl = (token: string) => `${API_BASE}/api/file/${token}`
export const viewUrl = (token: string) => `${API_BASE}/api/view/${token}`