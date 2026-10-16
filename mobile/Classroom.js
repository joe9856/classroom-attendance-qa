import React, { useState, useEffect, useCallback } from 'react';
import { Image, View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator } from 'react-native';
import { db } from './firebase';
import { Ionicons as Icon } from '@expo/vector-icons';

const ClassroomScreen = ({ route, navigation }) => {
  const { cid, userData } = route.params || { userData: { uid: null } };
  const [classrooms, setClassrooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCheckins, setActiveCheckins] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);


  // ฟังก์ชันดึงข้อมูลห้องเรียน
 const fetchClassrooms = useCallback(() => {
  setIsLoading(true);
  try {
    const unsubscribe = db.collection('Users')
      .doc(userData.uid)
      .collection('classroom')
      .onSnapshot(async (snapshot) => {
        try {
          const classroomsData = await Promise.all(snapshot.docs.map(async (doc) => {
            const cid = doc.id;
            const userClassStatus = doc.data().status || 0; // ดึง status จากข้อมูลผู้ใช้

            try {
              const classroomDoc = await db.collection('classroom').doc(cid).get();
              if (!classroomDoc.exists) {
                return null;
              }
              const classroomData = classroomDoc.data();

              // ตรวจสอบสถานะในข้อมูลนักเรียนโดยตรง - เพิ่มขั้นตอนนี้
              const studentDoc = await db.collection(`classroom/${cid}/students`)
                .doc(userData.uid)
                .get();

              // ใช้ status จาก students collection ถ้ามี หรือใช้จาก user's classroom collection
              const finalStatus = studentDoc.exists ? studentDoc.data().status || 0 : userClassStatus;

              return {
                cid,
                owner: classroomData.owner || 'N/A',
                code: classroomData.info?.code || 'N/A',
                courseName: classroomData.info?.name || 'N/A',
                room: classroomData.info?.room || 'N/A',
                photo: classroomData.info?.photo || 'N/A',
                status: finalStatus, // ใช้ status ที่ตรวจสอบจากทั้งสองที่
              };
            } catch (err) {
              console.error("Error fetching classroom data:", err);
              return null;
            }
          }));

          const filteredClassrooms = classroomsData.filter(c => c !== null);
          setClassrooms(filteredClassrooms);

          // เรียกฟังก์ชันตรวจสอบคำถามหลังจากได้ข้อมูลห้องเรียน
          if (filteredClassrooms.length > 0) {
            await checkActiveQuestionsForClasses(filteredClassrooms);
          }

          setIsLoading(false);
        } catch (error) {
          console.error("Error processing classroom data:", error);
          setIsLoading(false);
          Alert.alert('Error', 'Failed to process classroom data');
        }
      }, (error) => {
        console.error("Snapshot error:", error);
        setIsLoading(false);
        Alert.alert('Error', 'Failed to load classrooms');
      });

    return unsubscribe;
  } catch (error) {
    console.error("Fatal error in fetchClassrooms:", error);
    setIsLoading(false);
    Alert.alert('Error', 'Failed to start classroom listener');
    return () => {};
  }
}, [userData?.uid]);

// แก้ไข useEffect หลัก - แยกออกจากส่วนที่ติดตามการเปลี่ยนแปลงสถานะนักเรียน
useEffect(() => {
  if (!userData?.uid) {
    console.log("ไม่มีข้อมูล uid, ไม่โหลดข้อมูล");
    return;
  }

  const unsubscribe = fetchClassrooms();

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}, [userData?.uid, fetchClassrooms, refreshKey]);

