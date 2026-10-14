import { useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, ShieldCheck } from "lucide-react";
import * as adminApi from "../api/admin";
import { errorMessage } from "../api/client";
import { useAdmin } from "../context/AdminContext";
import { SELLER_PORTAL_URL } from "../utils/constants";

function LoginPage() {
  const { signIn } = useAdmin();
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    try {
      const user = await adminApi.login(adminId, password);
      if (user.role !== "admin") {
        await adminApi.logout();
        setLoginError("This account does not have administrator access.");
        return;
      }
      setLoginError("");
      signIn();
    } catch (error) {
      setLoginError(errorMessage(error, "Could not sign in."));
    }
  };

  return (
    <main className="admin-login-shell">
      <section className="admin-login-art">
        <a className="admin-wordmark admin-wordmark-light" href={SELLER_PORTAL_URL}>
          <span>t.</span> threadline
        </a>
        <div className="admin-art-copy">
          <span>THREADLINE&nbsp; / &nbsp;OPERATIONS</span>
          <h1>
            Good taste.
            <br />
            Good <em>governance.</em>
          </h1>
          <p>
            The people and products behind every point of view, all in one
            place.
          </p>
        </div>
        <div className="admin-art-index">ADMIN CONSOLE&nbsp; · &nbsp;01</div>
      </section>
      <section className="admin-login-side">
        <a className="admin-back-link" href={SELLER_PORTAL_URL}>
          <ArrowLeft size={15} /> Seller studio
        </a>
        <div className="admin-login-card">
          <span className="admin-eyebrow">
            <ShieldCheck size={15} /> ADMINISTRATOR ACCESS
          </span>
          <h2>
            Welcome to
            <br />
            the back office.
          </h2>
          <p className="admin-login-description">
            Sign in to review seller applications and product submissions.
          </p>
          <form className="admin-login-form" onSubmit={submit}>
            <label className="admin-field">
              <span>Admin ID</span>
              <input
                autoComplete="username"
                placeholder="Enter Admin ID"
                value={adminId}
                onChange={(event) => setAdminId(event.target.value)}
                required
              />
            </label>
            <label className="admin-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Enter password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {loginError && (
              <p className="admin-login-error" role="alert">
                {loginError}
              </p>
            )}
            <button className="admin-primary-button" type="submit">
              Sign in to admin <ArrowRight size={16} />
            </button>
          </form>
          <div className="credential-note">
            <div>
              <span className="admin-eyebrow">ADMIN ACCOUNT</span>
              <strong>
                Credentials are configured securely by the server
                administrator.
              </strong>
            </div>
            <BadgeCheck size={17} />
          </div>
          <p className="admin-demo-warning">
            Admin credentials are never stored in this browser. Ask your
            system administrator if you need access.
          </p>
        </div>
        <footer className="admin-login-footer">
          <span>THREADLINE SELLER STUDIO</span>
          <a href="mailto:sellers@threadline.example">Need access help?</a>
        </footer>
      </section>
    </main>
  );
}

export default LoginPage;
