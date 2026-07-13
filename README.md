# 📚 Smart Attendance System Using Face Recognition

## Project Overview
This is a web-based attendance management system that uses **facial recognition technology** to automatically mark student attendance. The system is built with modern web technologies and Supabase as the backend.

## 🚀 Features
- ✅ Student Registration with Face Enrolment
- ✅ Real-time Face Recognition Attendance Marking
- ✅ Student Dashboard to View Attendance History
- ✅ Admin Dashboard with Reports & Filters
- ✅ Course Management
- ✅ Attendance Tracking by Week, Month, and Course
- ✅ Secure Authentication with Supabase

## 🛠️ Technologies Used
- **Frontend:** React.js, Bootstrap 5
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **Face Recognition:** face-api.js (browser-based)
- **Deployment:** GitHub, Vercel/Netlify

## 📁 Project Structure


## 👥 User Roles
| Role | Access |
|------|--------|
| **Student** | Register, Mark Attendance, View Own Records |
| **Admin** | View All Students, Manage Courses, View All Attendance Logs, Filter Reports |

## 🗄️ Database Schema (Supabase)
- **users** - Student & Admin profiles with face descriptors
- **courses** - Course information
- **attendance** - Attendance logs

## 📸 Face Recognition Process
1. Student captures face samples during registration
2. Face descriptors are stored in Supabase
3. During attendance, live face is compared with stored descriptors
4. If match found (Euclidean distance < 0.6), attendance is marked

## 🔐 Security Features
- Row Level Security (RLS) in Supabase
- JWT Authentication
- Students can only view their own attendance data
- Face descriptors stored as JSONB (encrypted)

## 🚀 How to Run Locally
```bash
# Clone the repository
git clone https://github.com/yzeman/Attendance-System.git

# Install dependencies
cd Attendance-System/frontend
npm install

# Create .env file with your Supabase keys
# VITE_SUPABASE_URL=your_url
# VITE_SUPABASE_ANON_KEY=your_key

# Run the application
npm run dev
