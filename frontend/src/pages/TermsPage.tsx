import { Layout } from '../components/Layout'
const DISCORD = 'https://discord.gg/cpkfnRuRv7'
const UPDATED = '17 June 2026'

// OrangMove specific terms. The studio's generic oranges.lt terms don't cover user uploaded files
export function TermsPage() {
  return (
    <Layout>
      <div className="page legal">
        <section className="hero">
          <span className="eyebrow">Legal</span>
          <h1>Terms of <span className="grad">Service</span></h1>
        </section>

        <span className="updated">Last updated: {UPDATED}</span>

        <div className="tldr">
          <strong>Short version</strong>
          <p style={{ marginBottom: 0, marginTop: 8 }}>
            OrangMove is a free, ephemeral file-drop run as a non-profit hobby
            project. You're responsible for what you upload, you must own the
            rights to it, and it must be legal. Files self-destruct, so don't use
            this as backup. No warranties - use it at your own risk.
          </p>
        </div>

        <h2>1. What OrangMove is</h2>
        <p>
          OrangMove (the "Service") is a free, no-account file-sharing tool run by
          Orang Studios (oranges.lt) as a non-profit, open-source project. You drop
          a file, pick how long it lives (30 seconds to 1 hour), and get an
          unguessable link. When the timer runs out the file is permanently
          deleted. There is also a peer-to-peer mode where the file streams
          directly between two devices and never reaches our servers.
        </p>

        <h2>2. Eligibility</h2>
        <p>
          You must be at least 16 years old, or the minimum digital-consent age in
          your country, to use the Service. By using it you confirm you meet that
          requirement.
        </p>

        <h2>3. Your content is your responsibility</h2>
        <p>
          You are solely responsible for every file you upload or transfer. By
          using the Service you confirm that:
        </p>
        <ul>
          <li>You own the content or have all rights and permissions needed to share it.</li>
          <li>Sharing it does not break any law or anyone else's rights.</li>
          <li>You accept full responsibility for who you give the link to.</li>
        </ul>
        <p>
          The link <strong>is</strong> the secret. Anyone who has it can download
          the file until it expires. Only share it with people you intend to.
        </p>

        <h2>4. What you may not upload</h2>
        <p>You may not use OrangMove to store, share, or transfer:</p>
        <ul>
          <li>Anything illegal under Lithuanian or EU law, or the law where you live.</li>
          <li>Child sexual abuse material (CSAM) - this is reported and dealt with without exception.</li>
          <li>Content you don't have the rights to, including pirated or copyright-infringing material.</li>
          <li>Malware, viruses, ransomware, or anything designed to harm devices. (Executable files are also rejected automatically.)</li>
          <li>Content that harasses, threatens, defames, or doxes someone.</li>
          <li>Anything you'd be embarrassed to be associated with.</li>
        </ul>
        <p>
          Don't abuse the Service as bulk or permanent storage, and don't try to
          get around the size limit, time limits, rate limits, or the executable
          filter.
        </p>

        <h2>5. Moderation and takedowns</h2>
        <p>
          We don't actively monitor uploads - short lifetimes keep that practical.
          But we can remove any file, block any link, or restrict access at any
          time, for any reason, without notice. To report abuse or illegal content,
          reach us through our{' '}
          <a href={DISCORD} target="_blank" rel="noreferrer">Discord server</a>{' '}
          with the link and what's wrong, and we'll act as fast as we can. Because
          files expire on their own, the fastest fix is usually just waiting for
          the timer to run out.
        </p>

        <h2>6. No warranty</h2>
        <p>
          The Service is provided <strong>"as is"</strong> and <strong>"as
          available"</strong>, with no warranties of any kind. We don't promise it
          will be available, reliable, secure, or error-free. Files can be deleted
          early, transfers can fail, and the Service can go down or disappear at
          any time. <strong>Do not rely on OrangMove for anything important and
          always keep your own copy.</strong>
        </p>

        <h2>7. Limitation of liability</h2>
        <p>
          To the fullest extent allowed by law, Orang Studios and its operators are
          not liable for any loss or damage arising from your use of the Service -
          including lost, leaked, or deleted files, or anything anyone does with a
          file or link you shared. You use OrangMove entirely at your own risk.
        </p>

        <h2>8. Indemnity</h2>
        <p>
          You agree to cover any claims, damages, or costs we face because of
          content you uploaded or transferred, or because you broke these terms.
        </p>

        <h2>9. Changes</h2>
        <p>
          We may update these terms at any time. Continuing to use the Service
          after a change means you accept the new terms.
        </p>

        <h2>10. Governing law</h2>
        <p>
          These terms are governed by the laws of the Republic of Lithuania and the
          European Union.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions or reports go through our{' '}
          <a href={DISCORD} target="_blank" rel="noreferrer">Discord server</a>.
        </p>
      </div>
    </Layout>
  )
}