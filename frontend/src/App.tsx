import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import MovieDetail from "./pages/MovieDetail";
import ShowDetail from "./pages/ShowDetail";
import BookingConfirmation from "./pages/BookingConfirmation";
import MyBookings from "./pages/MyBookings";
import Admin from "./pages/Admin";
import AdminRoute from "./components/AdminRoute";
import { SearchProvider } from "./context/SearchContext";

function AppContent() {
  return (
    <div className="min-h-screen antialiased selection:bg-accent selection:text-white bg-bg-light text-gray-900">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/signup" element={<Auth />} />
          <Route path="/movies/:id" element={<MovieDetail />} />
          <Route path="/shows/:id" element={<ShowDetail />} />

          {/* Authenticated Customer Routes */}
          <Route path="/bookings/:id" element={<BookingConfirmation />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/profile" element={<MyBookings />} />

          {/* Admin Route Only */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <SearchProvider>
      <AppContent />
    </SearchProvider>
  );
}
