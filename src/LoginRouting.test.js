import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase';
import Login from './Login';
import Home from './Home';

// Use the real Router 7 implementation through its Jest-compatible CJS entry.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });
jest.mock('./firebase', () => ({ auth: { currentUser: null }, db: {} }));
jest.mock('@mui/icons-material', () => ({ Edit: () => null, Delete: () => null }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(), signInWithPopup: jest.fn(),
  signInWithEmailAndPassword: jest.fn(), GoogleAuthProvider: jest.fn(), signOut: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(), collection: jest.fn(), getDoc: jest.fn(() => new Promise(() => {})),
  setDoc: jest.fn(), onSnapshot: jest.fn(() => () => {}), deleteDoc: jest.fn(),
}));

const user = { uid: 'routing-test', displayName: 'Routing Teacher' };
const listeners = new Set();

beforeEach(() => {
  jest.clearAllMocks();
  listeners.clear();
  auth.currentUser = null;
  window.location.hash = '#/login';
  onAuthStateChanged.mockImplementation((_auth, callback) => {
    listeners.add(callback);
    callback(auth.currentUser);
    return () => listeners.delete(callback);
  });
});

function TestApp() {
  return <HashRouter><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/home" element={<Home />} />
  </Routes></HashRouter>;
}

test('Google success changes the actual hash and renders Home', async () => {
  // Restore implementations cleared by CRA between tests.
  const firestore = require('firebase/firestore');
  firestore.getDoc.mockImplementation(() => new Promise(() => {}));
  firestore.onSnapshot.mockReturnValue(() => {});
  signInWithPopup.mockImplementation(async () => {
    auth.currentUser = user;
    listeners.forEach((callback) => callback(user));
    return { user };
  });
  render(<TestApp />);
  fireEvent.click(screen.getByRole('button', { name: /Sign in with Google/ }));
  expect(await screen.findByText(/ยินดีต้อนรับ, Routing Teacher/)).toBeInTheDocument();
  await waitFor(() => expect(window.location.hash).toBe('#/home'));
  expect(screen.queryByRole('heading', { name: 'Login' })).not.toBeInTheDocument();
});

test('a restored Google session redirects when starting directly on /login', async () => {
  const firestore = require('firebase/firestore');
  firestore.getDoc.mockImplementation(() => new Promise(() => {}));
  firestore.onSnapshot.mockReturnValue(() => {});
  auth.currentUser = user;
  await act(async () => render(<TestApp />));
  expect(await screen.findByText(/ยินดีต้อนรับ, Routing Teacher/)).toBeInTheDocument();
  expect(window.location.hash).toBe('#/home');
});
