import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
  RefreshControl
} from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { db, firebase } from './firebase.js'; // Ensure the correct path to your firebase config
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const AnswerQuestion = ({ navigation }) => {
  const route = useRoute();
  const { cid, cno, uid, stdName: initialStdName } = route.params; // Obtain the student's name from route params
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [courseInfo, setCourseInfo] = useState(null);
  const [submittedAnswers, setSubmittedAnswers] = useState({});
  const [submittingQuestions, setSubmittingQuestions] = useState({});
  const [studentName, setStudentName] = useState(initialStdName || '');
  const [visibleQuestions, setVisibleQuestions] = useState({}); // Track visibility of each question

  const fetchData = async () => {
    try {
      setLoading(true);

      // Check if the checkin session is open
      const checkinDocRef = db.collection(`classroom/${cid}/checkin`).doc(cno);
      const checkinDoc = await checkinDocRef.get();

      if (!checkinDoc.exists || checkinDoc.data().status !== 1) {
        Alert.alert('แจ้งเตือน', 'การเช็คชื่อนี้ถูกปิดแล้ว ไม่สามารถตอบคำถามได้');
        navigation.goBack();
        return;
      }

      // Verify the student's check-in status
      const studentCheckinDoc = await db
        .collection(`classroom/${cid}/checkin/${cno}/students`)
        .doc(uid)
        .get();

      if (!studentCheckinDoc.exists) {
        Alert.alert('แจ้งเตือน', 'คุณยังไม่ได้เช็คชื่อในคาบนี้ กรุณาเช็คชื่อก่อนตอบคำถาม');
        navigation.goBack();
        return;
      }

      // Fetch the student name if not already set
      if (!studentName && studentCheckinDoc.exists) {
        const studentData = studentCheckinDoc.data();
        if (studentData && studentData.name) {
          setStudentName(studentData.name);
        }
      }

      // Fetch course information
      const courseDoc = await db.collection('classroom').doc(cid).get();
      if (courseDoc.exists) {
        setCourseInfo(courseDoc.data().info || courseDoc.data());
      }

      // Fetch all questions
      const questionsSnapshot = await checkinDocRef
        .collection('questions')
        .orderBy('question_no', 'asc')
        .get();

      const questionsList = [];
      const questionVisibility = {};

      questionsSnapshot.forEach(doc => {
        const questionData = doc.data();
        questionsList.push({ id: doc.id, ...questionData });
        // Store each question's visibility status
        questionVisibility[doc.id] = questionData.question_show ?? false;
      });

      setQuestions(questionsList);
      setVisibleQuestions(questionVisibility);

      // Check previously submitted answers
      const initialAnswers = {};
      const submittedStatus = {};

      for (const question of questionsList) {
        const answersSnapshot = await db
          .collection(`classroom/${cid}/checkin/${cno}/questions/${question.id}/answers`)
          .where('uid', '==', uid)
          .limit(1)
          .get();

        if (!answersSnapshot.empty) {
          const answerData = answersSnapshot.docs[0].data();
          initialAnswers[question.id] = answerData.answer_text;
          submittedStatus[question.id] = true;
        } else {
          initialAnswers[question.id] = '';
          submittedStatus[question.id] = false;
        }
      }

      setAnswers(initialAnswers);
      setSubmittedAnswers(submittedStatus);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
      return () => {
        // Cleanup if necessary
      };
    }, [cid, cno, uid])
  );

  // Realtime listener for question visibility changes
  useEffect(() => {
    if (!questions.length) return;

    let isMounted = true;
    const unsubscribes = [];

    // Set up listeners for each question's visibility
    questions.forEach(question => {
      const unsubscribe = db
        .collection(`classroom/${cid}/checkin/${cno}/questions`)
        .doc(question.id)
        .onSnapshot(
          (questionDoc) => {
            if (questionDoc.exists && isMounted) {
              const questionData = questionDoc.data();
              const isVisible = questionData.question_show ?? false;

              console.log(`Realtime update - Question ${question.id} visibility:`, isVisible);

              setVisibleQuestions(prev => ({
                ...prev,
                [question.id]: isVisible
              }));
            }
          },
          (error) => {
            console.error(`Error listening to question ${question.id}:`, error);
          }
        );

      unsubscribes.push(unsubscribe);
    });

    return () => {
      isMounted = false;
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [cid, cno, questions]);

  // Realtime listener for new questions
  useEffect(() => {
    let isMounted = true;

    const unsubscribeQuestions = db
      .collection(`classroom/${cid}/checkin/${cno}/questions`)
      .orderBy('question_no', 'asc')
      .onSnapshot(
        (questionsSnapshot) => {
          if (!isMounted || loading) return;

          const questionsList = [];
          const newVisibility = {};

          questionsSnapshot.forEach(doc => {
            const questionData = doc.data();
            questionsList.push({ id: doc.id, ...questionData });
            newVisibility[doc.id] = questionData.question_show ?? false;
          });

          if (questionsList.length > questions.length) {
            console.log('New questions detected:', questionsList.length - questions.length);

            setQuestions(questionsList);
            setVisibleQuestions(prev => ({
              ...prev,
              ...newVisibility
            }));

            const updatedAnswers = { ...answers };
            const updatedSubmittedStatus = { ...submittedAnswers };

            questionsList.forEach(question => {
              if (!updatedAnswers.hasOwnProperty(question.id)) {
                updatedAnswers[question.id] = '';
                updatedSubmittedStatus[question.id] = false;
              }
            });

            setAnswers(updatedAnswers);
            setSubmittedAnswers(updatedSubmittedStatus);

            Alert.alert(
              'คำถามใหม่',
              'อาจารย์ได้เพิ่มคำถามใหม่เข้ามา กรุณาเลื่อนลงเพื่อตอบคำถาม'
            );
          }
        },
        (error) => {
          console.error("Error in real-time questions listener:", error);
        }
      );

    return () => {
      isMounted = false;
      unsubscribeQuestions && unsubscribeQuestions();
    };
  }, [cid, cno, questions.length, loading, answers, submittedAnswers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAnswerChange = (questionId, text) => {
    setAnswers(prev => ({ ...prev, [questionId]: text }));
  };

  const handleSubmit = async (questionId) => {
    if (!answers[questionId] || answers[questionId].trim() === '') {
      Alert.alert('แจ้งเตือน', 'กรุณาพิมพ์คำตอบก่อนส่ง');
      return;
    }

    try {
      setSubmittingQuestions(prev => ({ ...prev, [questionId]: true }));

      const answerRef = db
        .collection('classroom')
        .doc(cid)
        .collection('checkin')
        .doc(cno)
        .collection('questions')
        .doc(questionId)
        .collection('answers');

      await answerRef.add({
        answer_text: answers[questionId],
        uid: uid,
        student_name: studentName,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      setSubmittedAnswers(prev => ({ ...prev, [questionId]: true }));
      Alert.alert('สำเร็จ', 'ส่งคำตอบเรียบร้อยแล้ว');

    } catch (error) {
      console.error('Error submitting answer:', error);
      Alert.alert('ข้อผิดพลาด', `การส่งคำตอบเกิดข้อผิดพลาด: ${error.message || 'โปรดลองใหม่อีกครั้ง'}`);
    } finally {
      setSubmittingQuestions(prev => ({ ...prev, [questionId]: false }));
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>กำลังโหลดคำถาม...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#4A90E2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ตอบคำถาม</Text>
      </View>

      {/* Course Info */}
      {courseInfo && (
        <View style={styles.courseInfoContainer}>
          <Text style={styles.courseCode}>
            {courseInfo.code || courseInfo.cid || 'N/A'}
          </Text>
          <Text style={styles.courseName}>
            {courseInfo.name || courseInfo.cname || 'N/A'}
          </Text>
        </View>
      )}

      {/* Questions List */}
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#4A90E2"]}
            tintColor="#4A90E2"
          />
        }
      >
        {questions.length > 0 ? (
          questions.map((question, index) => (
            <View key={question.id} style={styles.questionCard}>
              <View style={styles.questionHeader}>
                <View style={styles.questionNumberBadge}>
                  <Text style={styles.questionNumberText}>
                    {question.question_no || index + 1}
                  </Text>
                </View>
                <Text style={styles.questionTitle}>คำถาม</Text>
              </View>

              {visibleQuestions[question.id] ? (
                <>
                  <Text style={styles.questionText}>
                    {question.question_text}
                  </Text>

                  <View style={styles.answerContainer}>
                    <TextInput
                      style={[
                        styles.answerInput,
                        submittedAnswers[question.id] && styles.disabledInput
                      ]}
                      multiline
                      placeholder="พิมพ์คำตอบของคุณที่นี่..."
                      value={answers[question.id]}
                      onChangeText={(text) => handleAnswerChange(question.id, text)}
                      editable={!submittedAnswers[question.id]}
                    />

                    {submittedAnswers[question.id] ? (
                      <View style={styles.submittedContainer}>
                        <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
                        <Text style={styles.submittedText}>ส่งคำตอบแล้ว</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.submitButton}
                        onPress={() => handleSubmit(question.id)}
                        disabled={submittingQuestions[question.id]}
                      >
                        {submittingQuestions[question.id] ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.submitButtonText}>ส่งคำตอบ</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              ) : (
                <View style={styles.hiddenQuestionContainer}>
                  <MaterialIcons name="visibility-off" size={24} color="#CCCCCC" />
                  <Text style={styles.hiddenQuestionText}>อาจารย์ยังไม่เปิดให้ดูคำถามนี้</Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="question-answer" size={60} color="#CCCCCC" />
            <Text style={styles.emptyText}>ไม่มีคำถามในขณะนี้</Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    marginLeft: 15,
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  refreshButton: {
    padding: 5,
  },
  courseInfoContainer: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginBottom: 8,
  },
  courseCode: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4A90E2',
  },
  courseName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 3,
  },
  scrollContainer: {
    flex: 1,
    padding: 15,
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  questionNumberBadge: {
    backgroundColor: '#4A90E2',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  questionNumberText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  questionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
  },
  questionText: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 22,
    marginBottom: 15,
  },
  answerContainer: {
    marginTop: 5,
  },
  answerInput: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  disabledInput: {
    backgroundColor: '#F5F5F7',
    color: '#666666',
  },
  submitButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submittedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#EDF7ED',
    borderRadius: 8,
  },
  submittedText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 30,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: '#999999',
  },
});

export default AnswerQuestion;