// แยก useEffect สำหรับติดตามสถานะนักเรียน
useEffect(() => {
  if (!userData?.uid || classrooms.length === 0) {
    return;
  }

  const unsubscribeList = classrooms.map(classroom => {
    return db.collection(`classroom/${classroom.cid}/students`)
      .doc(userData.uid)
      .onSnapshot((doc) => {
        if (doc.exists) {
          setClassrooms(prevClassrooms =>
            prevClassrooms.map(c =>
              c.cid === classroom.cid
                ? { ...c, status: doc.data().status || 0 }
                : c
            )
          );
        }
      }, (error) => {
        console.error(`Error listening for status in ${classroom.cid}:`, error);
      });
  });

  return () => {

    unsubscribeList.forEach(unsub => {
      if (unsub) unsub();
    });
  };
}, [userData?.uid, classrooms.length]);



  const checkActiveQuestionsForClasses = async (classrooms) => {
  try {
    const activeCheckinsData = {};
    await Promise.all(classrooms.map(async (classroom) => {
      if (classroom.status !== 1) return;

      // ดึงข้อมูลการเช็คอินล่าสุด
      const checkinSnapshot = await db.collection(`classroom/${classroom.cid}/checkin`)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();




      if (!checkinSnapshot.empty) {
        const checkinDoc = checkinSnapshot.docs[0];
        const checkinData = checkinDoc.data();

        // เช็คว่าห้องเรียนยังเปิดอยู่หรือไม่ (status = 1)
        if (checkinData.status === 1) {
          // เช็คว่านักเรียนเช็คอินในคาบนี้แล้วหรือไม่
          const studentCheckinSnapshot = await db
            .collection(`classroom/${classroom.cid}/checkin/${checkinDoc.id}/students`)
            .doc(userData.uid)
            .get();

          // ถ้านักเรียนเช็คอินแล้ว
          if (studentCheckinSnapshot.exists) {
            // ตรวจสอบว่ามีคำถามในคาบนี้หรือไม่
            const questionsSnapshot = await db
              .collection(`classroom/${classroom.cid}/checkin/${checkinDoc.id}/questions`)
              .get();

            if (!questionsSnapshot.empty) {
              activeCheckinsData[classroom.cid] = {
                checkinNo: checkinDoc.id,
                hasQuestions: true,
                timestamp: checkinData.timestamp
              };
            }
          }
        }
      }
    }));
    setActiveCheckins(activeCheckinsData);
  } catch (error) {
    console.error("Error checking active questions:", error);
  }
};



