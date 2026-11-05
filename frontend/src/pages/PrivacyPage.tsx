import { Layout } from '../components/Layout'
const DISCORD = 'https://discord.gg/cpkfnRuRv7'
const UPDATED = '17 June 2026'
export function PrivacyPage() {
  return (
    <Layout>
      <div className="page legal">
        <section className="hero">
          <span className="eyebrow">Legal</span>
          <h1>Privacy <span className="grad">Policy</span></h1>
        </section>

        <span className="updated">Last updated: {UPDATED}</span>

        <div className="tldr">
          <strong>Short version</strong>
          <p style={{ marginBottom: 0, marginTop: 8 }}>
            No account, no email, no tracking. We hold your file only until its
            timer runs out, then delete it for good. We don't sell or share
            anything, and P2P transfers never touch our servers at all.
          </p>
        </div>

        <h2>1. No accounts</h2>
        <p>
          OrangMove has no sign-up, no login, and no profiles. We never ask for
          your name, email, or password, because we don't have anywhere to put
          them.
        </p>

        <h2>2. What we store, and for how long</h2>
        <p>For a <strong>normal upload</strong>, while the file is live we keep:</p>
        <ul>
          <li>The file itself, on our server.</li>
          <li>Its original filename, file type, and size.</li>
          <li>The random link token, and the times it was created and expires.</li>
        </ul>
        <p>
          That's it. When the timer you picked (30 seconds to 1 hour) runs out, a
          background job deletes the file and its metadata - usually within a few
          seconds. After that it's gone and not recoverable. We do not keep
          backups, archives, or copies.
        </p>

        <h2>3. Peer-to-peer transfers</h2>
        <p>
          In P2P mode the file streams <strong>directly from one device to the
          other</strong> and never lands on our servers. We only briefly help the
          two browsers find each other to set up the connection; we don't see,
          store, or scan the file. Once the transfer is done, nothing remains with
          us.
        </p>

        <h2>4. IP addresses and logs</h2>
        <p>
          To keep the Service running and stop abuse, our server temporarily uses
          your IP address for rate-limiting. We don't store IP addresses in our
          database alongside your files, and we don't build profiles or track you
          across visits. Standard short-lived operational data may pass through our
          server or hosting provider, but it isn't tied to your uploads or kept for
          analytics.
        </p>

        <h2>5. No tracking, no analytics, no ads</h2>
        <p>
          OrangMove uses no advertising, no analytics tools, and no third-party
          trackers. We don't set tracking cookies. Nothing about you is sold or
          shared with anyone.
        </p>

        <h2>6. Who can access your file</h2>
        <p>
          The link is the only key. Anyone who has it can download the file until
          it expires, and anyone without it cannot find it - tokens are
          256-bit random and unguessable. Share the link carefully.
        </p>

        <h2>7. Security</h2>
        <p>
          Files are served as downloads (never executed in your browser),
          executables are rejected, and links are cryptographically random. No
          system is perfectly secure, though, so don't share anything through
          OrangMove that would be harmful if it leaked.
        </p>

        <h2>8. Children</h2>
        <p>
          The Service isn't aimed at children under 16 and we don't knowingly
          collect their data.
        </p>

        <h2>9. Your rights</h2>
        <p>
          Under the GDPR you have rights over your personal data. Because we keep so
          little and it deletes itself quickly, there's usually nothing for us to
          act on - but if you have a question or a request, reach us through our{' '}
          <a href={DISCORD} target="_blank" rel="noreferrer">Discord server</a>.
          The fastest way to erase an uploaded file is to wait for its timer to run
          out.
        </p>

        <h2>10. Changes</h2>
        <p>
          We may update this policy from time to time. The date at the top shows
          when it last changed.
        </p>

        <h2>11. Contact</h2>
        <p>
          Privacy questions go through our{' '}
          <a href={DISCORD} target="_blank" rel="noreferrer">Discord server</a>.
        </p>
      </div>
    </Layout>
  )
}