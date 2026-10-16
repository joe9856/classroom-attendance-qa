import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { auth, db, firebase } from './firebase';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

// Set platform OAuth client IDs for a standalone/development build.
// Expo Go cannot provide the custom native OAuth redirect required by Google.
const googleClientIds = { androidClientId: '', iosClientId: '', webClientId: '' };
const googleClientId = Platform.select({
  android: googleClientIds.androidClientId,
  ios: googleClientIds.iosClientId,
  default: googleClientIds.webClientId,
});
const googleAvailable = Boolean(googleClientId) &&
  (Platform.OS === 'web' || Constants.appOwnership !== 'expo');

const userDetails = (user) => ({
  uid: user.uid,
  displayName: user.displayName,
  email: user.email,
  photoURL: user.photoURL,
});

function GoogleLoginButton({ onSuccess }) {
  const [request, , promptAsync] = Google.useIdTokenAuthRequest(googleClientIds);
  const handleGoogleAuth = async () => {
    try {
      const result = await promptAsync();
      if (result.type !== 'success') return;
      const idToken = result.params?.id_token;
      if (!idToken) throw new Error('Google did not return an ID token');
      const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
      const { user } = await auth.signInWithCredential(credential);
      onSuccess(userDetails(user));
    } catch (error) {
      Alert.alert('Google login', error.message || 'Failed to log in with Google');
    }
  };
  return (
    <TouchableOpacity style={styles.googleButton} onPress={handleGoogleAuth} disabled={!request}>
      <Text style={styles.buttonText}>Login with Google</Text>
    </TouchableOpacity>
  );
}


const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // ชื่อ
  const [photoURL, setPhotoURL] = useState(''); // URL รูปภาพ
  const [isRegistering, setIsRegistering] = useState(false); // สำหรับแยกระหว่าง Register และ Login
  const navigation = useNavigation(); // ใช้ในการนำทางไปยัง HomeScreen

  // ฟังก์ชันสำหรับการลงทะเบียนหรือล็อกอินด้วยอีเมล
  const handleEmailAuth = async () => {
    try {
      if (isRegistering) {
        // Register (สร้างบัญชีใหม่)
        const userCredential = await auth.createUserWithEmailAndPassword(email.trim(), password);
        const user = userCredential.user;
        await user.updateProfile({ displayName: name.trim(), photoURL: photoURL.trim() || null });

        // บันทึกข้อมูลของผู้ใช้ลงใน Firestore
        await db.collection('Users').doc(user.uid).set({
          name: name.trim(),
          displayName: name.trim(),
          email: user.email, // อีเมลของผู้ใช้
          photo: photoURL.trim(),
          photoURL: photoURL.trim(),
        });

        Alert.alert('Success', 'Registration successful');
      } else {
        // Login (เข้าสู่ระบบ)
        await auth.signInWithEmailAndPassword(email.trim(), password);
        Alert.alert('Success', 'Login successful');
      }
      navigation.navigate('Classroom', { // เปลี่ยนไปหน้า Classroom
        userData: userDetails(auth.currentUser),
      });
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>

      {/* ฟอร์มสำหรับกรอกอีเมลและรหัสผ่าน */}
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {/* เงื่อนไขแสดงช่องกรอกข้อมูล Name และ PhotoURL เมื่อเลือกการลงทะเบียน */}
      {isRegistering && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Photo URL (optional)"
            value={photoURL}
            onChangeText={setPhotoURL}
          />
        </>
      )}

      {/* ปุ่มสำหรับลงทะเบียนหรือเข้าสู่ระบบด้วยอีเมล */}
      <TouchableOpacity style={styles.button} onPress={handleEmailAuth}>
        <Text style={[styles.buttonText, { color: '#fff' }]}>
          {isRegistering ? 'Register' : 'Login'}
        </Text>
      </TouchableOpacity>

      {/* ปุ่มสำหรับสลับระหว่างการลงทะเบียนและการล็อกอิน */}
      <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)}>
        <Text style={styles.switchText}>
          {isRegistering ? 'Already have an account? Login' : 'Don’t have an account? Register'}
        </Text>
      </TouchableOpacity>

      {/* ปุ่มสำหรับล็อกอินผ่าน Google */}
      {googleAvailable ? (
        <GoogleLoginButton onSuccess={(userData) => navigation.navigate('Classroom', { userData })} />
      ) : (
        <Text style={styles.switchText}>
          Google login ยังไม่พร้อมในแอปนี้ กรุณาใช้อีเมลและรหัสผ่าน
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f0f8ff', // สีพื้นหลังที่นุ่มนวล
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: '#fff', // ให้พื้นหลังเป็นสีขาว
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  googleButton: {
    backgroundColor: '#ffffff',
    padding: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
    borderRadius: 10,
    borderColor: '#ddd',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  buttonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  switchText: {
    color: '#007AFF',
    marginTop: 10,
    textAlign: 'center',
    marginBottom: 15,
  },
});

export default LoginScreen;
