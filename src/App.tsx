import { Routes, Route } from "react-router-dom";
import { LandingPage } from "@/components/landing/LandingPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      {/* Future routes will be added here */}
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}

export default App;
