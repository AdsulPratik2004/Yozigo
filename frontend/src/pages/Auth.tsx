import { useState, type FormEvent } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { loginUser, registerUser, resendConfirmation } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";

type Tab = "login" | "register";

export default function Auth() {
  const location = useLocation();
  const initialTab: Tab = location.pathname.includes("signup") ? "register" : "login";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    },
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setResendMessage("");
    setEmailNotVerified(false);
    setLoading(true);

    try {
      if (tab === "login") {
        const res = await loginUser(form.email, form.password);
        if (res.access_token && res.user) {
          login(res.access_token, res.refresh_token || "", res.user);
          // Redirect based on user role
          if (res.user.role === "admin") {
            navigate("/admin");
          } else {
            navigate("/");
          }
        }
      } else {
        await registerUser(form.email, form.password, form.name);
        // Always show email confirmation screen after signup
        setEmailSent(true);
      }
    } catch (err: unknown) {
      const error = err as Error;
      
      // Check if error is about email not confirmed
      if (error.message.toLowerCase().includes("email not confirmed")) {
        setEmailNotVerified(true);
        setError("");
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!form.email) return;
    setResending(true);
    setResendMessage("");
    try {
      const res = await resendConfirmation(form.email);
      setResendMessage(res.message || "Confirmation email resent!");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen py-8 px-4 bg-gradient-to-br from-gray-50 via-gray-50 to-white">
      <div className="w-full max-w-md">
        {/* Premium Card */}
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card-hover">
          {/* Premium accent bar */}
          <div className="h-2 w-full bg-gradient-to-r from-accent via-accent-light to-accent" />

          <div className="p-6 sm:p-8">
            {emailNotVerified ? (
              /* Email Not Verified Screen */
              <div className="text-center py-4">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/20 text-3xl text-warning border border-warning/30 shadow-glow">
                  ⚠️
                </div>
                <h2 className="text-2xl font-black text-gray-900">Email Not Verified</h2>
                <p className="mt-2 text-sm text-muted">
                  Your email address has not been verified yet.
                </p>
                <p className="mt-1 font-bold text-accent break-all">{form.email}</p>
                <div className="my-5 rounded-xl border border-line bg-gray-50 p-4 text-xs text-muted leading-relaxed text-left">
                  <p className="font-semibold text-gray-900 mb-2">To continue:</p>
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>Check your email inbox for the confirmation link</li>
                    <li>Click the link to verify your email address</li>
                    <li>Return here and sign in</li>
                  </ol>
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setEmailNotVerified(false);
                      setTab("login");
                      setError("");
                    }}
                    className="w-full"
                  >
                    Back to Sign in
                  </Button>

                  <button
                    type="button"
                    disabled={resending}
                    onClick={handleResend}
                    className="text-xs font-semibold text-muted hover:text-accent transition-colors disabled:opacity-50"
                  >
                    {resending ? "Sending..." : "Didn't receive the email? Resend verification link"}
                  </button>

                  {resendMessage && (
                    <p className="rounded-xl border border-success/30 bg-success/10 p-3 text-xs text-success font-medium">
                      {resendMessage}
                    </p>
                  )}
                </div>
              </div>
            ) : emailSent ? (
              /* Confirmation Required Screen */
              <div className="text-center py-4">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/20 text-3xl text-accent border border-accent/30 shadow-glow">
                  ✉️
                </div>
                <h2 className="text-2xl font-black text-gray-900">Check your email</h2>
                <p className="mt-2 text-sm text-muted">
                  We sent a confirmation link to:
                </p>
                <p className="mt-1 font-bold text-accent break-all">{form.email}</p>
                <div className="my-5 rounded-xl border border-line bg-gray-50 p-4 text-xs text-muted leading-relaxed text-left">
                  <p className="font-semibold text-gray-900 mb-2">Next steps:</p>
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>Open your email inbox</li>
                    <li>Click the verification link in the email</li>
                    <li>Return here and sign in</li>
                  </ol>
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setEmailSent(false);
                      setTab("login");
                      setError("");
                    }}
                    className="w-full"
                  >
                    Go to Sign in
                  </Button>

                  <button
                    type="button"
                    disabled={resending}
                    onClick={handleResend}
                    className="text-xs font-semibold text-muted hover:text-accent transition-colors disabled:opacity-50"
                  >
                    {resending ? "Sending..." : "Didn't receive the email? Resend"}
                  </button>

                  {resendMessage && (
                    <p className="rounded-xl border border-success/30 bg-success/10 p-3 text-xs text-success font-medium">
                      {resendMessage}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* Regular Login / Signup Form */
              <>
                <div className="mb-8 text-center">
                  <img src="/src/assets/favicon.png" alt="Yogizo Logo" className="mx-auto mb-3 h-16 w-16 rounded-lg" />
                  <h2 className="text-3xl font-black text-gray-900">
                    {tab === "login" ? "Welcome back" : "Create account"}
                  </h2>
                  <p className="mt-3 text-sm text-muted">
                    {tab === "login"
                      ? "Sign in to book your favorite movies"
                      : "Join Yogizo Cinema and start booking"}
                  </p>
                </div>

                {/* Premium Tab Switcher */}
                <div className="mb-6 flex rounded-xl border border-line p-1 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => {
                      setTab("login");
                      setError("");
                    }}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all ${
                      tab === "login"
                        ? "bg-accent text-white shadow-glow"
                        : "text-muted hover:text-accent"
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTab("register");
                      setError("");
                    }}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all ${
                      tab === "register"
                        ? "bg-accent text-white shadow-glow"
                        : "text-muted hover:text-accent"
                    }`}
                  >
                    Sign up
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {tab === "register" && (
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted">
                        Full Name
                      </span>
                      <input
                        id="input-name"
                        type="text"
                        required
                        minLength={1}
                        placeholder="Your name"
                        autoComplete="name"
                        className="input"
                        {...field("name")}
                      />
                    </label>
                  )}

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">
                      Email Address
                    </span>
                    <input
                      id="input-email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="input"
                      {...field("email")}
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">
                      Password
                    </span>
                    <div className="relative">
                      <input
                        id="input-password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        placeholder="min. 8 characters"
                        autoComplete={
                          tab === "login" ? "current-password" : "new-password"
                        }
                        className="input pr-12"
                        {...field("password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-accent transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </label>

                  {error && (
                    <p
                      id="auth-error"
                      role="alert"
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-400"
                    >
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? "Processing..." : tab === "login" ? "Sign in" : "Create account"}
                  </Button>
                </form>

                <div className="mt-6 text-center text-xs text-muted">
                  {tab === "login" ? (
                    <>
                      Don't have an account?{" "}
                      <Link
                        to="/signup"
                        onClick={() => {
                          setTab("register");
                          setError("");
                        }}
                        className="font-bold text-accent hover:text-accent-light transition-colors"
                      >
                        Sign up
                      </Link>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <Link
                        to="/login"
                        onClick={() => {
                          setTab("login");
                          setError("");
                        }}
                        className="font-bold text-accent hover:text-accent-light transition-colors"
                      >
                        Sign in
                      </Link>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          <Link to="/" className="hover:text-gray-900 transition-colors">
            ← Back to movies
          </Link>
        </p>
      </div>
    </div>
  );
}
