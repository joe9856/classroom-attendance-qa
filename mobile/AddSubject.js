import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { db } from './firebase';
import { CameraView, useCameraPermissions } from 'expo-camera';

const AddSubject = ({ route,navigation }) => {
  // ตรวจสอบว่า `userData` มีค่าหรือไม่ก่อนการใช้งาน
  const { userData } = route.params || {};  // กำหนดค่าเริ่มต้นเป็น object ว่างหาก `route.params` เป็น undefined
  const [permission, requestPermission] = useCameraPermissions();
  const [cid, setCid] = useState('');
  const [stdid, setStdid] = useState('');
  const [name, setName] = useState(userData?.displayName ?? ''); // ใช้ค่าเริ่มต้นเป็นชื่อที่มาจาก userData ถ้ามี
  const [email, setEmail] = useState(userData?.email ?? '');
  const [photoURL, setPhotoURL] = useState(userData?.photoURL ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [scannedData, setScannedData] = useState('');
  const [isCameraVisible, setIsCameraVisible] = useState(true);



  useEffect(() => {
    async function getPermissions() {
      if (Platform.OS !== 'web') {
        const { status } = await requestPermission();
        setHasPermission(status === 'granted');
      } else {
        setHasPermission(true);  // บนเว็บไม่ต้องขอสิทธิ์กล้อง
      }
    }
    getPermissions();
  }, [requestPermission]);

  const handleBarcodeScanned = ({ data }) => {
    setScannedData(data);
    Alert.alert('QR Code scanned', `Classroom ID: ${data}`);
    setCid(data);
  };

  const resetScanner = () => {
    setScannedData('');
  };

 const handleAddSubject = async () => {
    if (!cid || !stdid) {
      Alert.alert('Error', 'Please enter Classroom ID (CID) and Student ID');
      return;
    }

    try {
      setIsLoading(true);

      // เขียนข้อมูลลงใน Firestore
      const classroomRef = db.collection('classroom').doc(cid).collection('students').doc(userData.uid);
      await classroomRef.set({
        stdid,
        name,
        email,
        photoURL,
        status: 0,
      });

      const userClassroomRef = db.collection('Users').doc(userData.uid).collection('classroom').doc(cid);
      await userClassroomRef.set({ status: 2 });

      const userRef = db.collection('Users').doc(userData.uid);
      await userRef.set(
        {
          name,
          email,
          photoURL,
        },
        { merge: true }
      );

      Alert.alert('Success', 'Subject added successfully');

      // นำทางไปยังหน้า Classroom
      navigation.navigate('Classroom', { cid: cid, userData });
    } catch (error) {
      Alert.alert('Error', 'Failed to add subject');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCamera = () => {
    setIsCameraVisible(!isCameraVisible);
  };

  const handleManualScan = () => {
    if (Platform.OS === 'web') {
      const qrCode = prompt("Enter QR Code value manually:");
      if (qrCode) {
        setScannedData(qrCode);
        setCid(qrCode);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, {name || 'User'}</Text>
      <TextInput style={styles.input} placeholder="Enter Classroom ID (CID)" value={cid} onChangeText={setCid} />
      <TextInput style={styles.input} placeholder="Enter Student ID" value={stdid} onChangeText={setStdid} />
      <TextInput style={styles.input} placeholder="Enter Name" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Enter Email" value={email} onChangeText={setEmail} />
      <TouchableOpacity style={styles.button} onPress={handleAddSubject}>
        <Text style={styles.buttonText}>Add Subject</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cameraToggleButton} onPress={toggleCamera}>
        <Text style={styles.buttonText}>{isCameraVisible ? 'Hide Camera' : 'Show QR Scanner'}</Text>
      </TouchableOpacity>

      {hasPermission === null && (
        <View style={styles.cameraStatusContainer}>
          <Text>Requesting camera permission...</Text>
        </View>
      )}
      {hasPermission === false && (
        <View style={styles.cameraStatusContainer}>
          <Text>No access to camera. Please enable camera permissions in your device settings.</Text>
        </View>
      )}
      {hasPermission === true && isCameraVisible && (
        <View style={styles.cameraContainer}>
          <CameraView
            onBarcodeScanned={scannedData ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'pdf417'],
            }}
            style={StyleSheet.absoluteFillObject}
          />
          {scannedData ? (
            <TouchableOpacity style={styles.resetButton} onPress={resetScanner}>
              <Text style={styles.buttonText}>Scan Again</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {scannedData && <View style={styles.scannedDataContainer}><Text>Scanned Classroom ID: {scannedData}</Text></View>}

      {isLoading && <ActivityIndicator size="large" color="#0000ff" />}

      {Platform.OS === 'web' && (
        <View style={styles.webMessageContainer}>
          <Text style={styles.webMessageText}>
            QR Code scanning is not available in web version.
            Please enter the Classroom ID manually or use the mobile app for scanning.
          </Text>
          <TouchableOpacity style={styles.webInputButton} onPress={handleManualScan}>
            <Text style={styles.buttonText}>Enter QR Code Manually</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: { width: '100%', padding: 10, borderWidth: 1, marginBottom: 10, borderRadius: 5 },
  button: { backgroundColor: '#007AFF', padding: 10, width: '100%', alignItems: 'center', borderRadius: 5, marginBottom: 10 },
  buttonText: { color: 'white', fontWeight: 'bold' },
  cameraToggleButton: { backgroundColor: '#34C759', padding: 10, width: '100%', alignItems: 'center', borderRadius: 5, marginBottom: 10 },
  cameraContainer: { width: '100%', height: 300, alignItems: 'center', marginTop: 20 },
  scannedDataContainer: { marginTop: 20, padding: 10, backgroundColor: '#E5F7FF', borderRadius: 5, width: '100%' },
  cameraStatusContainer: { marginTop: 20, padding: 10, backgroundColor: '#FFE5E5', borderRadius: 5, width: '100%' },
  resetButton: { backgroundColor: '#FF9500', padding: 10, width: '80%', alignItems: 'center', borderRadius: 5, position: 'absolute', bottom: 20 },
  webMessageContainer: { marginTop: 20, padding: 10, backgroundColor: '#FFF9C4', borderRadius: 5, width: '100%', alignItems: 'center' },
  webMessageText: { textAlign: 'center', lineHeight: 20, marginBottom: 10 },
  webInputButton: { backgroundColor: '#9C27B0', padding: 10, width: '90%', alignItems: 'center', borderRadius: 5 },
});

export default AddSubject;
