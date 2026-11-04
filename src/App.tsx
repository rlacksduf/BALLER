import SmoothScroll from "./components/SmoothScroll";
import MotionEffects from "./components/MotionEffects";
import { t, useLanguage } from "./i18n";
import LanguageSelector from "./components/LanguageSelector";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import RouteEffects from "./components/RouteEffects";
import CompareSelection from "./components/CompareSelection";
import QuotaNotice from "./components/QuotaNotice";
import DatabaseHydration from "./components/DatabaseHydration";
import Header from "./components/Header";
import HomePage from "./pages/HomePage";
import PlayerDetailPage from "./pages/PlayerDetailPage";
import PlayersPage from "./pages/PlayersPage";
import ComparePage from "./pages/ComparePage";
import NotFoundPage from "./pages/NotFoundPage";
import "./App.css";
import "./design.css";
import "./motion.css";
import "./theme.css";

function App() {
  useLanguage();
  return (
    <BrowserRouter>
      <RouteEffects />
      <MotionEffects />
      <SmoothScroll />
      <DatabaseHydration />
      <div className="app">
        <a className="skip-link" href="#main-content">
          {t("본문으로 건너뛰기")}
        </a>
        <Header brand="BALLER." />
        <QuotaNotice />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/players/:id" element={<PlayerDetailPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <footer className="site-footer">
          <Link to="/" className="footer-brand">
            BALLER.
          </Link>
          <p>THE BEAUTIFUL GAME, DECODED.</p>
          <span>{t("데이터: Highlightly · 저장 기록 기준")}</span>
          <Link to="/players">{t("선수 탐색 ↗")}</Link>
          <LanguageSelector />
        </footer>
        <CompareSelection />
      </div>
    </BrowserRouter>
  );
}

export default App;
