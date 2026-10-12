import { BrowserRouter, Routes, Route } from "react-router-dom";
import TripsPage from "./pages/TripsPage";
import TripsFormPage from "./pages/TripsFormPage";
import TripDetails from "./pages/TripDetails";
import TripDetailPage from "./pages/TripDetailPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TripsPage />} />
        <Route path="/trips/new" element={<TripsFormPage />} />
        <Route path="/trips/:id" element={<TripDetailPage />} />
        {/* Legacy detail route kept to avoid 404s on existing links */}
        <Route path="/trips/:tripId/details" element={<TripDetails />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;