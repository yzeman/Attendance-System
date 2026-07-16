import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { 
  Container, Row, Col, Card, Table, Button, Form, 
  Badge, Alert, Spinner, Modal, Tab, Tabs 
} from 'react-bootstrap';

const AdminDashboard = () => {
  // State variables
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalCourses: 0,
    totalAttendance: 0,
    attendanceRate: 0,
    todayAttendance: 0
  });
  
  // Course attendance stats
  const [selectedCourseStats, setSelectedCourseStats] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  
  // Semester toggle - saved to database
  const [secondSemesterEnabled, setSecondSemesterEnabled] = useState(true);
  const [semesterLoaded, setSemesterLoaded] = useState(false);
  
  // Course attendance list modal
  const [showCourseAttendanceModal, setShowCourseAttendanceModal] = useState(false);
  const [courseAttendanceData, setCourseAttendanceData] = useState([]);
  const [selectedCourseForAttendance, setSelectedCourseForAttendance] = useState(null);
  
  // Today's attendance modal
  const [showTodayAttendanceModal, setShowTodayAttendanceModal] = useState(false);
  const [todayAttendanceData, setTodayAttendanceData] = useState([]);
  
  // Session states
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionMessage, setSessionMessage] = useState('');
  const [currentSession, setCurrentSession] = useState(null);
  const [newSessionData, setNewSessionData] = useState({
    sessionName: '',
    startDate: '',
    endDate: ''
  });
  const [confirmCode, setConfirmCode] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [showConfirmStep, setShowConfirmStep] = useState(false);
  
  // Debug state
  const [debugMessages, setDebugMessages] = useState([]);
  const [debugError, setDebugError] = useState(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    courseId: '',
    studentId: '',
    department: '',
    level: '',
    searchQuery: ''
  });

  // Modal states for adding course
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [newCourse, setNewCourse] = useState({
    courseCode: '',
    courseName: '',
    lecturer: '',
    department: '',
    level: '',
    semester: '',
    is_active: true,
    attendance_enabled: true
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // Edit Course Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [editCourseData, setEditCourseData] = useState({
    courseCode: '',
    courseName: '',
    lecturer: '',
    department: '',
    level: '',
    semester: '',
    is_active: true,
    attendance_enabled: true
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState('');

  // Delete Course Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCourse, setDeletingCourse] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');

  // Department Modal states
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [newDepartment, setNewDepartment] = useState('');
  const [departmentLoading, setDepartmentLoading] = useState(false);
  const [departmentMessage, setDepartmentMessage] = useState('');

  // Enroll Modal states
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollMessage, setEnrollMessage] = useState('');
  const [enrollDebug, setEnrollDebug] = useState([]);
  
  // Search states for modals
  const [courseSearchEnroll, setCourseSearchEnroll] = useState('');
  const [studentSearchEnroll, setStudentSearchEnroll] = useState('');

  // User state
  const user = JSON.parse(localStorage.getItem('user'));

  // Add debug message function
  const addDebug = (message, isError = false) => {
    const timestamp = new Date().toLocaleTimeString();
    const entry = { timestamp, message, isError };
    setDebugMessages(prev => [...prev, entry]);
    if (isError) {
      setDebugError(message);
    }
    console.log(`[${timestamp}] ${message}`);
  };

  // Clear modal debug
  const clearEnrollDebug = () => {
    setEnrollDebug([]);
  };

  // Copy debug log to clipboard
  const copyDebugLog = () => {
    const logText = enrollDebug.map(msg => 
      `[${msg.timestamp}] ${msg.message}`
    ).join('\n');
    
    navigator.clipboard.writeText(logText).then(() => {
      alert('✅ Debug log copied to clipboard!');
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = logText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('✅ Debug log copied to clipboard!');
    });
  };

  // Fetch current session
  const fetchCurrentSession = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_current_session');
      
      if (error) throw error;
      setCurrentSession(data || null);
    } catch (error) {
      console.error('Error fetching session:', error);
      addDebug(`❌ Session fetch error: ${error.message}`, true);
    }
  };

  // Fetch semester preference from database
  const fetchSemesterPreference = async () => {
    try {
      // Check if there's a settings table or store in admin user
      const { data, error } = await supabase
        .from('users')
        .select('semester_preference')
        .eq('id', user.id)
        .single();

      if (error) {
        // If column doesn't exist, use default
        setSecondSemesterEnabled(true);
        setSemesterLoaded(true);
        return;
      }

      if (data?.semester_preference) {
        setSecondSemesterEnabled(data.semester_preference === 'Second');
      } else {
        setSecondSemesterEnabled(true);
      }
      setSemesterLoaded(true);
    } catch (error) {
      console.error('Error fetching semester preference:', error);
      setSecondSemesterEnabled(true);
      setSemesterLoaded(true);
    }
  };

  // Save semester preference to database
  const saveSemesterPreference = async (value) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ semester_preference: value ? 'Second' : 'First' })
        .eq('id', user.id);

      if (error) {
        console.error('Error saving semester preference:', error);
      } else {
        addDebug(`✅ Semester preference saved: ${value ? 'Second' : 'First'}`);
      }
    } catch (error) {
      console.error('Error saving semester preference:', error);
    }
  };

  // Handle semester toggle change
  const handleSemesterToggle = (e) => {
    const checked = e.target.checked;
    setSecondSemesterEnabled(checked);
    saveSemesterPreference(checked);
  };

  // Process session rollover
  const handleSessionRollover = async () => {
    if (!newSessionData.sessionName || !newSessionData.startDate || !newSessionData.endDate) {
      setSessionMessage('❌ Please fill in all fields.');
      return;
    }

    if (confirmCode !== 'admin123') {
      setSessionMessage('❌ Invalid confirmation code.');
      return;
    }

    setSessionLoading(true);
    setSessionMessage('');

    try {
      const { data, error } = await supabase
        .rpc('process_session_rollover', {
          new_session_name: newSessionData.sessionName,
          start_date: newSessionData.startDate,
          end_date: newSessionData.endDate
        });

      if (error) throw error;

      setSessionMessage('✅ ' + data);
      setNewSessionData({ sessionName: '', startDate: '', endDate: '' });
      setConfirmCode('');
      setShowWarning(false);
      setShowConfirmStep(false);
      
      await fetchAllData();
      await fetchCurrentSession();

      setTimeout(() => {
        setShowSessionModal(false);
        setSessionMessage('');
        setSessionLoading(false);
      }, 3000);

    } catch (error) {
      setSessionMessage('❌ ' + error.message);
      setSessionLoading(false);
    }
  };

  // Re-enroll students after course changes
  const reEnrollStudents = async () => {
    try {
      const { error } = await supabase
        .rpc('enroll_existing_students');
      
      if (error) {
        console.error('Error re-enrolling students:', error);
        addDebug(`⚠️ Re-enrollment error: ${error.message}`, true);
      } else {
        addDebug('✅ Students re-enrolled successfully');
        await fetchAllData();
      }
    } catch (error) {
      console.error('Error re-enrolling students:', error);
    }
  };

  // Load all data on mount
  useEffect(() => {
    fetchAllData();
    fetchDepartments();
    fetchCurrentSession();
    fetchSemesterPreference();
  }, []);

  // Fetch departments
  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      addDebug(`❌ Departments fetch error: ${error.message}`, true);
    }
  };

  // Handle add department
  const handleAddDepartment = async () => {
    if (!newDepartment.trim()) {
      setDepartmentMessage('❌ Please enter a department name.');
      return;
    }

    setDepartmentLoading(true);
    setDepartmentMessage('');

    try {
      const { error } = await supabase
        .from('departments')
        .insert({ name: newDepartment.trim() });

      if (error) throw error;

      setDepartmentMessage('✅ Department added successfully!');
      setNewDepartment('');
      await fetchDepartments();

      setTimeout(() => {
        setShowDepartmentModal(false);
        setDepartmentMessage('');
        setDepartmentLoading(false);
      }, 1500);

    } catch (error) {
      setDepartmentMessage('❌ ' + error.message);
      setDepartmentLoading(false);
    }
  };

  // Handle delete department
  const handleDeleteDepartment = async (departmentId) => {
    if (!window.confirm('⚠️ Are you sure you want to delete this department?')) return;

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', departmentId);

      if (error) throw error;
      await fetchDepartments();
      addDebug(`✅ Department deleted successfully`);
    } catch (error) {
      addDebug(`❌ Delete department error: ${error.message}`, true);
      alert('❌ Error deleting department: ' + error.message);
    }
  };

  // Fetch all data
  const fetchAllData = async () => {
    setLoading(true);
    setDebugMessages([]);
    setDebugError(null);
    addDebug('🔵 Admin: Fetching all data...');
    
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('users')
        .select('id, full_name, matric_no, email, phone, created_at, enrolled_courses, role, gender, level, department')
        .eq('role', 'student')
        .order('full_name');

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .order('course_code');

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      const logs = await fetchAttendanceLogs();
      
      const totalAttendance = logs?.length || 0;
      const presentCount = logs?.filter(a => a.status === 'present').length || 0;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayLogs = logs?.filter(a => new Date(a.date) >= today) || [];
      const todayPresent = todayLogs.filter(a => a.status === 'present').length || 0;

      setStats({
        totalStudents: studentsData?.length || 0,
        totalCourses: coursesData?.length || 0,
        totalAttendance: totalAttendance,
        attendanceRate: totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0,
        todayAttendance: todayPresent
      });

      setFilteredLogs(logs || []);
      addDebug(`✅ Data loaded: ${totalAttendance} records`);

    } catch (error) {
      addDebug(`❌ Error: ${error.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  // Fetch attendance logs with optional filters
  const fetchAttendanceLogs = async (filterObj = {}) => {
    try {
      let query = supabase
        .from('attendance')
        .select(`
          *,
          student:student_id(id, full_name, matric_no),
          course:course_id(id, course_code, course_name, department, level, semester)
        `)
        .order('date', { ascending: false });

      if (filterObj.courseId) query = query.eq('course_id', filterObj.courseId);
      if (filterObj.studentId) query = query.eq('student_id', filterObj.studentId);
      if (filterObj.department) query = query.eq('course.department', filterObj.department);
      if (filterObj.level) query = query.eq('course.level', filterObj.level);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];

    } catch (error) {
      addDebug(`❌ Attendance logs error: ${error.message}`, true);
      return [];
    }
  };

  // Helper: Get start of week
  const getStartOfWeek = (year, weekNum) => {
    const jan1 = new Date(year, 0, 1);
    const daysOffset = (jan1.getDay() + 6) % 7;
    const firstMonday = new Date(jan1);
    firstMonday.setDate(jan1.getDate() - daysOffset + (weekNum - 1) * 7);
    return firstMonday;
  };

  // Load course statistics when course is selected
  const loadCourseStats = async (courseId, studentId = '') => {
    if (!courseId) {
      setSelectedCourseStats(null);
      return;
    }

    addDebug(`📊 Loading stats for course: ${courseId}`);
    try {
      let query = supabase
        .from('attendance')
        .select(`
          *,
          student:student_id(id, full_name, matric_no)
        `)
        .eq('course_id', courseId);

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      const { data: logs, error } = await query;
      if (error) throw error;

      const total = logs?.length || 0;
      const present = logs?.filter(a => a.status === 'present').length || 0;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayLogs = logs?.filter(a => new Date(a.date) >= today) || [];
      const todayPresent = todayLogs.filter(a => a.status === 'present').length || 0;
      const todayTotal = todayLogs.length;

      const studentNames = [...new Set(logs?.map(a => a.student?.full_name).filter(Boolean))];
      const course = courses.find(c => c.id === courseId);

      setSelectedCourseStats({
        courseCode: course?.course_code || 'Unknown',
        courseName: course?.course_name || 'Unknown',
        total,
        present,
        percentage: total > 0 ? Math.round((present / total) * 100) : 0,
        todayPresent,
        todayTotal,
        todayPercentage: todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0,
        students: studentNames,
        logs: logs || []
      });

      addDebug(`✅ Stats loaded: ${total} total, ${todayTotal} today`);

    } catch (error) {
      addDebug(`❌ Stats error: ${error.message}`, true);
    }
  };

  // Handle course selection change
  const handleCourseSelect = (e) => {
    const courseId = e.target.value;
    setSelectedCourseId(courseId);
    if (courseId) {
      loadCourseStats(courseId, selectedStudentId);
    } else {
      setSelectedCourseStats(null);
    }
  };

  // Handle student selection change
  const handleStudentSelect = (e) => {
    const studentId = e.target.value;
    setSelectedStudentId(studentId);
    if (selectedCourseId) {
      loadCourseStats(selectedCourseId, studentId);
    }
  };

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
    
    if (name === 'department' || name === 'level') {
      applyFilters();
    }
  };

  // Apply filters with search
  const applyFilters = async () => {
    const activeFilters = {};
    if (filters.courseId) activeFilters.courseId = filters.courseId;
    if (filters.studentId) activeFilters.studentId = filters.studentId;
    if (filters.department) activeFilters.department = filters.department;
    if (filters.level) activeFilters.level = filters.level;

    let logs = await fetchAttendanceLogs(activeFilters);
    
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim();
      logs = logs.filter(log => 
        log.student?.full_name?.toLowerCase().includes(query) ||
        log.student?.matric_no?.toLowerCase().includes(query) ||
        log.course?.course_code?.toLowerCase().includes(query) ||
        log.course?.course_name?.toLowerCase().includes(query)
      );
    }
    
    const groupedLogs = {};
    logs.forEach(log => {
      const key = log.student_id;
      if (!groupedLogs[key]) {
        groupedLogs[key] = {
          student: log.student,
          course: log.course,
          count: 0
        };
      }
      groupedLogs[key].count++;
    });
    
    setFilteredLogs(Object.values(groupedLogs));
  };

  // Reset filters
  const resetFilters = async () => {
    setFilters({
      courseId: '',
      studentId: '',
      department: '',
      level: '',
      searchQuery: ''
    });
    const logs = await fetchAttendanceLogs({});
    const groupedLogs = {};
    logs.forEach(log => {
      const key = log.student_id;
      if (!groupedLogs[key]) {
        groupedLogs[key] = {
          student: log.student,
          course: log.course,
          count: 0
        };
      }
      groupedLogs[key].count++;
    });
    setFilteredLogs(Object.values(groupedLogs));
  };

  // Handle adding new course
  const handleAddCourse = async () => {
    setModalLoading(true);
    setModalMessage('');

    if (!newCourse.department) {
      setModalMessage('❌ Please select a department.');
      setModalLoading(false);
      return;
    }
    if (!newCourse.level) {
      setModalMessage('❌ Please select a level.');
      setModalLoading(false);
      return;
    }
    if (!newCourse.semester) {
      setModalMessage('❌ Please select a semester.');
      setModalLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('courses')
        .insert({
          course_code: newCourse.courseCode.toUpperCase(),
          course_name: newCourse.courseName,
          lecturer: newCourse.lecturer,
          department: newCourse.department,
          level: newCourse.level,
          semester: newCourse.semester,
          is_active: newCourse.is_active !== undefined ? newCourse.is_active : true,
          attendance_enabled: newCourse.attendance_enabled !== undefined ? newCourse.attendance_enabled : true
        });

      if (error) throw error;

      setModalMessage('✅ Course added successfully!');
      setNewCourse({ 
        courseCode: '', 
        courseName: '', 
        lecturer: '',
        department: '',
        level: '',
        semester: '',
        is_active: true,
        attendance_enabled: true
      });
      
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .order('course_code');
      setCourses(coursesData || []);

      await reEnrollStudents();

      setTimeout(() => {
        setShowCourseModal(false);
        setModalMessage('');
        setModalLoading(false);
      }, 1500);

    } catch (error) {
      setModalMessage('❌ ' + error.message);
      setModalLoading(false);
    }
  };

  // Edit Course Function
  const handleEditCourse = async () => {
    if (!editingCourse) return;
    
    setEditLoading(true);
    setEditMessage('');

    try {
      const { error } = await supabase
        .from('courses')
        .update({
          course_code: editCourseData.courseCode.toUpperCase(),
          course_name: editCourseData.courseName,
          lecturer: editCourseData.lecturer,
          department: editCourseData.department,
          level: editCourseData.level,
          semester: editCourseData.semester,
          is_active: editCourseData.is_active !== undefined ? editCourseData.is_active : true,
          attendance_enabled: editCourseData.attendance_enabled !== undefined ? editCourseData.attendance_enabled : true
        })
        .eq('id', editingCourse.id);

      if (error) throw error;

      setEditMessage('✅ Course updated successfully!');
      addDebug(`✅ Course updated: ${editCourseData.courseCode}`);
      
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .order('course_code');
      setCourses(coursesData || []);

      await reEnrollStudents();

      setTimeout(() => {
        setShowEditModal(false);
        setEditMessage('');
        setEditingCourse(null);
        setEditLoading(false);
      }, 1500);

    } catch (error) {
      setEditMessage('❌ ' + error.message);
      setEditLoading(false);
    }
  };

  // Delete Course Function
  const handleDeleteCourse = async () => {
    if (!deletingCourse) return;
    
    setDeleteLoading(true);
    setDeleteMessage('');

    try {
      const { data: enrolledStudents, error: fetchError } = await supabase
        .from('users')
        .select('id, enrolled_courses')
        .contains('enrolled_courses', [deletingCourse.id]);

      if (fetchError) {
        addDebug(`⚠️ Error finding enrolled students: ${fetchError.message}`, true);
      }

      if (enrolledStudents && enrolledStudents.length > 0) {
        for (let student of enrolledStudents) {
          const updatedCourses = (student.enrolled_courses || [])
            .filter(id => id !== deletingCourse.id);
          
          const { error: updateError } = await supabase
            .from('users')
            .update({ enrolled_courses: updatedCourses })
            .eq('id', student.id);

          if (updateError) {
            console.error(`Error updating student ${student.id}:`, updateError);
          }
        }
        addDebug(`✅ Removed course from ${enrolledStudents.length} student(s)`);
      }

      const { error: attError } = await supabase
        .from('attendance')
        .delete()
        .eq('course_id', deletingCourse.id);

      if (attError) {
        console.error('Error deleting attendance:', attError);
        addDebug(`⚠️ Attendance deletion warning: ${attError.message}`, true);
      } else {
        addDebug(`✅ Deleted attendance records for course`);
      }

      const { error: courseError } = await supabase
        .from('courses')
        .delete()
        .eq('id', deletingCourse.id);

      if (courseError) {
        throw new Error(`Failed to delete course: ${courseError.message}`);
      }

      setDeleteMessage('✅ Course and all associated data deleted successfully!');
      addDebug(`✅ Course PERMANENTLY deleted: ${deletingCourse.course_code}`);
      
      await fetchAllData();

      setTimeout(() => {
        setShowDeleteModal(false);
        setDeleteMessage('');
        setDeletingCourse(null);
        setDeleteLoading(false);
      }, 1500);

    } catch (error) {
      setDeleteMessage('❌ ' + error.message);
      addDebug(`❌ Delete error: ${error.message}`, true);
      setDeleteLoading(false);
    }
  };

  // Handle Enroll Students
  const handleEnrollStudents = async () => {
    setEnrollDebug([]);
    
    if (!selectedCourse || selectedStudents.length === 0) {
      setEnrollMessage('Please select a course and at least one student.');
      return;
    }

    setEnrollLoading(true);
    setEnrollMessage('');
    
    const modalDebug = (message, isError = false) => {
      const timestamp = new Date().toLocaleTimeString();
      const entry = { timestamp, message, isError };
      setEnrollDebug(prev => [...prev, entry]);
    };

    modalDebug(`🔵 Enrolling ${selectedStudents.length} student(s)`);
    const course = courses.find(c => c.id === selectedCourse);
    modalDebug(`📋 Course: ${course?.course_code} - ${course?.course_name}`);

    try {
      let successCount = 0;
      let failCount = 0;
      let alreadyEnrolledCount = 0;
      
      for (let studentId of selectedStudents) {
        modalDebug(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        modalDebug(`🔵 Processing student: ${studentId}`);
        
        try {
          const { data: studentData, error: fetchError } = await supabase
            .from('users')
            .select('id, full_name, enrolled_courses')
            .eq('id', studentId)
            .single();

          if (fetchError) {
            modalDebug(`❌ Fetch error: ${fetchError.message}`, true);
            failCount++;
            continue;
          }

          let currentCourses = studentData?.enrolled_courses || [];
          modalDebug(`📋 ${studentData.full_name} - Current: ${currentCourses.length} courses`);

          if (currentCourses.includes(selectedCourse)) {
            modalDebug(`⚠️ Already enrolled`);
            alreadyEnrolledCount++;
            continue;
          }

          const updatedCourses = [...currentCourses, selectedCourse];
          const uniqueCourses = [...new Set(updatedCourses)];
          modalDebug(`📤 Updating to: ${uniqueCourses.length} courses`);

          const { error: updateError } = await supabase
            .from('users')
            .update({ enrolled_courses: uniqueCourses })
            .eq('id', studentId);

          if (updateError) {
            modalDebug(`❌ Update error: ${updateError.message}`, true);
            failCount++;
            continue;
          }

          const { data: verifyData } = await supabase
            .from('users')
            .select('enrolled_courses')
            .eq('id', studentId)
            .single();

          const verifiedCourses = verifyData?.enrolled_courses || [];
          if (verifiedCourses.includes(selectedCourse)) {
            modalDebug(`✅ VERIFIED: ${studentData.full_name} enrolled!`);
            successCount++;
          } else {
            modalDebug(`❌ NOT ENROLLED`, true);
            failCount++;
          }
        } catch (err) {
          modalDebug(`❌ Error: ${err.message}`, true);
          failCount++;
        }
      }

      let summary = `✅ ${successCount} enrolled, ⚠️ ${alreadyEnrolledCount} already, ❌ ${failCount} failed.`;
      setEnrollMessage(summary);
      modalDebug(`📊 ${summary}`);
      
      await fetchAllData();

    } catch (error) {
      modalDebug(`❌ ERROR: ${error.message}`, true);
      setEnrollMessage('❌ ' + error.message);
    }
    
    setEnrollLoading(false);
  };

  // Toggle student selection for enrollment
  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Open edit modal
  const openEditModal = (course) => {
    setEditingCourse(course);
    setEditCourseData({
      courseCode: course.course_code,
      courseName: course.course_name,
      lecturer: course.lecturer || '',
      department: course.department || '',
      level: course.level || '',
      semester: course.semester || '',
      is_active: course.is_active !== undefined ? course.is_active : true,
      attendance_enabled: course.attendance_enabled !== undefined ? course.attendance_enabled : true
    });
    setEditMessage('');
    setShowEditModal(true);
  };

  // Open delete modal
  const openDeleteModal = (course) => {
    setDeletingCourse(course);
    setDeleteMessage('');
    setShowDeleteModal(true);
  };

  // Open course attendance modal
  const openCourseAttendanceModal = async (course) => {
    setSelectedCourseForAttendance(course);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          student:student_id(id, full_name, matric_no)
        `)
        .eq('course_id', course.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setCourseAttendanceData(data || []);
      setShowCourseAttendanceModal(true);
    } catch (error) {
      console.error('Error fetching course attendance:', error);
      alert('Error loading attendance data');
    }
    setLoading(false);
  };

  // Open today's attendance modal
  const openTodayAttendanceModal = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          student:student_id(id, full_name, matric_no),
          course:course_id(id, course_code, course_name)
        `)
        .gte('date', today.toISOString())
        .order('date', { ascending: false });

      if (error) throw error;
      setTodayAttendanceData(data || []);
      setShowTodayAttendanceModal(true);
    } catch (error) {
      console.error('Error fetching today\'s attendance:', error);
      alert('Error loading today\'s attendance data');
    }
    setLoading(false);
  };

  // Export course attendance to CSV
  const exportCourseAttendance = () => {
    if (courseAttendanceData.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = ['Student Name', 'Matric No', 'Date', 'Status'];
    const rows = courseAttendanceData.map(record => [
      record.student?.full_name || 'N/A',
      record.student?.matric_no || 'N/A',
      new Date(record.date).toLocaleString(),
      record.status || 'present'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedCourseForAttendance?.course_code}_attendance_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Export today's attendance to CSV
  const exportTodayAttendance = () => {
    if (todayAttendanceData.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = ['Student Name', 'Matric No', 'Course Code', 'Course Name', 'Status'];
    const rows = todayAttendanceData.map(record => [
      record.student?.full_name || 'N/A',
      record.student?.matric_no || 'N/A',
      record.course?.course_code || 'N/A',
      record.course?.course_name || 'N/A',
      record.status || 'present'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `today_attendance_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Toggle course attendance
  const toggleCourseAttendance = async (courseId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('courses')
        .update({ attendance_enabled: !currentStatus })
        .eq('id', courseId);

      if (error) throw error;
      
      setCourses(courses.map(c => 
        c.id === courseId ? { ...c, attendance_enabled: !currentStatus } : c
      ));
      addDebug(`✅ Course attendance ${!currentStatus ? 'enabled' : 'disabled'}`);
    } catch (error) {
      addDebug(`❌ Error toggling attendance: ${error.message}`, true);
    }
  };

  // Export attendance logs to CSV
  const exportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = ['Student Name', 'Matric No', 'Course Code', 'Course Name', 'Attendance Count'];
    const rows = filteredLogs.map(log => [
      log.student?.full_name || 'N/A',
      log.student?.matric_no || 'N/A',
      log.course?.course_code || 'N/A',
      log.course?.course_name || 'N/A',
      log.count || 0
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_summary_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Get filtered courses for dropdown
  const getFilteredCoursesForDropdown = () => {
    let filtered = courses;
    if (filters.department) {
      filtered = filtered.filter(c => c.department === filters.department);
    }
    if (filters.level) {
      filtered = filtered.filter(c => c.level === filters.level);
    }
    return filtered;
  };

  // Filter courses for search
  const filteredCourses = courses.filter(c => 
    c.course_code.toLowerCase().includes(courseSearch.toLowerCase()) ||
    c.course_name.toLowerCase().includes(courseSearch.toLowerCase())
  );

  // Filter courses for enroll modal
  const filteredCoursesEnroll = courses.filter(c => 
    c.course_code.toLowerCase().includes(courseSearchEnroll.toLowerCase()) ||
    c.course_name.toLowerCase().includes(courseSearchEnroll.toLowerCase())
  );

  // Filter students for enroll modal
  const filteredStudentsEnroll = students.filter(s => 
    s.full_name.toLowerCase().includes(studentSearchEnroll.toLowerCase()) ||
    s.matric_no.toLowerCase().includes(studentSearchEnroll.toLowerCase()) ||
    s.email.toLowerCase().includes(studentSearchEnroll.toLowerCase())
  );

  const courseDropdownOptions = getFilteredCoursesForDropdown();

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  return (
    <Container fluid className="mt-4">
      <div className="animate-fade-in">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>📊 Admin Dashboard</h2>
          <div>
            <span className="badge bg-primary me-2">Admin: {user?.full_name}</span>
          </div>
        </div>

        {/* Academic Session Management */}
        <Card className="mb-4 p-3 shadow-sm" style={{ borderRadius: '12px', background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' }}>
          <Row className="align-items-center">
            <Col md={8}>
              <h6 className="mb-0">📅 Academic Session</h6>
              {currentSession ? (
                <small className="text-muted">
                  Current: <strong>{currentSession.session_name}</strong> 
                  ({new Date(currentSession.start_date).toLocaleDateString()} - {new Date(currentSession.end_date).toLocaleDateString()})
                </small>
              ) : (
                <small className="text-muted">No active session</small>
              )}
            </Col>
            <Col md={4}>
              <div className="d-flex justify-content-end">
                <Button 
                  variant="warning" 
                  onClick={() => {
                    setShowSessionModal(true);
                    setShowWarning(false);
                    setShowConfirmStep(false);
                    setConfirmCode('');
                    setSessionMessage('');
                  }}
                >
                  🔄 Start New Session
                </Button>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Semester Toggle - Saved to Database */}
        <Card className="mb-4 p-3 shadow-sm" style={{ borderRadius: '12px', background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
          <Row className="align-items-center">
            <Col md={6}>
              <h6 className="mb-0">📅 Semester View</h6>
            </Col>
            <Col md={6}>
              <div className="d-flex justify-content-end align-items-center">
                <Form.Check
                  type="switch"
                  id="semester-switch"
                  label={secondSemesterEnabled ? 'Second Semester ON' : 'Second Semester OFF'}
                  checked={secondSemesterEnabled}
                  onChange={handleSemesterToggle}
                  disabled={!semesterLoaded}
                />
              </div>
            </Col>
          </Row>
        </Card>

        {/* Stats Cards */}
        <Row className="mb-4 g-3">
          <Col md={2} sm={4} xs={6}>
            <Card className="text-center p-3 shadow-sm" style={{ borderRadius: '15px', border: 'none', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <h2 className="text-white fw-bold">{stats.totalStudents}</h2>
              <p className="text-white-50 mb-0">👨‍🎓 Students</p>
            </Card>
          </Col>
          <Col md={2} sm={4} xs={6}>
            <Card className="text-center p-3 shadow-sm" style={{ borderRadius: '15px', border: 'none', background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}>
              <h2 className="text-white fw-bold">{stats.totalCourses}</h2>
              <p className="text-white-50 mb-0">📚 Courses</p>
            </Card>
          </Col>
          <Col md={2} sm={4} xs={6}>
            <Card className="text-center p-3 shadow-sm" style={{ borderRadius: '15px', border: 'none', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
              <h2 className="text-white fw-bold">{stats.totalAttendance}</h2>
              <p className="text-white-50 mb-0">📋 Records</p>
            </Card>
          </Col>
          <Col md={2} sm={4} xs={6}>
            <Card className="text-center p-3 shadow-sm" style={{ borderRadius: '15px', border: 'none', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
              <h2 className="text-white fw-bold">{stats.attendanceRate}%</h2>
              <p className="text-white-50 mb-0">📈 Attendance</p>
            </Card>
          </Col>
          <Col md={2} sm={4} xs={6}>
            <Card 
              className="text-center p-3 shadow-sm" 
              style={{ borderRadius: '15px', border: 'none', background: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)', cursor: 'pointer' }}
              onClick={openTodayAttendanceModal}
            >
              <h2 className="text-white fw-bold">{stats.todayAttendance}</h2>
              <p className="text-white-50 mb-0">📅 Today</p>
            </Card>
          </Col>
          <Col md={2} sm={4} xs={6}>
            <Card className="text-center p-3 shadow-sm" style={{ borderRadius: '15px', border: 'none', background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }}>
              <h2 className="text-dark fw-bold">📥</h2>
              <p className="text-muted mb-0">Export</p>
            </Card>
          </Col>
        </Row>

        {/* Course Attendance Stats */}
        <Row className="mb-4">
          <Col md={12}>
            <Card className="p-3 shadow-sm" style={{ borderRadius: '15px' }}>
              <h5 className="mb-3">📊 Course Attendance Details</h5>
              <Row>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>🔍 Select Course</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Search course by code or name..."
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      className="mb-2"
                    />
                    <Form.Select
                      value={selectedCourseId}
                      onChange={handleCourseSelect}
                      style={{ height: 'auto', borderRadius: '8px' }}
                    >
                      <option value="">-- Select a Course --</option>
                      {filteredCourses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.course_code} - {c.course_name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>👨‍🎓 Filter by Student (Optional)</Form.Label>
                    <Form.Select
                      value={selectedStudentId}
                      onChange={handleStudentSelect}
                      disabled={!selectedCourseId}
                      style={{ borderRadius: '8px' }}
                    >
                      <option value="">All Students</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.matric_no})
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              {selectedCourseStats ? (
                <div className="mt-3">
                  <Row className="g-2">
                    <Col md={4}>
                      <Card className="p-2 text-center" style={{ background: '#e3f2fd', borderRadius: '10px' }}>
                        <h6>📚 {selectedCourseStats.courseCode}</h6>
                        <div>{selectedCourseStats.courseName}</div>
                      </Card>
                    </Col>
                    <Col md={2}>
                      <Card className="p-2 text-center" style={{ background: '#e8f5e9', borderRadius: '10px' }}>
                        <h6>📋 Total</h6>
                        <div><strong>{selectedCourseStats.present}</strong> / {selectedCourseStats.total}</div>
                        <Badge bg={selectedCourseStats.percentage >= 75 ? 'success' : 'warning'}>
                          {selectedCourseStats.percentage}%
                        </Badge>
                      </Card>
                    </Col>
                    <Col md={2}>
                      <Card className="p-2 text-center" style={{ background: '#fff3e0', borderRadius: '10px' }}>
                        <h6>📅 Today</h6>
                        <div><strong>{selectedCourseStats.todayPresent}</strong> / {selectedCourseStats.todayTotal}</div>
                        <Badge bg={selectedCourseStats.todayPercentage >= 75 ? 'success' : 'warning'}>
                          {selectedCourseStats.todayPercentage}%
                        </Badge>
                      </Card>
                    </Col>
                    <Col md={4}>
                      <Card className="p-2 text-center" style={{ background: '#f3e5f5', borderRadius: '10px' }}>
                        <h6>👨‍🎓 Students</h6>
                        <div>
                          {selectedCourseStats.students.length > 0 ? (
                            <>
                              <Button 
                                variant="link" 
                                className="p-0 text-decoration-none"
                                onClick={() => {
                                  const course = courses.find(c => c.id === selectedCourseId);
                                  if (course) openCourseAttendanceModal(course);
                                }}
                              >
                                View All ({selectedCourseStats.students.length})
                              </Button>
                            </>
                          ) : 'No students'}
                        </div>
                      </Card>
                    </Col>
                  </Row>
                </div>
              ) : (
                <div className="text-center text-muted mt-3">
                  Select a course to view attendance statistics
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* Tabs */}
        <Tabs defaultActiveKey="attendance" className="mb-4" fill>
          <Tab eventKey="attendance" title="📋 Attendance Logs">
            <Card className="p-3 shadow-sm" style={{ borderRadius: '15px' }}>
              <div className="mb-3">
                <h5>Filter Attendance</h5>
                <Row className="g-2">
                  <Col md={12} className="mb-2">
                    <Form.Group>
                      <Form.Label>🔍 Search</Form.Label>
                      <Form.Control
                        type="text"
                        name="searchQuery"
                        placeholder="Search by student name or matric number..."
                        value={filters.searchQuery}
                        onChange={handleFilterChange}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Department</Form.Label>
                      <Form.Select
                        name="department"
                        value={filters.department}
                        onChange={handleFilterChange}
                      >
                        <option value="">All Departments</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Level</Form.Label>
                      <Form.Select
                        name="level"
                        value={filters.level}
                        onChange={handleFilterChange}
                      >
                        <option value="">All Levels</option>
                        <option value="ND1">ND1</option>
                        <option value="ND2">ND2</option>
                        <option value="HND1">HND1</option>
                        <option value="HND2">HND2</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Course</Form.Label>
                      <Form.Select
                        name="courseId"
                        value={filters.courseId}
                        onChange={handleFilterChange}
                      >
                        <option value="">All Courses</option>
                        {courseDropdownOptions.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.course_code} - {c.course_name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Student</Form.Label>
                      <Form.Select
                        name="studentId"
                        value={filters.studentId}
                        onChange={handleFilterChange}
                      >
                        <option value="">All Students</option>
                        {students.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.full_name} ({s.matric_no})
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={12} className="mt-2">
                    <div className="d-flex gap-2">
                      <Button variant="primary" onClick={applyFilters}>
                        Apply Filters
                      </Button>
                      <Button variant="secondary" onClick={resetFilters}>
                        Reset
                      </Button>
                      <Button variant="success" onClick={exportCSV}>
                        📥 Export Summary CSV
                      </Button>
                    </div>
                  </Col>
                </Row>
              </div>

              <div className="table-container">
                <h6 className="mb-2">Showing {filteredLogs.length} student(s) with attendance</h6>
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Matric No</th>
                      <th>Course</th>
                      <th>Attendance Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center text-muted">
                          No students have marked attendance for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log, index) => (
                        <tr key={index}>
                          <td>{log.student?.full_name || 'N/A'}</td>
                          <td>{log.student?.matric_no || 'N/A'}</td>
                          <td>{log.course?.course_code || 'N/A'}</td>
                          <td>
                            <Badge bg="primary">{log.count || 0}</Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </Card>
          </Tab>

          <Tab eventKey="courses" title="📚 Courses">
            <Card className="p-3 shadow-sm" style={{ borderRadius: '15px' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5>Manage Courses</h5>
                <div>
                  <Button 
                    variant="success" 
                    onClick={() => setShowEnrollModal(true)}
                    className="me-2"
                  >
                    👥 Enroll Students
                  </Button>
                  <Button variant="primary" onClick={() => setShowCourseModal(true)}>
                    ➕ Add New Course
                  </Button>
                </div>
              </div>
              
              <Form.Group className="mb-3">
                <Form.Control
                  type="text"
                  placeholder="🔍 Search courses by code or name..."
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  style={{ borderRadius: '8px' }}
                />
              </Form.Group>

              <div className="table-container">
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Course Code</th>
                      <th>Course Name</th>
                      <th>Lecturer</th>
                      <th>Department</th>
                      <th>Level</th>
                      <th>Semester</th>
                      <th>Status</th>
                      <th>Attendance</th>
                      <th>Enrolled</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourses.filter(c => secondSemesterEnabled ? c.semester === 'Second' : c.semester === 'First').length === 0 ? (
                      <tr>
                        <td colSpan="10" className="text-center text-muted">
                          No courses found for the selected semester.
                        </td>
                      </tr>
                    ) : (
                      filteredCourses.filter(c => secondSemesterEnabled ? c.semester === 'Second' : c.semester === 'First').map((course) => {
                        const enrolledCount = students.filter(s => 
                          s.enrolled_courses?.includes(course.id)
                        ).length;
                        return (
                          <tr key={course.id}>
                            <td><strong>{course.course_code}</strong></td>
                            <td>{course.course_name}</td>
                            <td>{course.lecturer || 'N/A'}</td>
                            <td>{course.department || 'N/A'}</td>
                            <td>{course.level || 'N/A'}</td>
                            <td>{course.semester || 'N/A'}</td>
                            <td>
                              <Badge bg={course.is_active !== false ? 'success' : 'secondary'}>
                                {course.is_active !== false ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                            <td>
                              <Badge 
                                bg={course.attendance_enabled !== false ? 'success' : 'danger'}
                                style={{ cursor: 'pointer' }}
                                onClick={() => toggleCourseAttendance(course.id, course.attendance_enabled !== false)}
                              >
                                {course.attendance_enabled !== false ? 'ON' : 'OFF'}
                              </Badge>
                            </td>
                            <td>
                              <Badge bg="info">
                                {enrolledCount}
                              </Badge>
                            </td>
                            <td>
                              <Button 
                                variant="info" 
                                size="sm" 
                                className="me-1"
                                onClick={() => openCourseAttendanceModal(course)}
                              >
                                📊 View
                              </Button>
                              <Button 
                                variant="warning" 
                                size="sm" 
                                className="me-1"
                                onClick={() => openEditModal(course)}
                              >
                                ✏️ Edit
                              </Button>
                              <Button 
                                variant="danger" 
                                size="sm"
                                onClick={() => openDeleteModal(course)}
                              >
                                🗑️ Delete
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </Table>
              </div>
            </Card>
          </Tab>

          <Tab eventKey="students" title="👨‍🎓 Students">
            <Card className="p-3 shadow-sm" style={{ borderRadius: '15px' }}>
              <h5 className="mb-3">All Students</h5>
              <div className="table-container">
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Matric No</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Gender</th>
                      <th>Level</th>
                      <th>Department</th>
                      <th>Enrolled Courses</th>
                      <th>Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="text-center text-muted">
                          No students registered.
                        </td>
                      </tr>
                    ) : (
                      students.map((student) => (
                        <tr key={student.id}>
                          <td><strong>{student.full_name}</strong></td>
                          <td>{student.matric_no}</td>
                          <td>{student.email}</td>
                          <td>{student.phone || 'N/A'}</td>
                          <td>{student.gender || 'N/A'}</td>
                          <td>{student.level || 'N/A'}</td>
                          <td>{student.department || 'N/A'}</td>
                          <td>
                            <Badge bg="info">
                              {student.enrolled_courses?.length || 0}
                            </Badge>
                          </td>
                          <td>{new Date(student.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </Card>
          </Tab>

          {/* Departments Tab */}
          <Tab eventKey="departments" title="🏛️ Departments">
            <Card className="p-3 shadow-sm" style={{ borderRadius: '15px' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5>Manage Departments</h5>
                <Button variant="primary" onClick={() => setShowDepartmentModal(true)}>
                  ➕ Add Department
                </Button>
              </div>
              <div className="table-container">
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Department Name</th>
                      <th>Created At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center text-muted">
                          No departments found.
                        </td>
                      </tr>
                    ) : (
                      departments.map((dept) => (
                        <tr key={dept.id}>
                          <td><strong>{dept.name}</strong></td>
                          <td>{new Date(dept.created_at).toLocaleDateString()}</td>
                          <td>
                            <Button 
                              variant="danger" 
                              size="sm"
                              onClick={() => handleDeleteDepartment(dept.id)}
                            >
                              🗑️ Delete
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </Card>
          </Tab>
        </Tabs>

        {/* Course Attendance Modal */}
        <Modal show={showCourseAttendanceModal} onHide={() => setShowCourseAttendanceModal(false)} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>
              📊 Course Attendance - {selectedCourseForAttendance?.course_code} ({selectedCourseForAttendance?.course_name})
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="d-flex justify-content-between mb-3">
              <div>
                <strong>Total Attendance Records:</strong> {courseAttendanceData.length}
              </div>
              <Button variant="success" size="sm" onClick={exportCourseAttendance}>
                📥 Export CSV
              </Button>
            </div>
            <div className="table-container">
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Matric No</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {courseAttendanceData.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center text-muted">
                        No attendance records for this course.
                      </td>
                    </tr>
                  ) : (
                    courseAttendanceData.map((record) => (
                      <tr key={record.id}>
                        <td>{record.student?.full_name || 'N/A'}</td>
                        <td>{record.student?.matric_no || 'N/A'}</td>
                        <td>{new Date(record.date).toLocaleString()}</td>
                        <td>
                          <Badge bg={record.status === 'present' ? 'success' : 'danger'}>
                            {record.status === 'present' ? '✅ Present' : '❌ Absent'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCourseAttendanceModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Today's Attendance Modal */}
        <Modal show={showTodayAttendanceModal} onHide={() => setShowTodayAttendanceModal(false)} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>📅 Today's Attendance ({new Date().toLocaleDateString()})</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="d-flex justify-content-between mb-3">
              <div>
                <strong>Total Today:</strong> {todayAttendanceData.length} records
              </div>
              <Button variant="success" size="sm" onClick={exportTodayAttendance}>
                📥 Export CSV
              </Button>
            </div>
            <div className="table-container">
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Matric No</th>
                    <th>Course</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayAttendanceData.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center text-muted">
                        No attendance records for today.
                      </td>
                    </tr>
                  ) : (
                    todayAttendanceData.map((record) => (
                      <tr key={record.id}>
                        <td>{record.student?.full_name || 'N/A'}</td>
                        <td>{record.student?.matric_no || 'N/A'}</td>
                        <td>{record.course?.course_code || 'N/A'}</td>
                        <td>
                          <Badge bg={record.status === 'present' ? 'success' : 'danger'}>
                            {record.status === 'present' ? '✅ Present' : '❌ Absent'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowTodayAttendanceModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Session Rollover Modal */}
        <Modal show={showSessionModal} onHide={() => {
          setShowSessionModal(false);
          setSessionMessage('');
          setNewSessionData({ sessionName: '', startDate: '', endDate: '' });
          setConfirmCode('');
          setShowWarning(false);
          setShowConfirmStep(false);
        }} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>🔄 Start New Academic Session</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {sessionMessage && (
              <Alert variant={sessionMessage.startsWith('✅') ? 'success' : 'danger'}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '14px' }}>{sessionMessage}</pre>
              </Alert>
            )}

            {!showWarning && !showConfirmStep ? (
              // Step 1: Enter Session Details
              <>
                <Form>
                  <Form.Group className="mb-3">
                    <Form.Label>Session Name <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="e.g., 2027/2028 Session"
                      value={newSessionData.sessionName}
                      onChange={(e) => setNewSessionData({ ...newSessionData, sessionName: e.target.value })}
                      disabled={sessionLoading}
                      required
                    />
                  </Form.Group>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Start Date <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                          type="date"
                          value={newSessionData.startDate}
                          onChange={(e) => setNewSessionData({ ...newSessionData, startDate: e.target.value })}
                          disabled={sessionLoading}
                          required
                        />
                        <Form.Text className="text-muted">Typically September 1st</Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>End Date <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                          type="date"
                          value={newSessionData.endDate}
                          onChange={(e) => setNewSessionData({ ...newSessionData, endDate: e.target.value })}
                          disabled={sessionLoading}
                          required
                        />
                        <Form.Text className="text-muted">Typically December 31st</Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                </Form>

                <div className="d-flex justify-content-end gap-2">
                  <Button variant="secondary" onClick={() => {
                    setShowSessionModal(false);
                    setSessionMessage('');
                    setNewSessionData({ sessionName: '', startDate: '', endDate: '' });
                  }} disabled={sessionLoading}>
                    Cancel
                  </Button>
                  <Button 
                    variant="warning" 
                    onClick={() => {
                      if (!newSessionData.sessionName || !newSessionData.startDate || !newSessionData.endDate) {
                        setSessionMessage('❌ Please fill in all fields.');
                        return;
                      }
                      setShowWarning(true);
                    }}
                    disabled={sessionLoading}
                  >
                    Continue →
                  </Button>
                </div>
              </>
            ) : showWarning && !showConfirmStep ? (
              // Step 2: Warning Confirmation
              <>
                <div className="mb-3 p-3 bg-danger text-white rounded" style={{ border: '3px solid #dc3545' }}>
                  <h5 className="text-white">⚠️ WARNING: This Action Cannot Be Undone!</h5>
                </div>
                
                <div className="mb-3 p-3 bg-light rounded">
                  <h6>📋 What will happen:</h6>
                  <ul className="mb-0">
                    <li>✅ <strong>ND1</strong> → <strong>ND2</strong> (promoted)</li>
                    <li>🗑️ <strong>ND2</strong> → <strong>permanently deleted</strong></li>
                    <li>✅ <strong>HND1</strong> → <strong>HND2</strong> (promoted)</li>
                    <li>🗑️ <strong>HND2</strong> → <strong>permanently deleted</strong></li>
                    <li>📅 New session created</li>
                  </ul>
                  <p className="text-danger mt-2 mb-0"><strong>⚠️ This action cannot be undone!</strong></p>
                </div>

                <div className="d-flex justify-content-between">
                  <Button variant="secondary" onClick={() => setShowWarning(false)} disabled={sessionLoading}>
                    ← Go Back
                  </Button>
                  <Button 
                    variant="danger" 
                    onClick={() => setShowConfirmStep(true)}
                    disabled={sessionLoading}
                  >
                    I Understand, Continue →
                  </Button>
                </div>
              </>
            ) : (
              // Step 3: Enter Confirmation Code
              <>
                <div className="mb-3 p-3 bg-warning rounded">
                  <h6>🔐 Confirmation Required</h6>
                  <p className="mb-0">Enter the admin confirmation code.</p>
                </div>

                <Form>
                  <Form.Group className="mb-3">
                    <Form.Label>Confirmation Code <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="Enter admin confirmation code"
                      value={confirmCode}
                      onChange={(e) => setConfirmCode(e.target.value)}
                      disabled={sessionLoading}
                      required
                    />
                  </Form.Group>
                </Form>

                <div className="d-flex justify-content-between">
                  <Button variant="secondary" onClick={() => {
                    setShowConfirmStep(false);
                    setConfirmCode('');
                  }} disabled={sessionLoading}>
                    ← Go Back
                  </Button>
                  <Button 
                    variant="danger" 
                    onClick={handleSessionRollover} 
                    disabled={sessionLoading}
                  >
                    {sessionLoading ? <Spinner size="sm" /> : '🔄 Confirm & Start New Session'}
                  </Button>
                </div>
              </>
            )}
          </Modal.Body>
        </Modal>

        {/* Add Course Modal */}
        <Modal show={showCourseModal} onHide={() => setShowCourseModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>Add New Course</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {modalMessage && (
              <Alert variant={modalMessage.startsWith('✅') ? 'success' : 'danger'}>
                {modalMessage}
              </Alert>
            )}
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Course Code <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g., SWD101"
                  value={newCourse.courseCode}
                  onChange={(e) => setNewCourse({ ...newCourse, courseCode: e.target.value })}
                  disabled={modalLoading}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Course Name <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g., Introduction to Web Development"
                  value={newCourse.courseName}
                  onChange={(e) => setNewCourse({ ...newCourse, courseName: e.target.value })}
                  disabled={modalLoading}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Lecturer</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g., Mr. Nta Lawal"
                  value={newCourse.lecturer}
                  onChange={(e) => setNewCourse({ ...newCourse, lecturer: e.target.value })}
                  disabled={modalLoading}
                />
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Department <span className="text-danger">*</span></Form.Label>
                    <Form.Select
                      value={newCourse.department || ''}
                      onChange={(e) => setNewCourse({ ...newCourse, department: e.target.value })}
                      disabled={modalLoading}
                      required
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Level <span className="text-danger">*</span></Form.Label>
                    <Form.Select
                      value={newCourse.level || ''}
                      onChange={(e) => setNewCourse({ ...newCourse, level: e.target.value })}
                      disabled={modalLoading}
                      required
                    >
                      <option value="">Select Level</option>
                      <option value="ND1">ND1</option>
                      <option value="ND2">ND2</option>
                      <option value="HND1">HND1</option>
                      <option value="HND2">HND2</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Semester <span className="text-danger">*</span></Form.Label>
                <Form.Select
                  value={newCourse.semester || ''}
                  onChange={(e) => setNewCourse({ ...newCourse, semester: e.target.value })}
                  disabled={modalLoading}
                  required
                >
                  <option value="">Select Semester</option>
                  <option value="First">First Semester</option>
                  <option value="Second">Second Semester</option>
                </Form.Select>
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Status</Form.Label>
                    <Form.Select
                      value={newCourse.is_active !== undefined ? newCourse.is_active : true}
                      onChange={(e) => setNewCourse({ ...newCourse, is_active: e.target.value === 'true' })}
                      disabled={modalLoading}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Attendance</Form.Label>
                    <Form.Select
                      value={newCourse.attendance_enabled !== undefined ? newCourse.attendance_enabled : true}
                      onChange={(e) => setNewCourse({ ...newCourse, attendance_enabled: e.target.value === 'true' })}
                      disabled={modalLoading}
                    >
                      <option value="true">ON</option>
                      <option value="false">OFF</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCourseModal(false)} disabled={modalLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddCourse} disabled={modalLoading}>
              {modalLoading ? <Spinner size="sm" /> : 'Add Course'}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Edit Course Modal */}
        <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>✏️ Edit Course</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {editMessage && (
              <Alert variant={editMessage.startsWith('✅') ? 'success' : 'danger'}>
                {editMessage}
              </Alert>
            )}
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Course Code <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g., SWD101"
                  value={editCourseData.courseCode}
                  onChange={(e) => setEditCourseData({ ...editCourseData, courseCode: e.target.value })}
                  disabled={editLoading}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Course Name <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g., Introduction to Web Development"
                  value={editCourseData.courseName}
                  onChange={(e) => setEditCourseData({ ...editCourseData, courseName: e.target.value })}
                  disabled={editLoading}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Lecturer</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g., Mr. Nta Lawal"
                  value={editCourseData.lecturer}
                  onChange={(e) => setEditCourseData({ ...editCourseData, lecturer: e.target.value })}
                  disabled={editLoading}
                />
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Department <span className="text-danger">*</span></Form.Label>
                    <Form.Select
                      value={editCourseData.department || ''}
                      onChange={(e) => setEditCourseData({ ...editCourseData, department: e.target.value })}
                      disabled={editLoading}
                      required
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Level <span className="text-danger">*</span></Form.Label>
                    <Form.Select
                      value={editCourseData.level || ''}
                      onChange={(e) => setEditCourseData({ ...editCourseData, level: e.target.value })}
                      disabled={editLoading}
                      required
                    >
                      <option value="">Select Level</option>
                      <option value="ND1">ND1</option>
                      <option value="ND2">ND2</option>
                      <option value="HND1">HND1</option>
                      <option value="HND2">HND2</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Semester <span className="text-danger">*</span></Form.Label>
                <Form.Select
                  value={editCourseData.semester || ''}
                  onChange={(e) => setEditCourseData({ ...editCourseData, semester: e.target.value })}
                  disabled={editLoading}
                  required
                >
                  <option value="">Select Semester</option>
                  <option value="First">First Semester</option>
                  <option value="Second">Second Semester</option>
                </Form.Select>
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Status</Form.Label>
                    <Form.Select
                      value={editCourseData.is_active !== undefined ? editCourseData.is_active : true}
                      onChange={(e) => setEditCourseData({ ...editCourseData, is_active: e.target.value === 'true' })}
                      disabled={editLoading}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Attendance</Form.Label>
                    <Form.Select
                      value={editCourseData.attendance_enabled !== undefined ? editCourseData.attendance_enabled : true}
                      onChange={(e) => setEditCourseData({ ...editCourseData, attendance_enabled: e.target.value === 'true' })}
                      disabled={editLoading}
                    >
                      <option value="true">ON</option>
                      <option value="false">OFF</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditModal(false)} disabled={editLoading}>
              Cancel
            </Button>
            <Button variant="warning" onClick={handleEditCourse} disabled={editLoading}>
              {editLoading ? <Spinner size="sm" /> : '💾 Save Changes'}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Delete Course Modal */}
        <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>🗑️ Delete Course</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {deleteMessage && (
              <Alert variant={deleteMessage.startsWith('✅') ? 'success' : 'danger'}>
                {deleteMessage}
              </Alert>
            )}
            <div className="text-center">
              <div style={{ fontSize: '48px' }}>⚠️</div>
              <h5>Are you sure you want to delete this course?</h5>
              {deletingCourse && (
                <div className="mt-3">
                  <p><strong>Course:</strong> {deletingCourse.course_code} - {deletingCourse.course_name}</p>
                  <p><strong>Lecturer:</strong> {deletingCourse.lecturer || 'N/A'}</p>
                  <p className="text-danger">
                    ⚠️ This will also remove the course from all students and delete all attendance records!
                  </p>
                  <p className="text-muted small">This action cannot be undone.</p>
                </div>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteCourse} disabled={deleteLoading}>
              {deleteLoading ? <Spinner size="sm" /> : '🗑️ Delete Permanently'}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Add Department Modal */}
        <Modal show={showDepartmentModal} onHide={() => {
          setShowDepartmentModal(false);
          setDepartmentMessage('');
          setNewDepartment('');
        }}>
          <Modal.Header closeButton>
            <Modal.Title>🏛️ Add New Department</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {departmentMessage && (
              <Alert variant={departmentMessage.startsWith('✅') ? 'success' : 'danger'}>
                {departmentMessage}
              </Alert>
            )}
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Department Name</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g., Software Engineering"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  disabled={departmentLoading}
                  required
                />
                <Form.Text className="text-muted">
                  Students will be able to select this department in their profile.
                </Form.Text>
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => {
              setShowDepartmentModal(false);
              setDepartmentMessage('');
              setNewDepartment('');
            }} disabled={departmentLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddDepartment} disabled={departmentLoading}>
              {departmentLoading ? <Spinner size="sm" /> : '✅ Add Department'}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Enroll Students Modal */}
        <Modal show={showEnrollModal} onHide={() => {
          setShowEnrollModal(false);
          setEnrollDebug([]);
        }} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>👥 Enroll Students in Course</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {enrollMessage && (
              <Alert variant={enrollMessage.startsWith('✅') ? 'success' : 'danger'}>
                {enrollMessage}
              </Alert>
            )}

            <Card className="mb-3 p-2" style={{ background: '#f8f9fa', border: '1px solid #007bff' }}>
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0">🔍 Debug Log ({enrollDebug.length} messages)</h6>
                <div>
                  {enrollDebug.length > 0 && (
                    <Button variant="outline-primary" size="sm" className="me-1" onClick={copyDebugLog}>
                      📋 Copy Log
                    </Button>
                  )}
                  <Button variant="outline-danger" size="sm" onClick={clearEnrollDebug}>
                    🗑️ Clear
                  </Button>
                </div>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '11px', fontFamily: 'monospace', marginTop: '5px' }}>
                {enrollDebug.length === 0 ? (
                  <div className="text-muted">Waiting for enrollment...</div>
                ) : (
                  enrollDebug.map((msg, idx) => (
                    <div key={idx} style={{ 
                      color: msg.isError ? '#dc3545' : '#28a745',
                      borderBottom: '1px solid #e9ecef',
                      padding: '2px 0'
                    }}>
                      <span style={{ color: '#6c757d' }}>[{msg.timestamp}]</span> {msg.message}
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Select Course</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Search courses..."
                  value={courseSearchEnroll}
                  onChange={(e) => setCourseSearchEnroll(e.target.value)}
                  className="mb-2"
                />
                <Form.Select
                  value={selectedCourse || ''}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  disabled={enrollLoading}
                  style={{ height: 'auto' }}
                >
                  <option value="">Choose a course...</option>
                  {filteredCoursesEnroll.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.course_code} - {c.course_name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              {selectedCourse && (
                <>
                  <Form.Label>Select Students to Enroll</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Search students by name, matric number, or email..."
                    value={studentSearchEnroll}
                    onChange={(e) => setStudentSearchEnroll(e.target.value)}
                    className="mb-2"
                  />
                  <div className="border rounded p-3" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    {filteredStudentsEnroll.length === 0 ? (
                      <p className="text-muted">No students found matching your search.</p>
                    ) : (
                      filteredStudentsEnroll.map(student => {
                        const isEnrolled = student.enrolled_courses?.includes(selectedCourse);
                        const isSelected = selectedStudents.includes(student.id);
                        return (
                          <Form.Check
                            key={student.id}
                            type="checkbox"
                            id={`student-${student.id}`}
                            label={`${student.full_name} (${student.matric_no}) - ${student.email}`}
                            checked={isSelected}
                            onChange={() => toggleStudentSelection(student.id)}
                            disabled={enrollLoading || isEnrolled}
                            className="mb-2"
                          />
                        );
                      })
                    )}
                  </div>
                  <small className="text-muted mt-2">
                    {selectedStudents.length} student(s) selected for enrollment.
                  </small>
                </>
              )}
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => {
              setShowEnrollModal(false);
              setEnrollDebug([]);
            }} disabled={enrollLoading}>
              Close
            </Button>
            <Button 
              variant="success" 
              onClick={handleEnrollStudents} 
              disabled={enrollLoading || !selectedCourse || selectedStudents.length === 0}
            >
              {enrollLoading ? <Spinner size="sm" /> : '✅ Enroll Students'}
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </Container>
  );
};

export default AdminDashboard;
