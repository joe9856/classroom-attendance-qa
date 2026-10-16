import { useState, useEffect } from "react";
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { useNavigate } from "react-router-dom";

function loginError(error) {
  const messages = {
    "auth/popup-blocked": "เบราว์เซอร์บล็อกหน้าต่าง Google กรุณาอนุญาตป๊อปอัปแล้วลองอีกครั้ง",
    "auth/popup-closed-by-user": "หน้าต่างเข้าสู่ระบบถูกปิด กรุณาลองอีกครั้ง",
    "auth/unauthorized-domain": "โดเมนเว็บนี้ยังไม่ได้รับอนุญาตให้เข้าสู่ระบบใน Firebase",
    "auth/network-request-failed": "เชื่อมต่อระบบเข้าสู่ระบบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง",
    "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "auth/too-many-requests": "มีการเข้าสู่ระบบหลายครั้ง กรุณารอสักครู่แล้วลองใหม่",
  };
  return messages[error.code] || `เข้าสู่ระบบไม่สำเร็จ (${error.code || "unknown-error"})`;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => onAuthStateChanged(auth, (user) => {
    // An existing session must also leave /login; profile reads belong on Home.
    if (user) navigate("/home", { replace: true });
  }, (error) => setError(loginError(error))), [navigate]);

  const signIn = async (authenticate) => {
    setError("");
    setBusy(true);
    try {
      await authenticate();
      navigate("/home", { replace: true });
    } catch (error) {
      setError(loginError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container d-flex justify-content-center align-items-center min-vh-100">
      <div className="card p-5 shadow-lg" style={{ maxWidth: "600px", width: "100%" }}>
        <h3 className="text-center mb-3">Login</h3>
        {error && <div role="alert" className="alert alert-danger">{error}</div>}
        <form onSubmit={(event) => {
          event.preventDefault();
          signIn(() => signInWithEmailAndPassword(auth, email, password));
        }}>
          <div className="form-group mb-3">
            <input type="email" aria-label="Email" autoComplete="email" required
              className="form-control" placeholder="Enter your email" value={email}
              onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="form-group mb-3">
            <input type="password" aria-label="Password" autoComplete="current-password" required
              className="form-control" placeholder="Enter your password" value={password}
              onChange={(event) => setPassword(event.target.value)} />
          </div>
          <button type="button" disabled={busy}
            onClick={() => signIn(() => signInWithPopup(auth, new GoogleAuthProvider()))}
            className="btn btn-danger w-100 mb-3">
            <i className="bi bi-google" /> Sign in with Google
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary w-100 mb-3">
            {busy ? "กำลังเข้าสู่ระบบ..." : "Login"}
          </button>
          <button type="button" disabled={busy} onClick={() => navigate("/register")}
            className="btn btn-outline-primary w-100">Register</button>
        </form>
      </div>
    </div>
  );
}

export default Login;
