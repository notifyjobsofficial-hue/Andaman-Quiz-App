import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './config';

export interface AdminProfile {
  user: User;
  isAuthorizedAdmin: boolean;
  role: string;
}

export async function checkAdminAuthorization(user: User): Promise<boolean> {
  if (!user || !user.email) return false;

  // 1. Check if user is the primary admin domain
  if (user.email.endsWith('@andamanquiz.com')) {
    // Auto-ensure admin document exists
    try {
      const adminDocRef = doc(db, 'admins', user.uid);
      const snap = await getDoc(adminDocRef);
      if (!snap.exists()) {
        await setDoc(adminDocRef, {
          uid: user.uid,
          email: user.email,
          role: 'superadmin',
          createdAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('Could not auto-write admin doc:', e);
    }
    return true;
  }

  // 2. Check in Firestore 'admins' collection
  try {
    const adminDocRef = doc(db, 'admins', user.uid);
    const snap = await getDoc(adminDocRef);
    if (snap.exists()) {
      return true;
    }
  } catch (e) {
    console.error('Error verifying admin authorization in Firestore:', e);
  }

  return false;
}

export async function loginAdmin(email: string, pass: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
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
  await sendPasswordResetEmail(auth, email);
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
