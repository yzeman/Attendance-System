import React, { useState, useEffect } from 'react';
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
    lecturer: ''
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // Enroll Modal states
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollMessage, setEnrollMessage] = useState('');
  
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

  // Load all data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

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
        .select('id, full_name, matric_no, email, phone, created_at, enrolled_courses, role')
        .eq('role', 'student')
        .order('full_name');

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      // Fetch courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .order('course_code');

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

  // Fetch attendance logs with optional filters
  const fetchAttendanceLogs = async (filterObj = {}) => {
    try {
      let query = supabase
        .from('attendance')
        .select(`
          *,
          student:student_id(id, full_name, matric_no),
          course:course_id(id, course_code, course_name)
        `)
        .order('date', { ascending: false });

      if (filterObj.courseId) query = query.eq('course_id', filterObj.courseId);
      if (filterObj.studentId) query = query.eq('student_id', filterObj.studentId);
      if (filterObj.month) {
        const start = new Date(filterObj.month + '-01');
        const end = new Date(filterObj.month + '-01');
        end.setMonth(end.getMonth() + 1);
        query = query.gte('date', start.toISOString()).lt('date', end.toISOString());
      }
      if (filterObj.week) {
        const [year, weekNum] = filterObj.week.split('-').map(Number);
        const start = getStartOfWeek(year, weekNum);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        query = query.gte('date', start.toISOString()).lt('date', end.toISOString());
      }
      if (filterObj.startDate && filterObj.endDate) {
        query = query
          .gte('date', new Date(filterObj.startDate).toISOString())
          .lte('date', new Date(filterObj.endDate).toISOString());
      }

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

    try {
      const { error } = await supabase
        .from('courses')
        .insert({
          course_code: newCourse.courseCode.toUpperCase(),
          course_name: newCourse.courseName,
          lecturer: newCourse.lecturer
        });

      if (error) throw error;

      setModalMessage('✅ Course added successfully!');
      setNewCourse({ courseCode: '', courseName: '', lecturer: '' });
      
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .order('course_code');
      setCourses(coursesData || []);

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

  // ✅ ENHANCED: Handle Enroll Students with FULL Debugging
  const handleEnrollStudents = async () => {
    if (!selectedCourse || selectedStudents.length === 0) {
      setEnrollMessage('Please select a course and at least one student.');
      return;
    }

    setEnrollLoading(true);
    setEnrollMessage('');
    addDebug(`🔵 Enrolling ${selectedStudents.length} student(s) in course: ${selectedCourse}`);
    addDebug(`📋 Selected Course ID: ${selectedCourse}`);
    
    // Find course name
    const course = courses.find(c => c.id === selectedCourse);
    addDebug(`📋 Course: ${course?.course_code} - ${course?.course_name}`);

    try {
      let successCount = 0;
      let failCount = 0;
      let alreadyEnrolledCount = 0;
      let errorDetails = [];
      
      for (let studentId of selectedStudents) {
        addDebug(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        addDebug(`🔵 Processing student: ${studentId}`);
        
        try {
          // Step 1: Get current enrolled courses
          addDebug(`📤 Fetching current enrollment for student...`);
          const { data: studentData, error: fetchError } = await supabase
            .from('users')
            .select('id, full_name, email, enrolled_courses')
            .eq('id', studentId)
            .single();

          if (fetchError) {
            addDebug(`❌ Fetch error for ${studentId}: ${fetchError.message}`, true);
            addDebug(`❌ Error code: ${fetchError.code}`, true);
            addDebug(`❌ Error details: ${fetchError.details || 'No details'}`, true);
            failCount++;
            errorDetails.push({ studentId, error: fetchError });
            continue;
          }

          const studentName = studentData?.full_name || 'Unknown';
          const currentCourses = studentData?.enrolled_courses || [];
          addDebug(`📋 ${studentName} - Current courses: ${currentCourses.length}`);
          addDebug(`📋 Course IDs: ${JSON.stringify(currentCourses)}`);

          // Step 2: Check if already enrolled
          if (currentCourses.includes(selectedCourse)) {
            addDebug(`⚠️ ${studentName} already enrolled in this course`);
            alreadyEnrolledCount++;
            continue;
          }

          // Step 3: Add new course
          const updatedCourses = [...currentCourses, selectedCourse];
          addDebug(`📤 Updating to: ${updatedCourses.length} courses`);
          addDebug(`📤 New course IDs: ${JSON.stringify(updatedCourses)}`);

          // Step 4: Update database with FULL error handling
          const { data: updateData, error: updateError } = await supabase
            .from('users')
            .update({ 
              enrolled_courses: updatedCourses 
            })
            .eq('id', studentId)
            .select();

          if (updateError) {
            addDebug(`❌ Update error for ${studentId}: ${updateError.message}`, true);
            addDebug(`❌ Error code: ${updateError.code}`, true);
            addDebug(`❌ Error details: ${updateError.details || 'No details'}`, true);
            addDebug(`❌ Error hint: ${updateError.hint || 'No hint'}`, true);
            failCount++;
            errorDetails.push({ studentId, error: updateError });
            continue;
          }

          // Step 5: VERIFY the update worked
          addDebug(`🔍 Verifying enrollment for ${studentName}...`);
          const { data: verifyData, error: verifyError } = await supabase
            .from('users')
            .select('enrolled_courses')
            .eq('id', studentId)
            .single();

          if (verifyError) {
            addDebug(`⚠️ Verification failed: ${verifyError.message}`, true);
            failCount++;
            errorDetails.push({ studentId, error: verifyError });
          } else {
            const verifiedCourses = verifyData?.enrolled_courses || [];
            addDebug(`📋 Verified courses: ${JSON.stringify(verifiedCourses)}`);
            if (verifiedCourses.includes(selectedCourse)) {
              addDebug(`✅ VERIFIED: ${studentName} successfully enrolled!`);
              successCount++;
            } else {
              addDebug(`❌ VERIFICATION FAILED: ${studentName} not enrolled!`, true);
              addDebug(`❌ Expected: ${selectedCourse}, Got: ${JSON.stringify(verifiedCourses)}`, true);
              failCount++;
              errorDetails.push({ studentId, error: { message: 'Verification failed - course not in array' } });
            }
          }
        } catch (err) {
          addDebug(`❌ Unexpected error for ${studentId}: ${err.message}`, true);
          addDebug(`❌ Stack: ${err.stack}`, true);
          failCount++;
          errorDetails.push({ studentId, error: err });
        }
      }

      // Show summary message with details
      let summaryMessage = '';
      if (successCount > 0) summaryMessage += `✅ ${successCount} student(s) enrolled successfully! `;
      if (alreadyEnrolledCount > 0) summaryMessage += `⚠️ ${alreadyEnrolledCount} student(s) already enrolled. `;
      if (failCount > 0) {
        summaryMessage += `❌ ${failCount} student(s) failed to enroll.`;
        addDebug(`❌ Error details: ${JSON.stringify(errorDetails)}`, true);
      }
      
      if (successCount === 0 && failCount === 0 && alreadyEnrolledCount > 0) {
        summaryMessage = `⚠️ All ${alreadyEnrolledCount} student(s) were already enrolled.`;
      } else if (successCount === 0 && failCount > 0) {
        summaryMessage = `❌ All ${failCount} student(s) failed to enroll. Check debug log for details.`;
      }
      
      setEnrollMessage(summaryMessage);
      addDebug(`📊 Summary: ${summaryMessage}`);
      
      // Refresh data to show updated enrollment counts
      await fetchAllData();
      
      // Clear selections after delay
      setTimeout(() => {
        setShowEnrollModal(false);
        setEnrollMessage('');
        setSelectedStudents([]);
        setSelectedCourse(null);
        setEnrollLoading(false);
      }, 3000);

    } catch (error) {
      addDebug(`❌ Enrollment error: ${error.message}`, true);
      addDebug(`❌ Stack: ${error.stack}`, true);
      setEnrollMessage('❌ ' + error.message);
      setEnrollLoading(false);
    }
  };

  // Toggle student selection for enrollment
  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Export attendance logs to CSV
  const exportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = ['Student Name', 'Matric No', 'Course Code', 'Course Name', 'Date', 'Status'];
    const rows = filteredLogs.map(log => [
      log.student?.full_name || 'N/A',
      log.student?.matric_no || 'N/A',
      log.course?.course_code || 'N/A',
      log.course?.course_name || 'N/A',
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

        {/* Debug Panel - Enhanced */}
        <Card className="mb-4 p-3" style={{ background: '#f8f9fa', border: debugError ? '2px solid red' : '2px solid #007bff' }}>
          <h6 className="mb-2">🔍 Debug Log ({debugMessages.length} messages)</h6>
          <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '11px', fontFamily: 'monospace' }}>
            {debugMessages.length === 0 ? (
              <div className="text-muted">Waiting for data...</div>
            ) : (
              debugMessages.slice(-20).map((msg, idx) => (
                <div key={idx} style={{ 
                  color: msg.isError ? '#dc3545' : '#28a745',
                  borderBottom: '1px solid #e9ecef',
                  padding: '3px 0'
                }}>
                  <span style={{ color: '#6c757d' }}>[{msg.timestamp}]</span> {msg.message}
                </div>
              ))
            )}
          </div>
          {debugError && (
            <Alert variant="danger" className="mt-2 mb-0">
              ❌ Error: {debugError}
            </Alert>
          )}
          <div className="mt-2 d-flex gap-2">
            <Button 
              variant="outline-secondary" 
              size="sm"
              onClick={() => {
                setDebugMessages([]);
                setDebugError(null);
                fetchAllData();
              }}
            >
              🔄 Refresh All Data
            </Button>
            <Button 
              variant="outline-danger" 
              size="sm"
              onClick={() => {
                setDebugMessages([]);
                setDebugError(null);
              }}
            >
              🗑️ Clear Logs
            </Button>
          </div>
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
                <h5>Filter Attendance</h5>
                <Row className="g-2">
                  <Col md={12} className="mb-2">
                    <Form.Group>
                      <Form.Label>🔍 Search</Form.Label>
                      <Form.Control
                        type="text"
                        name="searchQuery"
                        placeholder="Search by student name, matric number, or course code..."
                        value={filters.searchQuery}
                        onChange={handleFilterChange}
                      />
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
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label>Month</Form.Label>
                      <Form.Control
                        type="month"
                        name="month"
                        value={filters.month}
                        onChange={handleFilterChange}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label>Week (YYYY-WW)</Form.Label>
                      <Form.Control
                        type="text"
                        name="week"
                        placeholder="2025-12"
                        value={filters.week}
                        onChange={handleFilterChange}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={12} className="mt-2">
                    <Row>
                      <Col md={3}>
                        <Form.Group>
                          <Form.Label>Start Date</Form.Label>
                          <Form.Control
                            type="date"
                            name="startDate"
                            value={filters.startDate}
                            onChange={handleFilterChange}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group>
                          <Form.Label>End Date</Form.Label>
                          <Form.Control
                            type="date"
                            name="endDate"
                            value={filters.endDate}
                            onChange={handleFilterChange}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6} className="d-flex align-items-end gap-2">
                        <Button variant="primary" onClick={applyFilters}>
                          Apply Filters
                        </Button>
                        <Button variant="secondary" onClick={resetFilters}>
                          Reset
                        </Button>
                        <Button variant="success" onClick={exportCSV}>
                          📥 Export CSV
                        </Button>
                      </Col>
                    </Row>
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
                      <th>Course</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center text-muted">
                          No attendance records found.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{log.student?.full_name || 'N/A'}</td>
                          <td>{log.student?.matric_no || 'N/A'}</td>
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
              <div className="table-container">
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Course Code</th>
                      <th>Course Name</th>
                      <th>Lecturer</th>
                      <th>Enrolled Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center text-muted">
                          No courses found.
                        </td>
                      </tr>
                    ) : (
                      courses.map((course) => {
                        const enrolledCount = students.filter(s => 
                          s.enrolled_courses?.includes(course.id)
                        ).length;
                        return (
                          <tr key={course.id}>
                            <td><strong>{course.course_code}</strong></td>
                            <td>{course.course_name}</td>
                            <td>{course.lecturer || 'N/A'}</td>
                            <td>
                              <Badge bg="info">
                                {enrolledCount}
                              </Badge>
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
                      <th>Enrolled Courses</th>
                      <th>Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted">
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
        </Tabs>

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
                <Form.Label>Course Code</Form.Label>
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
                <Form.Label>Course Name</Form.Label>
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

        {/* Enroll Students Modal */}
        <Modal show={showEnrollModal} onHide={() => setShowEnrollModal(false)} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>👥 Enroll Students in Course</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {enrollMessage && (
              <Alert variant={enrollMessage.startsWith('✅') ? 'success' : 'danger'}>
                {enrollMessage}
              </Alert>
            )}
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
                  <div className="border rounded p-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
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
            <Button variant="secondary" onClick={() => setShowEnrollModal(false)} disabled={enrollLoading}>
              Cancel
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
