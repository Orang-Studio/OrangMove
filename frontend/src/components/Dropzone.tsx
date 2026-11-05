import { useRef, useState } from 'react'
import { BoxIcon } from './icons'
export function Dropzone({
  onFile,
  hint = 'Up to 1 GiB',
}: {
  onFile: (f: File) => void
  hint?: string
}) {
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return (
    <div
      className={drag ? 'dropzone drag' : 'dropzone'}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        const f = e.dataTransfer.files[0]
        if (f) onFile(f)
      }}
    >
      <div className="dropzone-icon">
        <BoxIcon />
      </div>
      <div className="dropzone-title">Drag a file here, or click to browse</div>
      <div className="dropzone-hint">{hint}</div>
      <input
        ref={input}
        type="file"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
        }}
      />
    </div>
  )
}