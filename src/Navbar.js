import React, { useEffect, useState } from "react";
import { auth } from "./firebase"; // นำเข้า Firebase config
import { onAuthStateChanged, signOut } from "firebase/auth"; // ใช้เพื่อตรวจสอบสถานะผู้ใช้
import { Link, useNavigate } from "react-router-dom"; // นำเข้า useNavigate

import { AppBar, Toolbar, Typography, Button, Avatar, Box } from "@mui/material"; // ใช้ MUI สำหรับ Navbar

function Navbar() {
  const [user, setUser] = useState(null); // สถานะของผู้ใช้ที่ล็อกอิน
  const navigate = useNavigate(); // ใช้สำหรับเปลี่ยนเส้นทาง

  // ตรวจสอบสถานะผู้ใช้
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser); // เก็บข้อมูลของผู้ใช้ที่ล็อกอิน
      } else {
        setUser(null); // หากไม่มีผู้ใช้ล็อกอินให้ตั้งค่าผู้ใช้เป็น null
      }
    });

    // ทำความสะอาดการเชื่อมต่อ
    return () => unsubscribe();
  }, []);

  // ฟังก์ชันสำหรับออกจากระบบ
  const handleLogout = async () => {
    try {
      await signOut(auth); // ทำการออกจากระบบ
      navigate("/login"); // เปลี่ยนเส้นทางไปยังหน้าล็อกอิน
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // ฟังก์ชันสำหรับนำทางไปยังหน้าโปรไฟล์
  const handleProfileEdit = () => {
    navigate("/editprofile"); // เปลี่ยนเส้นทางไปยังหน้าโปรไฟล์
  };

  return (
    <AppBar position="static" sx={{ backgroundColor: "#3f51b5" }}>
      <Toolbar>
      <Typography
      variant="h6"
      sx={{
        flexGrow: 1,
        fontWeight: "bold",
        cursor: "pointer",
      }}
      onClick={() => navigate("/home")}
    >
      ระบบจัดการห้องเรียน
    </Typography>
        {user ? (
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Typography variant="body1" sx={{ marginRight: 2, color: "#fff" }}>
              {user.displayName}
            </Typography>
            <Avatar
              alt={user.displayName}
              src={user.photoURL || "https://via.placeholder.com/40"}
              sx={{
                marginRight: 2,
                width: 40,
                height: 40,
                border: "2px solid #fff", // เพิ่มเส้นขอบรอบๆ รูปโปรไฟล์
              }}
            />
            {/* ปุ่มแก้ไขโปรไฟล์ */}
            <Button
              color="inherit"
              onClick={handleProfileEdit}
              sx={{
                marginRight: 2,
                backgroundColor: "#fff",
                color: "#3f51b5",
                "&:hover": {
                  backgroundColor: "#f0f0f0",
                },
              }}
            >
              แก้ไขโปรไฟล์
            </Button>
            <Button
              color="inherit"
              onClick={handleLogout}
              sx={{
                backgroundColor: "#e53935", // เปลี่ยนสีเป็นแดง
                "&:hover": {
                  backgroundColor: "#d32f2f", // เปลี่ยนสีเมื่อ hover
                },
              }}
            >
              ออกจากระบบ
            </Button>
          </Box>
        ) : (
          <Button color="inherit" component={Link} to="/login" sx={{ fontWeight: "bold" }}>
            เข้าสู่ระบบ
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;
