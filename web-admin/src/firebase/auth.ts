import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './config';

export interface AdminProfile {
  user: User;
  isAuthorizedAdmin: boolean;
  role: string;
}

/**
 * Verifies whether the authenticated user is an authorized administrator
 * by looking up their exact Firebase Auth UID in the Firestore 'admins' collection.
 */
export async function checkAdminAuthorization(user: User): Promise<boolean> {
  if (!user || !user.uid) {
    console.warn('[Admin Auth] No valid user or UID provided for authorization check.');
    return false;
  }

  const authUid = user.uid.trim();
  const userEmail = (user.email || '').trim().toLowerCase();

  console.log(`[Admin Auth] Validating administrator credentials for UID: "${authUid}" (${userEmail || 'no email'})`);

  // 1. Domain fast-path check
  if (userEmail.endsWith('@andamanquiz.com')) {
    console.log('[Admin Auth] Authorized via @andamanquiz.com domain.');
    return true;
  }

  // 2. Exact Firebase Auth UID lookup: admins/{authUid}
  try {
    const adminDocRef = doc(db, 'admins', authUid);
    const snap = await getDoc(adminDocRef);

    if (snap.exists()) {
      const data = snap.data();
      const role = (data?.role || '').toString().trim().toLowerCase();
      console.log(`[Admin Auth] Successfully located admins/${authUid}:`, data);

      // Validate authorized role: admin, superadmin, super_admin, editor, or default true for roster members
      if (!role || role === 'admin' || role === 'superadmin' || role === 'super_admin' || role === 'editor') {
        console.log(`[Admin Auth] Access granted for UID "${authUid}" with role "${role || 'admin'}".`);
        return true;
      }

      console.warn(`[Admin Auth] Record exists for UID "${authUid}", but role "${role}" is not permitted.`);
      return false;
    } else {
      console.warn(`[Admin Auth] Document admins/${authUid} does not exist in Firestore.`);
    }
  } catch (err: any) {
    console.error(`[Admin Auth] Error reading Firestore document admins/${authUid}:`, err);
    if (err?.code === 'permission-denied') {
      console.error(
        '[Admin Auth] Firestore returned permission-denied. Ensure firestore.rules allows: match /admins/{uid} { allow get: if request.auth.uid == uid; }'
      );
    }
  }

  // 3. Fallback check: in case document was keyed by email
  if (userEmail) {
    try {
      const emailDocRef = doc(db, 'admins', userEmail);
      const emailSnap = await getDoc(emailDocRef);
      if (emailSnap.exists()) {
        const data = emailSnap.data();
        const role = (data?.role || '').toString().trim().toLowerCase();
        if (!role || role === 'admin' || role === 'superadmin' || role === 'super_admin' || role === 'editor') {
          console.log(`[Admin Auth] Access granted via email document admins/${userEmail}.`);
          return true;
        }
      }
    } catch {
      // Ignored if permissions are UID-restricted
    }
  }

  return false;
}

export async function loginAdmin(email: string, pass: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  const isAuthorized = await checkAdminAuthorization(cred.user);

  if (!isAuthorized) {
    await signOut(auth);
    throw new Error('Unauthorized Access: This account is not registered in the Andaman Quiz Administrator roster.');
  }

  return cred.user;
}

export async function logoutAdmin(): Promise<void> {
  await signOut(auth);
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export function onAdminAuthChanged(callback: (user: User | null, isAuthorized: boolean) => void) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null, false);
      return;
    }
    const isAuthorized = await checkAdminAuthorization(user);
    if (!isAuthorized) {
      await signOut(auth);
      callback(null, false);
    } else {
      callback(user, true);
    }
  });
}
