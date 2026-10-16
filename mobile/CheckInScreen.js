import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { db } from './firebase';
import { CameraView, useCameraPermissions } from 'expo-camera';

const CheckInScreen = ({ route, navigation }) => {
  const { cid: initialCid, userData } = route.params || {};

  const [cid, setCid] = useState(initialCid);
  const [stdid, setStdid] = useState('');
  const [cno, setCno] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [scannedData, setScannedData] = useState('');
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isLoadingStudentData, setIsLoadingStudentData] = useState(false); // เพิ่มสถานะสำหรับการโหลดข้อมูลนักเรียน

  const [permission, requestPermission] = useCameraPermissions();

  // เพิ่มฟังก์ชันดึงข้อมูลนักเรียน
  const fetchStudentData = async () => {
    if (!initialCid || !userData?.uid) {
      return;
    }

    try {
      setIsLoadingStudentData(true);

      // ดึงข้อมูลจากเอกสารของนักเรียนโดยตรง
      const studentRef = db.collection('classroom').doc(initialCid)
                          .collection('students').doc(userData.uid);

      const studentDoc = await studentRef.get();

      if (studentDoc.exists) {
        const studentData = studentDoc.data();

        if (studentData?.stdid) {

          setStdid(studentData.stdid);
        } else {
          console.log('Student ID not found');
        }

        if (studentData?.name) {

          setName(studentData.name);
        } else {
          console.log('Student name not found');
        }
      } else {
        console.log('No student document found');
      }

    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setIsLoadingStudentData(false);
    }
  };




  useEffect(() => {
    if (!userData?.uid) return;

    async function getPermissions() {
      if (Platform.OS !== 'web') {
        const { status } = await requestPermission();
        setHasPermission(status === 'granted');
      } else {
        setHasPermission(true);
      }
    }
    getPermissions();

    // เรียกฟังก์ชันดึงข้อมูลนักเรียนเมื่อโหลดหน้า
    fetchStudentData();
  }, [requestPermission, initialCid, userData]);

  const handleBarcodeScanned = ({ data }) => {
    setScannedData(data);
    Alert.alert('QR Code scanned', `Classroom ID: ${data}`);
    setCode(data); // ให้ค่าที่สแกนได้เด้งไปใส่ในช่องกรอกรหัสอัตโนมัติ
  };

  const formatThaiDate = (date) => {
    const buddhistYear = date.getFullYear() + 543; // แปลง ค.ศ. เป็น พ.ศ.
    const formattedDate = new Intl.DateTimeFormat("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);

    return formattedDate.replace(/\d{4}/, buddhistYear); // แทนที่ ค.ศ. ด้วย พ.ศ.
  };

  const resetScanner = () => {
    setScannedData('');
  };

  const fetchClassData = async (cid, cno) => {
    try {


      const classRef = db.collection('classroom').doc(cid).collection('checkin').doc(cno);
      const classDoc = await classRef.get();

      // Debug: ตรวจสอบผลลัพธ์จาก Firestore
      if (classDoc.exists) {
        console.log('Class data found:', classDoc.data());
      } else {
        console.log('No class data found for CID:', cid, 'CNO:', cno);
      }

      if (!classDoc.exists) {
        Alert.alert('Error', 'ไม่พบหมายเลขชั้นเรียน (CNO)');
        return null;
      }

      const classData = classDoc.data();
      return classData;

    } catch (error) {
      // Debug: แสดงข้อผิดพลาดหากเกิดขึ้น
      console.error('Error fetching class data:', error);
      Alert.alert('Error', 'ดึงข้อมูลชั้นเรียนล้มเหลว');
      return null;
    }
  };

  const handleCheckIn = async () => {
    if (!cid || !stdid || !cno || !code || !name) {
      Alert.alert('Error', 'กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      setIsLoading(true);

      const classData = await fetchClassData(cid, cno);
      if (!classData) return;

      const fetchedCode = classData.code;

      if (fetchedCode !== code) {
        Alert.alert('Error', 'หมายเลขชั้นเรียน (CNO) หรือรหัสไม่ถูกต้อง');
        setIsLoading(false);
        return;
      }

      const checkInRef = db
        .collection('classroom')
        .doc(cid)
        .collection('checkin')
        .doc(cno)
        .collection('students')
        .doc(userData.uid);
        const thaiDate = formatThaiDate(new Date()); // แปลงเวลาเป็น พ.ศ.

      await checkInRef.set({
        stdid,
        name,
        date: thaiDate, // บันทึกเป็น 28/02/2568 20:19:41
      });

      Alert.alert('Success', 'เช็คอินสำเร็จ');
      if (!cid || !cno || !stdid.trim()) {
        Alert.alert('Error', 'กรุณากรอกรหัส, หมายเลขชั้นเรียน และรหัสนักศึกษา');
        return;
      }

      navigation.navigate('AnswerQuestion', {
        cid,
        cno,
        uid: userData.uid,
        userData,
        stdName: name // เพิ่มการส่งชื่อนักศึกษา
      });

    } catch (error) {
      Alert.alert('Error', 'เช็คอินล้มเหลว');
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

  if (!userData?.uid) {
    return (
      <View style={styles.container}>
        <Text>กรุณาเข้าสู่ระบบก่อนเช็คอิน</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.buttonText}>เข้าสู่ระบบ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>การเช็คอินเข้าชั้นเรียน</Text>

      {isLoadingStudentData && (
        <ActivityIndicator size="small" color="#3498db" style={styles.loadingIndicator} />
      )}

      <TextInput
        style={styles.input}
        placeholder="กรอกรหัส"
        value={code}
        onChangeText={setCode}
      />
      <TextInput
        style={styles.input}
        placeholder="กรอกหมายเลขชั้นเรียน (CNO)"
        value={cno}
        onChangeText={setCno}
      />
     <TextInput
      style={styles.input}
      value={stdid}
      placeholder="รหัสนักเรียน"
      editable={false} // ถ้าไม่ต้องการให้ผู้ใช้แก้ไข
    />

    <TextInput
      style={styles.input}
      value={name}
      placeholder="ชื่อนักเรียน"
      editable={false}
    />


     <TouchableOpacity
      style={styles.button}
      onPress={handleCheckIn}>
      <Text style={styles.buttonText}>เช็คอิน</Text>
    </TouchableOpacity>

      <TouchableOpacity style={styles.cameraToggleButton} onPress={toggleCamera}>
        <Text style={styles.buttonText}>{isCameraVisible ? 'ซ่อนกล้อง' : 'แสดงเครื่องสแกน QR'}</Text>
      </TouchableOpacity>

      {hasPermission === null && <Text>กำลังขออนุญาตใช้งานกล้อง...</Text>}
      {hasPermission === false && <Text>ไม่สามารถเข้าถึงกล้องได้</Text>}

      {hasPermission === true && isCameraVisible && (
        <View style={styles.cameraContainer}>
          <CameraView
            onBarcodeScanned={scannedData ? undefined : handleBarcodeScanned}
            style={StyleSheet.absoluteFillObject}
          />
          {scannedData ? (
            <TouchableOpacity style={styles.resetButton} onPress={resetScanner}>
              <Text style={styles.buttonText}>สแกนใหม่อีกครั้ง</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {scannedData && <Text style={styles.scannedText}>รหัสห้องเรียนที่สแกน: {scannedData}</Text>}

      {isLoading && <ActivityIndicator size="large" color="#00bfff" />}
    </View>
  );
};

// เพิ่มรูปแบบสำหรับไอคอนโหลด
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2c3e50',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  button: {
    backgroundColor: '#3498db',
    padding: 12,
    width: '100%',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cameraContainer: {
    width: '100%',
    height: 300,
    marginTop: 30,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
  },
  resetButton: {
    backgroundColor: '#ff6347',
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
    position: 'absolute',
    bottom: 10,
    width: '100%',
  },
  cameraToggleButton: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#1abc9c',
    borderRadius: 8,
  },
  scannedText: {
    fontSize: 16,
    color: '#34495e',
    marginTop: 10,
  },
  loadingIndicator: {
    marginVertical: 10
  }
});

export default CheckInScreen;
