import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, collection, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import Login from './Login';
import Home from './Home';
import { ensureUserProfile } from './userProfile';

const mockNavigate = jest.fn();
// CRA's Jest 27 resolver cannot read React Router 7's package exports.
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('./firebase', () => ({ auth: {}, db: {} }));
// Icons do not affect authentication; avoid loading the entire icon catalog.
jest.mock('@mui/icons-material', () => ({ Edit: () => null, Delete: () => null }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
  signInWithPopup: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'profile-ref'),
  collection: jest.fn(() => 'classrooms-ref'),
  getDoc: jest.fn(), setDoc: jest.fn(),
  onSnapshot: jest.fn(), deleteDoc: jest.fn(),
}));

const user = { uid: 'test-user', displayName: 'Test Teacher', email: 'teacher@example.com' };
let authChanged;
let stopAuth;
let stopClassrooms;

beforeEach(() => {
  jest.clearAllMocks();
  stopAuth = jest.fn();
  stopClassrooms = jest.fn();
  doc.mockReturnValue('profile-ref');
  collection.mockReturnValue('classrooms-ref');
  onAuthStateChanged.mockImplementation((_auth, callback) => {
    authChanged = callback;
    return stopAuth;
  });
  // Simulate the profile request that previously kept users on Login forever.
  getDoc.mockImplementation(() => new Promise(() => {}));
  onSnapshot.mockReturnValue(stopClassrooms);
});

test('a restored session leaves Login without waiting for a profile read', () => {
  const view = render(<Login />);
  act(() => authChanged(user));
  expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true });
  expect(getDoc).not.toHaveBeenCalled();
  view.unmount();
  expect(stopAuth).toHaveBeenCalledTimes(1);
});

test.each(['Google', 'email'])('%s sign-in enters Home without a profile round trip', async (method) => {
  signInWithPopup.mockResolvedValue({ user });
  signInWithEmailAndPassword.mockResolvedValue({ user });
  render(<Login />);
  if (method === 'Google') {
    fireEvent.click(screen.getByRole('button', { name: /Sign in with Google/ }));
  } else {
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: user.email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
  }
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true }));
  expect(getDoc).not.toHaveBeenCalled();
});

test('sign-in errors are visible and allow another attempt', async () => {
  signInWithPopup.mockRejectedValue({ code: 'auth/popup-blocked' });
  render(<Login />);
  fireEvent.click(screen.getByRole('button', { name: /Sign in with Google/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('อนุญาตป๊อปอัป');
  expect(screen.getByRole('button', { name: /Sign in with Google/ })).toBeEnabled();
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('Home waits for auth, shows the page despite a pending profile, and renders classrooms', () => {
  const view = render(<Home />);
  expect(onSnapshot).not.toHaveBeenCalled();
  act(() => authChanged(user));
  expect(screen.getByText(/ยินดีต้อนรับ, Test Teacher/)).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('กำลังโหลดห้องเรียน');
  act(() => onSnapshot.mock.calls[0][1]({ docs: [
    { id: 'math', data: () => ({ info: { name: 'Mathematics', code: 'M101' } }) },
  ] }));
  expect(screen.getByText('Mathematics')).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  act(() => authChanged(null));
  expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  expect(stopClassrooms).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(stopAuth).toHaveBeenCalledTimes(1);
});

test('Firestore denial is shown instead of an empty classroom list, with a working retry', () => {
  render(<Home />);
  act(() => authChanged(user));
  act(() => onSnapshot.mock.calls[0][2]({ code: 'permission-denied' }));
  expect(screen.getByRole('alert')).toHaveTextContent('ไม่มีสิทธิ์อ่านห้องเรียน');
  expect(screen.queryByText('ไม่พบข้อมูลห้องเรียน')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }));
  expect(onSnapshot).toHaveBeenCalledTimes(2);
  expect(stopClassrooms).toHaveBeenCalledTimes(1);
});

test('a slow classroom connection is explained without hiding the signed-in page', () => {
  jest.useFakeTimers();
  const view = render(<Home />);
  act(() => authChanged(user));
  act(() => jest.advanceTimersByTime(15000));
  expect(screen.getByRole('alert')).toHaveTextContent('การเชื่อมต่อข้อมูลห้องเรียนใช้เวลานาน');
  expect(screen.getByText(/ยินดีต้อนรับ, Test Teacher/)).toBeInTheDocument();
  view.unmount();
  jest.useRealTimers();
});

test('profile access failure does not prevent classroom data from loading', async () => {
  getDoc.mockRejectedValue({ code: 'permission-denied' });
  render(<Home />);
  act(() => authChanged(user));
  act(() => onSnapshot.mock.calls[0][1]({ docs: [] }));
  expect(await screen.findByRole('alert')).toHaveTextContent('เข้าถึงโปรไฟล์ไม่ได้');
  expect(screen.getByText('ไม่พบข้อมูลห้องเรียน')).toBeInTheDocument();
});

test('existing profiles are preserved and new profiles use compatible fields', async () => {
  getDoc.mockResolvedValueOnce({ exists: () => true });
  await ensureUserProfile(user);
  expect(setDoc).not.toHaveBeenCalled();
  getDoc.mockResolvedValueOnce({ exists: () => false });
  await ensureUserProfile(user);
  expect(setDoc).toHaveBeenCalledWith('profile-ref', {
    displayName: user.displayName, email: user.email, photoURL: '',
  }, { merge: true });
});
