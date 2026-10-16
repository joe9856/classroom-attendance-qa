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
    "auth/web-storage-unsupported": "เบราว์เซอร์บันทึกสถานะเข้าสู่ระบบไม่ได้ กรุณาลองในหน้าต่าง Chrome ปกติ",
  };
  return `${messages[error.code] || "เข้าสู่ระบบไม่สำเร็จ"} (${error.code || "unknown-error"})`;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  useEffect(() => onAuthStateChanged(auth, (user) => {
    // An existing session must also leave /login; profile reads belong on Home.
    if (user) {
      setSignedIn(true);
      navigate("/home", { replace: true });
    }
  }, (error) => setError(loginError(error))), [navigate]);

  useEffect(() => {
    if (!busy) {
      setWaiting(false);
      return;
    }
    // Account selection may legitimately take time. Do not cancel a live popup
    // or start competing sign-in requests; explain the wait instead.
    const timer = setTimeout(() => setWaiting(true), 30000);
    return () => clearTimeout(timer);
  }, [busy]);

  const checkSession = () => {
    if (auth.currentUser) {
      setSignedIn(true);
      setStatus("เว็บได้รับการยืนยันแล้ว กำลังเปิดหน้าห้องเรียน หากหน้ายังไม่เปลี่ยน ให้กดเปิดหน้าห้องเรียนด้านล่าง");
      navigate("/home", { replace: true });
    } else {
      setSignedIn(false);
      setStatus(busy
        ? "เว็บยังไม่ได้รับผลการเข้าสู่ระบบ กรุณาทำขั้นตอนในหน้าต่าง Google ให้เสร็จ หากปิดหน้าต่างแล้วแต่ยังรออยู่ ให้แจ้งข้อความนี้"
        : "เว็บนี้ยังไม่ได้รับการยืนยันการเข้าสู่ระบบ แม้บัญชี Google จะเข้าสู่ระบบในเบราว์เซอร์แล้ว กรุณากด Sign in with Google บนเว็บนี้อีกครั้ง");
    }
  };

  const signIn = async (authenticate) => {
    setError("");
    setStatus("");
    setBusy(true);
    try {
      const result = await authenticate();
      if (!result?.user) throw Object.assign(new Error("Missing authenticated user"), { code: "auth/missing-user" });
      setSignedIn(true);
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
        {waiting && <div role="status" className="alert alert-warning">
          ยังรอผลจากการเข้าสู่ระบบอยู่ หากเลือกบัญชีแล้วและหน้าต่าง Google ปิด ให้กดตรวจสอบสถานะล็อกอินด้านล่าง
        </div>}
        {status && <div role="status" className="alert alert-info">{status}</div>}
        {signedIn && <a href="#/home" className="btn btn-success w-100 mb-3">เปิดหน้าห้องเรียน</a>}
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
        <button type="button" onClick={checkSession} className="btn btn-link mt-3">
          ตรวจสอบสถานะล็อกอิน
        </button>
        <small className="text-muted text-center mt-2">ระบบเข้าสู่ระบบ รุ่น 2</small>
      </div>
    </div>
  );
}

export default Login;
