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
  
  // Semester toggle
  const [secondSemesterEnabled, setSecondSemesterEnabled] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState('First');
  const [courseSearchTerm, setCourseSearchTerm] = useState('');
  
  // Course attendance stats
  const [selectedCourseStats, setSelectedCourseStats] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  
  // Attendance log filters
  const [attendanceFilters, setAttendanceFilters] = useState({
    department: '',
    level: '',
    semester: '',
    courseId: '',
    studentId: '',
    month: '',
    startDate: '',
    endDate: ''
  });
  
  // Course attendance list
  const [showCourseAttendanceModal, setShowCourseAttendanceModal] = useState(false);
  const [courseAttendanceData, setCourseAttendanceData] = useState([]);
  const [selectedCourseForAttendance, setSelectedCourseForAttendance] = useState(null);
  
  // Debug state
  const [debugMessages, setDebugMessages] = useState([]);
  const [debugError, setDebugError] = useState(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    courseId: '',
    studentId: '',
    month: '',
    week: '',
    startDate: '',
    endDate: '',
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
    can_mark_attendance: true
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
    can_mark_attendance: true
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

  // Fetch semester setting
  const fetchSemesterSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'second_semester_enabled')
        .single();

      if (error) throw error;
      setSecondSemesterEnabled(data?.value === 'true');
    } catch (error) {
      console.error('Error fetching semester setting:', error);
    }
  };

  // Update semester setting
  const updateSemesterSetting = async (enabled) => {
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() })
        .eq('key', 'second_semester_enabled');

      if (error) throw error;
      setSecondSemesterEnabled(enabled);
      addDebug(`✅ Second semester ${enabled ? 'enabled' : 'disabled'}`);
      await fetchAllData();
    } catch (error) {
      console.error('Error updating semester setting:', error);
      addDebug(`❌ Error updating semester: ${error.message}`, true);
    }
  };

  // Toggle course attendance marking
  const toggleCourseAttendance = async (courseId, currentValue) => {
    try {
      const { error } = await supabase
        .from('courses')
        .update({ can_mark_attendance: !currentValue })
        .eq('id', courseId);

      if (error) throw error;
      addDebug(`✅ Course attendance ${!currentValue ? 'enabled' : 'disabled'}`);
      await fetchAllData();
    } catch (error) {
      console.error('Error toggling course attendance:', error);
      addDebug(`❌ Error toggling course: ${error.message}`, true);
    }
  };

  // Fetch course attendance list
  const fetchCourseAttendance = async (courseId) => {
    try {
      const { data, error } = await supabase
        .rpc('get_student_attendance_count', {
          p_course_id: courseId
        });

      if (error) throw error;
      setCourseAttendanceData(data || []);
      
      const course = courses.find(c => c.id === courseId);
      setSelectedCourseForAttendance(course);
      setShowCourseAttendanceModal(true);
    } catch (error) {
      console.error('Error fetching course attendance:', error);
      alert('❌ Error fetching attendance data');
    }
  };

  // Export course attendance to CSV
  const exportCourseAttendanceCSV = () => {
    if (courseAttendanceData.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = ['Full Name', 'Matric Number', 'Attendance Count'];
    const rows = courseAttendanceData.map(item => [
      item.full_name,
      item.matric_no,
      item.attendance_count
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
    fetchSemesterSetting();
    fetchAllData();
    fetchDepartments();
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
      // Fetch students
      const { data: studentsData, error: studentsError } = await supabase
        .from('users')
        .select('id, full_name, matric_no, email, phone, created_at, enrolled_courses, role, gender, level, department')
        .eq('role', 'student')
        .order('full_name');

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      // Fetch courses - filter by semester if second semester is disabled
      let query = supabase
        .from('courses')
        .select('*')
        .order('course_code');

      if (!secondSemesterEnabled) {
        query = query.eq('semester', 'First');
      }

      const { data: coursesData, error: coursesError } = await query;

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      // Fetch all attendance logs
      const logs = await fetchAttendanceLogs();
      
      // Calculate stats
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

  // Fetch attendance logs with advanced filters
  const fetchAttendanceLogs = async (filterObj = {}) => {
    try {
      let query = supabase
        .from('attendance')
        .select(`
          *,
          student:student_id(id, full_name, matric_no, department, level),
          course:course_id(id, course_code, course_name, department, level, semester)
        `)
        .order('date', { ascending: false });

      if (filterObj.courseId) query = query.eq('course_id', filterObj.courseId);
      if (filterObj.studentId) query = query.eq('student_id', filterObj.studentId);
      
      // Department filter - filter through student data
      if (filterObj.department) {
        // We'll filter client-side for department
      }
      if (filterObj.level) {
        // We'll filter client-side for level
      }
      if (filterObj.semester) {
        // We'll filter client-side for semester
      }
      
      if (filterObj.month) {
        const start = new Date(filterObj.month + '-01');
        const end = new Date(filterObj.month + '-01');
        end.setMonth(end.getMonth() + 1);
        query = query.gte('date', start.toISOString()).lt('date', end.toISOString());
      }
      if (filterObj.startDate && filterObj.endDate) {
        query = query
          .gte('date', new Date(filterObj.startDate).toISOString())
          .lte('date', new Date(filterObj.endDate).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Apply client-side filters for department, level, semester
      let filtered = data || [];
      
      if (filterObj.department) {
        filtered = filtered.filter(log => log.student?.department === filterObj.department);
      }
      if (filterObj.level) {
        filtered = filtered.filter(log => log.student?.level === filterObj.level);
      }
      if (filterObj.semester) {
        filtered = filtered.filter(log => log.course?.semester === filterObj.semester);
      }
      
      return filtered;

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

  // Handle attendance filter changes
  const handleAttendanceFilterChange = (e) => {
    const { name, value } = e.target;
    setAttendanceFilters({ ...attendanceFilters, [name]: value });
  };

  // Apply attendance filters
  const applyAttendanceFilters = async () => {
    const activeFilters = {};
    if (attendanceFilters.department) activeFilters.department = attendanceFilters.department;
    if (attendanceFilters.level) activeFilters.level = attendanceFilters.level;
    if (attendanceFilters.semester) activeFilters.semester = attendanceFilters.semester;
    if (attendanceFilters.courseId) activeFilters.courseId = attendanceFilters.courseId;
    if (attendanceFilters.studentId) activeFilters.studentId = attendanceFilters.studentId;
    if (attendanceFilters.month) activeFilters.month = attendanceFilters.month;
    if (attendanceFilters.startDate && attendanceFilters.endDate) {
      activeFilters.startDate = attendanceFilters.startDate;
      activeFilters.endDate = attendanceFilters.endDate;
    }

    const logs = await fetchAttendanceLogs(activeFilters);
    setFilteredLogs(logs || []);
  };

  // Reset attendance filters
  const resetAttendanceFilters = async () => {
    setAttendanceFilters({
      department: '',
      level: '',
      semester: '',
      courseId: '',
      studentId: '',
      month: '',
      startDate: '',
      endDate: ''
    });
    const logs = await fetchAttendanceLogs({});
    setFilteredLogs(logs || []);
  };

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
  };

  // Apply filters with search
  const applyFilters = async () => {
    const activeFilters = {};
    if (filters.courseId) activeFilters.courseId = filters.courseId;
    if (filters.studentId) activeFilters.studentId = filters.studentId;
    if (filters.month) activeFilters.month = filters.month;
    if (filters.week) activeFilters.week = filters.week;
    if (filters.startDate && filters.endDate) {
      activeFilters.startDate = filters.startDate;
      activeFilters.endDate = filters.endDate;
    }

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
    
    setFilteredLogs(logs || []);
  };

  // Reset filters
  const resetFilters = async () => {
    setFilters({
      courseId: '',
      studentId: '',
      month: '',
      week: '',
      startDate: '',
      endDate: '',
      searchQuery: ''
    });
    const logs = await fetchAttendanceLogs({});
    setFilteredLogs(logs || []);
  };

  // Handle adding new course
  const handleAddCourse = async () => {
    setModalLoading(true);
    setModalMessage('');

    // Validate required fields
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
          can_mark_attendance: newCourse.can_mark_attendance !== undefined ? newCourse.can_mark_attendance : true
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
        can_mark_attendance: true
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
          can_mark_attendance: editCourseData.can_mark_attendance !== undefined ? editCourseData.can_mark_attendance : true
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
      can_mark_attendance: course.can_mark_attendance !== undefined ? course.can_mark_attendance : true
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

  // Export attendance logs to CSV
  const exportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = ['Student Name', 'Matric No', 'Department', 'Level', 'Course', 'Date', 'Status'];
    const rows = filteredLogs.map(log => [
      log.student?.full_name || 'N/A',
      log.student?.matric_no || 'N/A',
      log.student?.department || 'N/A',
      log.student?.level || 'N/A',
      log.course?.course_code || 'N/A',
      new Date(log.date).toLocaleString(),
      log.status || 'present'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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

  // Split courses by semester
  const firstSemesterCourses = courses.filter(c => c.semester === 'First' || !c.semester);
  const secondSemesterCourses = courses.filter(c => c.semester === 'Second');

  // Filter courses by search term
  const filterCoursesBySearch = (courseList) => {
    if (!courseSearchTerm) return courseList;
    return courseList.filter(c => 
      c.course_code.toLowerCase().includes(courseSearchTerm.toLowerCase()) ||
      c.course_name.toLowerCase().includes(courseSearchTerm.toLowerCase()) ||
      c.department?.toLowerCase().includes(courseSearchTerm.toLowerCase())
    );
  };

  // Get unique departments for filter
  const uniqueDepartments = [...new Set(students.map(s => s.department).filter(Boolean))];
  const uniqueLevels = ['ND1', 'ND2', 'HND1', 'HND2'];
  const uniqueSemesters = ['First', 'Second'];

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

        {/* Debug Panel */}
        <Card className="mb-4 p-3" style={{ background: '#f8f9fa', border: debugError ? '2px solid red' : '2px solid #007bff' }}>
          <h6 className="mb-2">🔍 Debug Log ({debugMessages.length} messages)</h6>
          <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '11px', fontFamily: 'monospace' }}>
            {debugMessages.length === 0 ? (
              <div className="text-muted">Waiting for data...</div>
            ) : (
              debugMessages.slice(-15).map((msg, idx) => (
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
          <div className="mt-2 d-flex gap-2">
            <Button variant="outline-secondary" size="sm" onClick={() => { setDebugMessages([]); setDebugError(null); fetchAllData(); }}>
              🔄 Refresh All Data
            </Button>
            <Button variant="outline-danger" size="sm" onClick={() => { setDebugMessages([]); setDebugError(null); }}>
              🗑️ Clear Logs
            </Button>
          </div>
        </Card>

        {/* Semester Toggle - Global */}
        <Card className="mb-4 p-3" style={{ background: '#f0f8ff', border: '2px solid #007bff' }}>
          <Row className="align-items-center">
            <Col md={6}>
              <h5 className="mb-0">📅 Second Semester Access</h5>
              <small className="text-muted">Toggle to show/hide Second Semester courses everywhere</small>
            </Col>
            <Col md={6} className="text-end">
              <Button 
                variant={secondSemesterEnabled ? 'success' : 'secondary'}
                onClick={() => updateSemesterSetting(!secondSemesterEnabled)}
                className="px-4"
              >
                {secondSemesterEnabled ? '✅ Second Semester ON' : '❌ Second Semester OFF'}
              </Button>
            </Col>
          </Row>
        </Card>

        {/* Statistics Cards */}
        <Row className="mb-4">
          <Col md={2}>
            <Card className="stat-card">
              <h2>{stats.totalStudents}</h2>
              <p>👨‍🎓 Total Students</p>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}>
              <h2>{stats.totalCourses}</h2>
              <p>📚 Total Courses</p>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
              <h2>{stats.totalAttendance}</h2>
              <p>📋 Total Records</p>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
              <h2>{stats.attendanceRate}%</h2>
              <p>📈 Overall Rate</p>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)' }}>
              <h2>{stats.todayAttendance}</h2>
              <p>📅 Today Present</p>
            </Card>
          </Col>
        </Row>

        {/* Course Attendance Stats */}
        <Row className="mb-4">
          <Col md={12}>
            <Card className="p-3">
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
                      style={{ height: 'auto' }}
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
                  <Row>
                    <Col md={4}>
                      <Card className="p-2 text-center" style={{ background: '#e3f2fd' }}>
                        <h6>📚 {selectedCourseStats.courseCode}</h6>
                        <div>{selectedCourseStats.courseName}</div>
                      </Card>
                    </Col>
                    <Col md={2}>
                      <Card className="p-2 text-center" style={{ background: '#e8f5e9' }}>
                        <h6>📋 Total</h6>
                        <div><strong>{selectedCourseStats.present}</strong> / {selectedCourseStats.total}</div>
                        <Badge bg={selectedCourseStats.percentage >= 75 ? 'success' : 'warning'}>
                          {selectedCourseStats.percentage}%
                        </Badge>
                      </Card>
                    </Col>
                    <Col md={2}>
                      <Card className="p-2 text-center" style={{ background: '#fff3e0' }}>
                        <h6>📅 Today</h6>
                        <div><strong>{selectedCourseStats.todayPresent}</strong> / {selectedCourseStats.todayTotal}</div>
                        <Badge bg={selectedCourseStats.todayPercentage >= 75 ? 'success' : 'warning'}>
                          {selectedCourseStats.todayPercentage}%
                        </Badge>
                      </Card>
                    </Col>
                    <Col md={4}>
                      <Card className="p-2 text-center" style={{ background: '#f3e5f5' }}>
                        <h6>👨‍🎓 Students</h6>
                        <div>
                          {selectedCourseStats.students.length > 0 ? (
                            selectedCourseStats.students.slice(0, 3).join(', ') + 
                            (selectedCourseStats.students.length > 3 ? ` +${selectedCourseStats.students.length - 3} more` : '')
                          ) : 'No students'}
                        </div>
                        <Button 
                          variant="outline-primary" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => fetchCourseAttendance(selectedCourseId)}
                        >
                          📋 View All Students
                        </Button>
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
            <Card className="p-3 shadow">
              <div className="mb-3">
                <h5>Filter Attendance Logs</h5>
                <Row className="g-2">
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Department</Form.Label>
                      <Form.Select
                        name="department"
                        value={attendanceFilters.department}
                        onChange={handleAttendanceFilterChange}
                      >
                        <option value="">All Departments</option>
                        {uniqueDepartments.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Level</Form.Label>
                      <Form.Select
                        name="level"
                        value={attendanceFilters.level}
                        onChange={handleAttendanceFilterChange}
                      >
                        <option value="">All Levels</option>
                        {uniqueLevels.map(level => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Semester</Form.Label>
                      <Form.Select
                        name="semester"
                        value={attendanceFilters.semester}
                        onChange={handleAttendanceFilterChange}
                      >
                        <option value="">All Semesters</option>
                        {uniqueSemesters.map(sem => (
                          <option key={sem} value={sem}>{sem} Semester</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Course</Form.Label>
                      <Form.Select
                        name="courseId"
                        value={attendanceFilters.courseId}
                        onChange={handleAttendanceFilterChange}
                      >
                        <option value="">All Courses</option>
                        {courses.map(c => (
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
                        value={attendanceFilters.studentId}
                        onChange={handleAttendanceFilterChange}
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
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Month</Form.Label>
                      <Form.Control
                        type="month"
                        name="month"
                        value={attendanceFilters.month}
                        onChange={handleAttendanceFilterChange}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Start Date</Form.Label>
                      <Form.Control
                        type="date"
                        name="startDate"
                        value={attendanceFilters.startDate}
                        onChange={handleAttendanceFilterChange}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>End Date</Form.Label>
                      <Form.Control
                        type="date"
                        name="endDate"
                        value={attendanceFilters.endDate}
                        onChange={handleAttendanceFilterChange}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={12} className="mt-2">
                    <div className="d-flex gap-2">
                      <Button variant="primary" onClick={applyAttendanceFilters}>
                        Apply Filters
                      </Button>
                      <Button variant="secondary" onClick={resetAttendanceFilters}>
                        Reset
                      </Button>
                      <Button variant="success" onClick={exportCSV}>
                        📥 Export CSV
                      </Button>
                    </div>
                  </Col>
                </Row>
              </div>

              <div className="table-container">
                <h6 className="mb-2">Showing {filteredLogs.length} record(s)</h6>
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Matric No</th>
                      <th>Department</th>
                      <th>Level</th>
                      <th>Course</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center text-muted">
                          No attendance records found.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{log.student?.full_name || 'N/A'}</td>
                          <td>{log.student?.matric_no || 'N/A'}</td>
                          <td>{log.student?.department || 'N/A'}</td>
                          <td>{log.student?.level || 'N/A'}</td>
                          <td>{log.course?.course_code || 'N/A'}</td>
                          <td>{new Date(log.date).toLocaleString()}</td>
                          <td>
                            <Badge 
                              bg={log.status === 'present' ? 'success' : 'danger'}
                              className="px-3 py-2"
                            >
                              {log.status === 'present' ? '✅ Present' : '❌ Absent'}
                            </Badge>
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
            <Card className="p-3 shadow">
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

              {/* Semester Toggle for Courses */}
              <div className="mb-3">
                <Button.Group>
                  <Button 
                    variant={selectedSemester === 'First' ? 'primary' : 'outline-secondary'}
                    onClick={() => setSelectedSemester('First')}
                  >
                    📖 First Semester
                  </Button>
                  <Button 
                    variant={selectedSemester === 'Second' ? 'primary' : 'outline-secondary'}
                    onClick={() => setSelectedSemester('Second')}
                    disabled={!secondSemesterEnabled}
                  >
                    📖 Second Semester {!secondSemesterEnabled && '🔒'}
                  </Button>
                </Button.Group>
              </div>

              {/* Search Bar */}
              <Form.Group className="mb-3">
                <Form.Control
                  type="text"
                  placeholder="🔍 Search courses by code, name, or department..."
                  value={courseSearchTerm}
                  onChange={(e) => setCourseSearchTerm(e.target.value)}
                />
              </Form.Group>

              {/* First Semester Courses */}
              {selectedSemester === 'First' && (
                <>
                  <h6 className="mt-3 text-primary">📖 First Semester Courses</h6>
                  <div className="table-container">
                    <CourseTable 
                      courses={filterCoursesBySearch(firstSemesterCourses)}
                      students={students}
                      onEdit={openEditModal}
                      onDelete={openDeleteModal}
                      onToggleAttendance={toggleCourseAttendance}
                    />
                  </div>
                </>
              )}

              {/* Second Semester Courses */}
              {selectedSemester === 'Second' && secondSemesterEnabled && (
                <>
                  <h6 className="mt-3 text-success">📖 Second Semester Courses</h6>
                  <div className="table-container">
                    <CourseTable 
                      courses={filterCoursesBySearch(secondSemesterCourses)}
                      students={students}
                      onEdit={openEditModal}
                      onDelete={openDeleteModal}
                      onToggleAttendance={toggleCourseAttendance}
                    />
                  </div>
                </>
              )}

              {selectedSemester === 'Second' && !secondSemesterEnabled && (
                <Alert variant="warning">
                  ⚠️ Second Semester is currently <strong>disabled</strong>. 
                  Enable it using the toggle at the top of the page.
                </Alert>
              )}
            </Card>
          </Tab>

          <Tab eventKey="students" title="👨‍🎓 Students">
            <Card className="p-3 shadow">
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
            <Card className="p-3 shadow">
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

        {/* Course Table Component */}
        {(() => {
          // This is a helper component to avoid duplicate table code
          const CourseTable = ({ courses, students, onEdit, onDelete, onToggleAttendance }) => {
            if (courses.length === 0) {
              return <p className="text-muted text-center py-3">No courses found in this semester.</p>;
            }
            return (
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
                    <th>Mark Attendance</th>
                    <th>Enrolled</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => {
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
                          <Button 
                            variant={course.can_mark_attendance !== false ? 'success' : 'danger'}
                            size="sm"
                            onClick={() => onToggleAttendance(course.id, course.can_mark_attendance !== false)}
                          >
                            {course.can_mark_attendance !== false ? '✅ ON' : '❌ OFF'}
                          </Button>
                        </td>
                        <td>
                          <Badge bg="info">
                            {enrolledCount}
                          </Badge>
                        </td>
                        <td>
                          <Button 
                            variant="warning" 
                            size="sm" 
                            className="me-1"
                            onClick={() => onEdit(course)}
                          >
                            ✏️ Edit
                          </Button>
                          <Button 
                            variant="danger" 
                            size="sm"
                            onClick={() => onDelete(course)}
                          >
                            🗑️ Delete
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            );
          };
          // This is where the CourseTable would render, but since it's inside a function, we need to render it properly
          // The actual rendering is done in the courses tab above
          return null;
        })()}

        {/* Modals - Add Course */}
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
                <Form.Text className="text-muted">
                  Inactive courses won't be auto-enrolled to new students
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Allow Attendance Marking</Form.Label>
                <Form.Select
                  value={newCourse.can_mark_attendance !== undefined ? newCourse.can_mark_attendance : true}
                  onChange={(e) => setNewCourse({ ...newCourse, can_mark_attendance: e.target.value === 'true' })}
                  disabled={modalLoading}
                >
                  <option value="true">✅ ON - Students can mark</option>
                  <option value="false">❌ OFF - Students cannot mark</option>
                </Form.Select>
                <Form.Text className="text-muted">
                  Toggle whether students can mark attendance for this course
                </Form.Text>
              </Form.Group>
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
                <Form.Text className="text-muted">
                  Inactive courses won't be auto-enrolled to new students
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Allow Attendance Marking</Form.Label>
                <Form.Select
                  value={editCourseData.can_mark_attendance !== undefined ? editCourseData.can_mark_attendance : true}
                  onChange={(e) => setEditCourseData({ ...editCourseData, can_mark_attendance: e.target.value === 'true' })}
                  disabled={editLoading}
                >
                  <option value="true">✅ ON - Students can mark</option>
                  <option value="false">❌ OFF - Students cannot mark</option>
                </Form.Select>
                <Form.Text className="text-muted">
                  Toggle whether students can mark attendance for this course
                </Form.Text>
              </Form.Group>
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

        {/* Course Attendance List Modal */}
        <Modal 
          show={showCourseAttendanceModal} 
          onHide={() => setShowCourseAttendanceModal(false)} 
          size="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>
              📋 Attendance List: {selectedCourseForAttendance?.course_code} - {selectedCourseForAttendance?.course_name}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <Badge bg="info" className="me-2">
                  Total Students: {courseAttendanceData.length}
                </Badge>
                <Badge bg="success">
                  Total Presents: {courseAttendanceData.reduce((sum, item) => sum + (item.attendance_count || 0), 0)}
                </Badge>
              </div>
              <Button variant="success" size="sm" onClick={exportCourseAttendanceCSV}>
                📥 Export CSV
              </Button>
            </div>
            <div className="table-container">
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Full Name</th>
                    <th>Matric Number</th>
                    <th>Attendance Count</th>
                  </tr>
                </thead>
                <tbody>
                  {courseAttendanceData.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center text-muted">
                        No students have marked attendance for this course.
                      </td>
                    </tr>
                  ) : (
                    courseAttendanceData.map((item, index) => (
                      <tr key={item.student_id}>
                        <td>{index + 1}</td>
                        <td><strong>{item.full_name}</strong></td>
                        <td>{item.matric_no}</td>
                        <td>
                          <Badge bg="primary" className="px-3 py-2">
                            {item.attendance_count} {item.attendance_count === 1 ? 'day' : 'days'}
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

            {/* Debug inside modal */}
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