const forceRefresh = () => {
  setRefreshKey((value) => value + 1);
};

  const handleAddClassroom = async () => {
    navigation.navigate('Addsutject', { userData: userData });
  };

  const handleCourseSelect = (cid) => {
    if (!userData) {
      console.error('ข้อมูล userData ยังไม่ได้รับการกำหนดค่า');
      return;
    }
    navigation.navigate('CheckInScreen', { cid: cid, userData: userData });
  };

  const handleAnswerQuestion = async (cid) => {
  if (!userData || !userData.uid) {
    console.error('ข้อมูล userData ยังไม่ได้รับการกำหนดค่า');
    return;
  }

  try {
    // ค้นหาเช็คอินล่าสุดของห้องเรียนนี้
    const checkinSnapshot = await db.collection(`classroom/${cid}/checkin`)
      .orderBy('localISOTime', 'desc')
      .limit(1)
      .get();

    checkinSnapshot.forEach((doc) => {
      console.log("Checkin Doc:", doc.id, doc.data());
    });

    if (checkinSnapshot.empty) {
      console.log("No check-in data available.");
      Alert.alert("Error", "ยังไม่มีการเช็คอินในห้องเรียนนี้");
      return;
    }

    const checkinDoc = checkinSnapshot.docs[0];
    if (checkinDoc && checkinDoc.exists) {
      // ดำเนินการต่อไป
    } else {
      console.log("Check-in document does not exist.");
    }

    const checkinId = checkinDoc.id;
    const checkinData = checkinDoc.data();


    // ตรวจสอบว่ายังเปิดให้ตอบคำถามอยู่หรือไม่ (status = 1)
    if (checkinData.status !== 1) {
      Alert.alert("Error", "ห้องเรียนนี้ปิดแล้ว ไม่สามารถตอบคำถามได้");
      return;
    }


    // ตรวจสอบว่านักเรียนได้เช็คอินหรือยัง
    const studentCheckinDoc = await db.doc(`classroom/${cid}/checkin/${checkinId}/students/${userData.uid}`).get();

    if (!studentCheckinDoc.exists) {
      Alert.alert("Error", "คุณต้องเช็คอินก่อนจึงจะสามารถตอบคำถามได้");
      return;
    }

    // ไปหน้าตอบคำถาม
    navigation.navigate('AnswerQuestion', {
      cid: cid,
      cno: checkinId,
      uid: userData.uid
    });

  } catch (error) {

    Alert.alert("Error", "เกิดข้อผิดพลาดในการตรวจสอบข้อมูล");
  }
};

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Classrooms</Text>
      </View>

      {/* ปุ่มรีเฟรช */}
      <TouchableOpacity
        style={styles.refreshButton}
        onPress={forceRefresh}
      >
        <Icon name="refresh" size={24} color="#007AFF" />
        <Text style={styles.refreshButtonText}>Refresh</Text>
      </TouchableOpacity>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading your classrooms...</Text>
        </View>
      ) : classrooms.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <Icon name="book" size={60} color="#ccc" />
          <Text style={styles.noClassrooms}>No classrooms yet</Text>
          <Text style={styles.emptyStateSubtext}>Join or create a classroom to get started</Text>
          <TouchableOpacity style={styles.emptyStateButton} onPress={handleAddClassroom}>
            <Text style={styles.emptyStateButtonText}>Add Your First Classroom</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={classrooms}
          keyExtractor={(item) => item.cid}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={styles.classroomCard}>
              <View style={styles.classroomContent}>
                <Image
                  source={{ uri: item.photo !== 'N/A' ? item.photo : 'https://via.placeholder.com/300x150/0066cc/FFFFFF?text=Course' }}
                  style={styles.classroomImage}
                  resizeMode="cover"
                />

                {item.status === 1 && (
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={styles.checkInButton}
                      onPress={() => {

                        handleCourseSelect(item.cid);
                      }}
                    >
                      <Text style={styles.checkInButtonText}>Check In</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.checkInButton}
                      onPress={() => {

                        handleAnswerQuestion(item.cid);
                      }}
                    >
                      <Text style={styles.checkInButtonText}>Answer Questions</Text>
                    </TouchableOpacity>



                    {activeCheckins[item.cid] && (
                      <TouchableOpacity
                        style={styles.answerButton}

                      >
                        <Text style={styles.answerButtonText}>Answer Questions</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <View style={styles.classroomBadge}>
                  <Text style={styles.classroomCode}>{item.code}</Text>
                </View>
                <View style={styles.classroomDetails}>
                  <Text style={styles.classroomName} numberOfLines={1}>{item.courseName}</Text>
                  <View style={styles.classroomInfoRow}>
                    <Icon name="location" size={14} color="#666" />
                    <Text style={styles.classroomInfo}>{item.room}</Text>
                  </View>

                  {item.status === 1 ? (
                  <View style={styles.enrolledBadge}>
                    <Text style={styles.enrolledText}>Enrolled</Text>
                  </View>
                ) : (
                  <View style={styles.joinButton}>
                    <Text style={styles.joinButtonText}>Waiting for Approval</Text>
                  </View>
                )}

                  {activeCheckins[item.cid] && (
                    <View style={styles.questionBadge}>
                      <Icon name="help-circle" size={18} color="#fff" />
                      <Text style={styles.questionBadgeText}>Questions Available</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
        />
      )}

      <TouchableOpacity
        style={styles.floatingButton}
        onPress={handleAddClassroom}
      >
        <Icon name="add" size={24} color="#fff" />
        <Text style={styles.floatingButtonText}>Add New</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
   // สไตล์เดิมทั้งหมด
   container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  refreshButtonText: {
    marginLeft: 8,
    color: '#007AFF',
    fontSize: 16,
  },
  listContainer: {
    paddingBottom: 80,
  },
  classroomCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  classroomContent: {
    width: '100%',
  },
  classroomImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#e1e4e8',
  },
  classroomBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  classroomCode: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  classroomDetails: {
    padding: 16,
  },
  classroomName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  classroomInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  classroomInfo: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  joinButton: {
    backgroundColor: '#FF9500',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  joinButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  enrolledBadge: {
    backgroundColor: '#34C759',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  enrolledText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noClassrooms: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  emptyStateButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },

  // สไตล์สำหรับปุ่มลอยด้านล่าง
  floatingButton: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    bottom: 20,
    right: 20,
    left: 20,
    backgroundColor: '#007AFF',
    borderRadius: 30,
    paddingVertical: 15,
    paddingHorizontal: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    },
    floatingButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
      marginLeft: 8,
    },
    checkInButton: {
    backgroundColor: '#34C759',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  checkInButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default ClassroomScreen;
