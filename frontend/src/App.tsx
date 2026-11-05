import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { UploadPage } from './pages/UploadPage'
import { ResultPage } from './pages/ResultPage'
import { P2PReceivePage } from './pages/P2PReceivePage'
import { TermsPage } from './pages/TermsPage'
import { PrivacyPage } from './pages/PrivacyPage'
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/f/:token" element={<ResultPage />} />
        <Route path="/p/:room" element={<P2PReceivePage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
      </Routes>
    </BrowserRouter>
  )
}