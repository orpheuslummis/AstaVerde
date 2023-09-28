import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/Home";
import DetailsPage from "./pages/Details";
import AdminPage from "./pages/Admin";
import NavigationBar from "./components/NavigationBar";
import CookieModal from "./components/CookieModal";
import ConsentModal from "./components/ConsentModal";
import { useEffect, useState } from "react";
import RedeemPage from "./pages/RedeemPage";
import TermsPage from "./pages/TermsPage";
import Header from "./components/Header";
import Footer from "./components/Footer";

const App: React.FC = () => {
  const [showCookieModal, setShowCookieModal] = useState<boolean>(true); // Initialize to true to show on first visit
  const [showConsentModal, setShowConsentModal] = useState<boolean>(true); // Initialize to true to show on first visit

  useEffect(() => {
    const cookieConsent = localStorage.getItem("cookieConsent");
    const userConsent = localStorage.getItem("userConsent");

    if (cookieConsent === "true") {
      setShowCookieModal(false);
    }
    if (userConsent === "true") {
      setShowConsentModal(false);
    }
  }, []);

  return (
    <Router>
      <div style={{ margin: "auto", width: "60rem" }}>
        <Header />
        <NavigationBar />
        <div>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/details" element={<DetailsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/redeem" element={<RedeemPage />} />
            <Route path="/terms" element={<TermsPage />} />
          </Routes>
          {showCookieModal && (
            <CookieModal
              onClose={() => {
                setShowCookieModal(false);
                localStorage.setItem("cookieConsent", "true");
              }}
            />
          )}
          {showConsentModal && (
            <ConsentModal
              onClose={() => {
                setShowConsentModal(false);
                localStorage.setItem("userConsent", "true");
              }}
            />
          )}
        </div>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
