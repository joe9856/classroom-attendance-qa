import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function ensureUserProfile(user) {
  const userRef = doc(db, "Users", user.uid);
  const snapshot = await getDoc(userRef);
  // Preserve the existing profile, including fields used by the mobile app.
  if (!snapshot.exists()) {
    await setDoc(userRef, {
      displayName: user.displayName || "User",
      email: user.email || "",
      photoURL: user.photoURL || "",
    }, { merge: true });
  }
}
