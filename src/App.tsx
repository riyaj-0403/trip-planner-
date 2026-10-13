import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import TripsPage from "./pages/TripsPage";
import TripsFormPage from "./pages/TripsFormPage";
import TripDetailPage from "./pages/TripDetailPage";

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<TripsPage />} />
          <Route path="/trips/new" element={<TripsFormPage />} />
          <Route path="/trips/:id" element={<TripDetailPage />} />
          <Route path="/trips/:id/edit" element={<TripsFormPage />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
