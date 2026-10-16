import React, { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { Alert, Card, CardContent, CardMedia, Grid, Typography, Box, CircularProgress, Button } from "@mui/material";
import { ensureUserProfile } from "./userProfile";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Edit, Delete } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { doc, deleteDoc } from 'firebase/firestore';

function Home() {
  const [user, setUser] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [slowConnection, setSlowConnection] = useState(false);
  const [retry, setRetry] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) navigate("/login", { replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setProfileError("");
    // Profile storage must never delay entering the classroom page.
    ensureUserProfile(user).catch((error) => {
      if (active) setProfileError(`เข้าสู่ระบบแล้ว แต่เข้าถึงโปรไฟล์ไม่ได้ (${error.code || "unknown-error"})`);
    });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setClassrooms([]);
    setLoading(true);
    setDataError("");
    setSlowConnection(false);
    const timer = setTimeout(() => setSlowConnection(true), 15000);
    // Subscribe only after Firebase has restored the authenticated session.
    const unsubscribeClassrooms = onSnapshot(collection(db, "classroom"), (querySnapshot) => {
      const classroomsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setClassrooms(classroomsData);
      setLoading(false);
      setSlowConnection(false);
      clearTimeout(timer);
    }, (error) => {
      clearTimeout(timer);
      setSlowConnection(false);
      setDataError(error.code === "permission-denied"
        ? "เข้าสู่ระบบแล้ว แต่บัญชีนี้ไม่มีสิทธิ์อ่านห้องเรียน กรุณาตรวจสอบสิทธิ์ Firestore ใน Firebase"
        : `โหลดห้องเรียนไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง (${error.code || "unknown-error"})`);
      setLoading(false);
    });

    // คืนค่า unsubscribe เมื่อ component unmount
    return () => {
      clearTimeout(timer);
      unsubscribeClassrooms();
    };
  }, [user, retry]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const handleGoToAddClassroom = () => {
    navigate('/addclassroom');
  };

  const handleGoToAddStudent = (classroomId) => {
    navigate(`/addstudent/${classroomId}`);
  };

  const handleGoToCreateCheckInTeacher = (classroomId) => {
    navigate(`/createcheckin/${classroomId}`);
  };

  const handleShowCheckInTeacher = (classroomId) => {
    navigate(`/showcheckin/${classroomId}`);
  };

  const handleShowDetail = (classroomId) => {
    navigate(`/showdetail/${classroomId}`);
  };

  const goToCreateQuestion = (cid, cno) => {
    navigate(`/question/${cid}/checkin/${cno}`);
  };

  const handleEditClick = (classroomId) => {
    console.log("Edit Classroom ID: ", classroomId);
    navigate(`/classroom/${classroomId}/edit`);
  };

  const handleDeleteClassroom = async (classroomId) => {
    const confirmDelete = window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบห้องเรียนนี้?");
    if (!confirmDelete) return;
  
    try {
      setLoading(true); // แสดง loading indicator ระหว่างลบข้อมูล
      
      // อ้างถึงเอกสารห้องเรียนที่ต้องการลบ
      const classroomRef = doc(db, "classroom", classroomId);
  
      // ลบเอกสาร
      await deleteDoc(classroomRef);
      
      // อัพเดท state โดยตรงเพื่อให้ UI อัพเดททันที (ไม่ต้องรอ onSnapshot)
      setClassrooms(prevClassrooms => prevClassrooms.filter(classroom => classroom.id !== classroomId));
      
      setLoading(false);
      alert("ลบห้องเรียนสำเร็จ!");
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการลบห้องเรียน: ", error);
      setLoading(false);
      alert("ไม่สามารถลบห้องเรียนได้: " + error.message);
    }
  };

  if (!user) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", marginTop: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      
      <Box
        sx={{
          border: "2px solid #1976d2", // กรอบสีฟ้า
          borderRadius: "12px", // มุมโค้งมน
          padding: "8px", // ระยะห่างภายในกรอบ
          boxShadow: 2, // เงา
          maxWidth: "40%", // กำหนดความกว้างสูงสุด
          margin: "0 auto", // จัดตำแหน่งกลาง
          textAlign: "center", // จัดข้อความให้อยู่กลาง
        }}
      >
        <Typography variant="h4" gutterBottom align="center" color="primary" sx={{ fontSize: "30px" }}>
          ยินดีต้อนรับ, {user.displayName || user.email || "ผู้ใช้"}
        </Typography>
      </Box>

      {profileError && <Alert severity="warning" sx={{ marginTop: 2 }}>{profileError}</Alert>}
      {(dataError || slowConnection) && (
        <Alert severity={dataError ? "error" : "warning"} sx={{ marginTop: 2 }}
          action={<Button color="inherit" onClick={() => setRetry((value) => value + 1)}>ลองอีกครั้ง</Button>}>
          {dataError || "เข้าสู่ระบบแล้ว แต่การเชื่อมต่อข้อมูลห้องเรียนใช้เวลานาน กรุณาตรวจสอบอินเทอร์เน็ตหรือลองอีกครั้ง"}
        </Alert>
      )}

  
      <Box sx={{ border: "2px solid rgb(226, 226, 226)", borderRadius: "8px", padding: "8px", maxWidth: "300px", margin: "20px 0", boxShadow: 2 }}>
        <Typography variant="h6" gutterBottom align="center" color="textPrimary">
          ข้อมูลห้องเรียนทั้งหมด
        </Typography>
      </Box>
  
      {/* ปุ่มเพิ่มวิชา */}
      <Box sx={{ textAlign: "center", marginBottom: 4 }}>
        <Button
          variant="contained"
          color="success"
          onClick={handleGoToAddClassroom}
          sx={{
            padding: "12px 20px",
            fontSize: "16px",
            fontWeight: "bold",
            borderRadius: 2,
            boxShadow: 2,
            "&:hover": { backgroundColor: "#388e3c" }, // สีเขียวเข้มเมื่อ hover
          }}
        >
          + เพิ่มวิชา
        </Button>
      </Box>
  
      {loading ? (
        <Box sx={{ textAlign: "center", marginTop: 4 }} role="status">
          <CircularProgress />
          <Typography>กำลังโหลดห้องเรียน...</Typography>
        </Box>
      ) : dataError ? null : classrooms.length > 0 ? (
        <Grid container spacing={3} justifyContent="center">
          {classrooms.map((classroom) => (
            <Grid item xs={12} sm={6} md={3} key={classroom.id}>
              <Card
                sx={{
                  maxWidth: 345,
                  boxShadow: 4,
                  borderRadius: 3,
                  position: "relative", 
                  transition: "transform 0.3s, box-shadow 0.3s",
                  "&:hover": {
                    transform: "scale(1.05)",
                    boxShadow: 6,
                  },
                }}
              >
              <Box
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  display: "flex",
                  gap: 2, // เพิ่มระยะห่างระหว่างไอคอนให้ชัดเจนยิ่งขึ้น
                }}
              >
                  <IconButton
                    size="medium" // ขยายขนาดไอคอนให้ใหญ่ขึ้น
                    color="primary"
                    sx={{
                      backgroundColor: "white", // เพิ่มพื้นหลังสีขาวให้ไอคอน
                      borderRadius: "50%", // ทำให้ปุ่มเป็นวงกลม
                      "&:hover": {
                        backgroundColor: "#f0f0f0", // เปลี่ยนสีพื้นหลังเมื่อ hover
                      },
                    }}
                    onClick={() => handleEditClick(classroom.id)}
                  >
                    <Edit fontSize="medium" sx={{ color: "#1976d2" }} /> {/* ไอคอนสีฟ้าและขนาดปานกลาง */}
                  </IconButton>

                  {/* ปุ่มลบ */}
                  <IconButton
                    size="medium"
                    aria-label="delete"
                    onClick={(e) => {
                      e.stopPropagation(); // ป้องกันการ bubble ของ event
                      handleDeleteClassroom(classroom.id);
                    }}
                    sx={{
                      backgroundColor: "white",
                      borderRadius: "50%",
                      zIndex: 10, // เพิ่ม z-index ให้สูงขึ้น
                      "&:hover": {
                        backgroundColor: "#f8d7da",
                      },
                    }}
                  >
                    <Delete fontSize="medium" sx={{ color: "#d32f2f" }} />
                  </IconButton>
                </Box>

                <CardMedia
                  component="img"
                  alt={classroom.info?.name}
                  height="140"
                  image={classroom.info?.photo || "https://via.placeholder.com/150"}
                  sx={{ objectFit: "cover" }}
                />
                <CardContent>
                  <Typography variant="h6" component="div" sx={{ fontWeight: "bold" }}>
                    {classroom.info?.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ marginTop: 1 }}>
                    รหัสวิชา: {classroom.info?.code}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ห้องเรียน: {classroom.info?.room}
                  </Typography>

                  {/* ปุ่มด้านล่าง */}
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, marginTop: 2 }}>
                    <Button variant="contained" color="info" onClick={() => handleShowDetail(classroom.id)}>
                      ℹ️ ดูรายละเอียดวิชา
                    </Button>
                    <Button variant="contained" color="secondary" onClick={() => goToCreateQuestion(classroom.id, 1)}>
                      ✍️ เพิ่มคำถาม
                    </Button>
                    <Button variant="contained" color="warning" onClick={() => handleGoToCreateCheckInTeacher(classroom.id)}>
                      ✅ สร้างเช็คชื่อ
                    </Button>
                    <Button variant="contained" color="error" onClick={() => handleShowCheckInTeacher(classroom.id)}>
                      📊 ดูผลการเช็คชื่อ
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box sx={{ textAlign: "center", marginTop: 4 }}>
          <Typography variant="h6" color="text.secondary">
            ไม่พบข้อมูลห้องเรียน
          </Typography>
        </Box>
      )}
    </div>
  );
}

export default Home;
