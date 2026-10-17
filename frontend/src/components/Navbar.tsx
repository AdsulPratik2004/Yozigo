import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSearch } from "../context/SearchContext";
import Button from "./Button";

export default function Navbar() {
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const { searchQuery, setSearchQuery } = useSearch();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const navLinkStyle = ({ isActive }: { isActive: boolean }) =>
    `relative py-1 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
      isActive
        ? "text-accent font-semibold after:absolute after:-bottom-3 sm:after:-bottom-4 after:left-0 after:h-0.5 after:w-full after:bg-accent"
        : "text-muted hover:text-accent"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3.5">
        {/* Left: Brand Logo */}
        <Link to="/" className="flex items-center gap-2 select-none group flex-shrink-0">
          <img src="/src/assets/logo.png" alt="Yogizo Logo" className="h-8 sm:h-10 rounded-lg transition-transform duration-200 group-hover:scale-110" />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden sm:flex items-center gap-6">
          {isAdmin ? (
            <NavLink to="/admin" className={navLinkStyle}>
              Admin
            </NavLink>
          ) : (
            <>
              <NavLink to="/" end className={navLinkStyle}>
                Movies
              </NavLink>
              {isAuthenticated && (
                <NavLink to="/my-bookings" className={navLinkStyle}>
                  My bookings
                </NavLink>
              )}
            </>
          )}
        </nav>

        {/* Right: Search, Auth Actions & Mobile Menu Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Search Bar - desktop only */}
          {!isAdmin && (
            <div className="relative hidden sm:block">
              <input
                type="text"
                placeholder="Search movies…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9 pr-8 py-2 text-sm w-48 lg:w-64 bg-white border-line-light"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                🔍
              </span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted hover:text-accent transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Desktop Auth Actions */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-3">
            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-1.5 rounded-full border border-line-light bg-white px-3 py-1 text-xs font-medium text-gray-900">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                    {user?.name?.[0]?.toUpperCase() ?? "U"}
                  </span>
                  <span className="hidden md:inline text-muted max-w-[100px] truncate">{user?.name}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="text-xs px-4 py-1.5 text-muted hover:text-accent hover:border-accent border-line-light bg-white hover:bg-gray-50"
                >
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navLinkStyle}>
                  Login
                </NavLink>
                <Link to="/signup">
                  <Button variant="primary" size="sm" className="px-4 py-1.5 text-xs">
                    Sign up
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="sm:hidden p-2 text-gray-900 hover:bg-gray-100 rounded-lg"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="sm:hidden border-t border-line bg-white">
          <div className="px-4 py-4 space-y-4">
            {/* Mobile Navigation Links */}
            <nav className="flex flex-col space-y-3">
              {isAdmin ? (
                <NavLink
                  to="/admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-sm font-medium text-gray-900 hover:text-accent"
                >
                  Admin
                </NavLink>
              ) : (
                <>
                  <NavLink
                    to="/"
                    end
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-sm font-medium text-gray-900 hover:text-accent"
                  >
                    Movies
                  </NavLink>
                  {isAuthenticated && (
                    <NavLink
                      to="/my-bookings"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="text-sm font-medium text-gray-900 hover:text-accent"
                    >
                      My bookings
                    </NavLink>
                  )}
                </>
              )}
            </nav>

            {/* Mobile Search Bar */}
            {!isAdmin && (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search movies…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-9 pr-8 py-2 text-sm w-full bg-white border-line-light"
                />
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                  🔍
                </span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted hover:text-accent transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Mobile Auth Actions */}
            <div className="pt-2 border-t border-line">
              {isAuthenticated ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                      {user?.name?.[0]?.toUpperCase() ?? "U"}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{user?.name}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="text-xs px-3 py-1.5"
                  >
                    Sign out
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-sm font-medium text-center text-gray-900 hover:text-accent py-2"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Button variant="primary" size="sm" className="w-full py-2 text-xs">
                      Sign up
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
