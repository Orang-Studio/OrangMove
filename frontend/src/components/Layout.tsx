import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import logo from '../assets/orange.png'
const SITE = 'https://oranges.lt'
const DISCORD = 'https://discord.gg/cpkfnRuRv7'
const GITHUB = 'https://github.com/Orang-Studio'

// Same grouped nav as oranges.lt header.js
function NavDropdown({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className={open ? 'nav-dropdown open' : 'nav-dropdown'} ref={ref}>
      <button
        className="nav-btn dropdown-trigger"
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
      >
        {label} <span className="caret">&#9662;</span>
      </button>
      <div className="nav-dropdown-menu">{children}</div>
    </div>
  )
}

function useHeaderScrollHide(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let lastScrollY = window.scrollY
    function onScroll() {
      const currentScrollY = window.scrollY
      const el = ref.current
      if (!el) return
      if (currentScrollY > lastScrollY && currentScrollY > 120) {
        el.classList.add('header-hidden')
      } else {
        el.classList.remove('header-hidden')
      }
      lastScrollY = currentScrollY
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [ref])
}

export function Layout({ children }: { children: ReactNode }) {
  const headerRef = useRef<HTMLElement>(null)
  useHeaderScrollHide(headerRef)
  return (
    <div className="app-shell">
      <header ref={headerRef}>
        <div className="header-content">
          <a className="logo-container" href={SITE}>
            <img src={logo} alt="Oranges Logo" className="logo" />
            <span className="site-title">Oranges.LT</span>
          </a>
          <nav>
            <a href={`${SITE}/roadmap.html`}><button className="nav-btn">Roadmap</button></a>
            <a href={`${SITE}/creators.html`}><button className="nav-btn">Creators</button></a>
            <a href={`${SITE}/software.html`}><button className="nav-btn">Software</button></a>
            <NavDropdown label="Apps">
              <a href="https://task.oranges.lt" target="_blank" rel="noreferrer"><button className="nav-btn">Task</button></a>
              <a href="https://move.oranges.lt" target="_blank" rel="noreferrer"><button className="nav-btn">Move</button></a>
              <a href="https://mate.oranges.lt" target="_blank" rel="noreferrer"><button className="nav-btn">Mate</button></a>
              <a href={`${SITE}/status.html`}><button className="nav-btn">Status</button></a>
            </NavDropdown>
            <NavDropdown label="Gaming">
              <a href={`${SITE}/minecraft.html`}><button className="nav-btn">Minecraft</button></a>
              <a href={`${SITE}/oranglauncher.html`}><button className="nav-btn">OrangLauncher</button></a>
              <a href={`${SITE}/mcwiki/index.html?page=main.md`}><button className="nav-btn">MC Wiki</button></a>
              <a href={`${SITE}/scpwiki/index.html?page=main.md`}><button className="nav-btn">SCP Wiki</button></a>
            </NavDropdown>
            <a href={DISCORD} target="_blank" rel="noreferrer"><button className="nav-btn discord-btn">Discord</button></a>
          </nav>
        </div>
      </header>

      <main>{children}</main>
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-main">
            <div className="footer-brand">
              <div className="footer-logo">
                <img src={logo} alt="Oranges Logo" />
                <span>Oranges.LT</span>
              </div>
              <p>We are developing software and services that simplify privacy and performance. Open source, non-profit, community-driven.</p>
            </div>
            <div className="footer-links">
              <div className="footer-column">
                <h5>Navigation</h5>
                <ul>
                  <li><a href={`${SITE}/roadmap.html`}>Roadmap</a></li>
                  <li><a href={`${SITE}/creators.html`}>Creators</a></li>
                  <li><a href={`${SITE}/software.html`}>Software</a></li>
                  <li><a href={`${SITE}/status.html`}>Status</a></li>
                </ul>
              </div>
              <div className="footer-column">
                <h5>Gaming</h5>
                <ul>
                  <li><a href={`${SITE}/minecraft.html`}>Minecraft</a></li>
                  <li><a href={`${SITE}/mcwiki/index.html?page=main.md`}>MC Wiki</a></li>
                  <li><a href={`${SITE}/scpwiki/index.html?page=main.md`}>SCP Wiki</a></li>
                </ul>
              </div>
              <div className="footer-column">
                <h5>Legal</h5>
                <ul>
                  <li><a href="/privacy">Privacy Policy</a></li>
                  <li><a href="/terms">Terms of Service</a></li>
                  <li><a href={`${SITE}/diversity.html`}>Diversity</a></li>
                </ul>
              </div>
              <div className="footer-column">
                <h5>Connect</h5>
                <ul>
                  <li><a href={DISCORD} target="_blank" rel="noreferrer">Discord</a></li>
                  <li><a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p className="footer-copyright">© {new Date().getFullYear()} oranges.lt. Open source and non-profit. Not associated with <a href="https://orange.com" target="_blank" rel="noreferrer">orange.com</a></p>
          </div>
        </div>
      </footer>
    </div>
  )
}