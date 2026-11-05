// The official Oranges.LT orange-slice mark, copied into the bundle from
// the brand assets (icons/orange.png). Kept as an <img> so it stays pixel-true
// to the rest of the Oranges.LT family of sites.
import orange from '../assets/orange.png'

export function Logo({ className }: { className?: string }) {
  return <img className={className} src={orange} alt="" aria-hidden="true" draggable={false} />
}
