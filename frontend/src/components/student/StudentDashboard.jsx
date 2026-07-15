import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Container, Row, Col, Card, Table, Badge, Spinner, Alert } from 'react-bootstrap';

const StudentDashboard = () => {
  const [attendance, setAttendance] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugMessages, setDebugMessages] = useState([]);
  const [stats, setStats] = useState({
    totalPresent: 0,
    totalCourses: 0,
    attendancePercentage: 0
  });
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const addDebug = (message, isError = false) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugMessages(prev => [...prev, { timestamp, message, isError }]);
    console.log(`[${timestamp}] ${message}`);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setDebugMessages([]);
    
    try {
      // Check if user exists
      if (!user || !user.id) {
        addDebug('❌ No user found in localStorage', true);
        setError('Please login again.');
        setLoading(false);
        return;
      }
      
      addDebug(`🔵 Student Dashboard: Fetching data for ${user?.email || 'Unknown'}`);
      addDebug(`🔵 User ID: ${user?.id || 'Unknown'}`);
      
      // 1. Fetch student's attendance records
      addDebug('🔵 Fetching attendance records...');
      const { data: attendanceData, error: attError } = await supabase
        .from('attendance')
        .select('*, course:course_id(course_code, course_name)')
        .eq('student_id', user.id)
        .order('date', { ascending: false });

      if (attError) {
        addDebug(`❌ Attendance fetch error: ${attError.message}`, true);
        throw attError;
      }
      addDebug(`✅ Attendance fetched: ${attendanceData?.length || 0} records`);
      setAttendance(attendanceData || []);

      // 2. Fetch student's enrolled courses
      addDebug('🔵 Fetching enrolled courses...');
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('enrolled_courses')
        .eq('id', user.id)
        .single();

      if (userError) {
        addDebug(`❌ User fetch error: ${userError.message}`, true);
        throw userError;
      }

      const enrolledIds = userData?.enrolled_courses || [];
      addDebug(`📋 Enrolled course IDs: ${enrolledIds.length} course(s)`);

      if (enrolledIds.length > 0) {
        addDebug('🔵 Fetching course details...');
        const { data: coursesData, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .in('id', enrolledIds);

        if (courseError) {
          addDebug(`❌ Courses fetch error: ${courseError.message}`, true);
          throw courseError;
        }
        addDebug(`✅ Courses fetched: ${coursesData?.length || 0} course(s)`);
        if (coursesData?.length > 0) {
          addDebug(`📋 Courses: ${coursesData.map(c => c.course_code).join(', ')}`);
        }
        setCourses(coursesData || []);
      } else {
        addDebug('⚠️ No enrolled courses found');
        setCourses([]);
      }

      // 3. Calculate statistics
      const presentCount = (attendanceData || []).filter(a => a.status === 'present').length;
      const totalClasses = (attendanceData || []).length;
      const percentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;

      setStats({
        totalPresent: presentCount,
        totalCourses: enrolledIds.length || 0,
        attendancePercentage: percentage
      });

      addDebug(`📊 Stats: ${presentCount} present, ${enrolledIds.length} courses, ${percentage}%`);
      addDebug('✅ Data loaded successfully!');

    } catch (error) {
      addDebug(`❌ Error fetching data: ${error.message}`, true);
      setError(error.message);
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group attendance by course
  const getAttendanceByCourse = () => {
    try {
      const courseMap = {};
      if (!attendance || attendance.length === 0) return [];
      
      attendance.forEach(record => {
        if (!record) return;
        const courseId = record.course_id;
        if (!courseMap[courseId]) {
          courseMap[courseId] = {
            courseCode: record.course?.course_code || 'Unknown',
            courseName: record.course?.course_name || 'Unknown',
            present: 0,
            total: 0
          };
        }
        courseMap[courseId].total++;
        if (record.status === 'present') {
          courseMap[courseId].present++;
        }
      });
      return Object.values(courseMap);
    } catch (err) {
      console.error('Error grouping attendance:', err);
      return [];
    }
  };

  const courseStats = getAttendanceByCourse();

  // Show error state
  if (error) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          <h5>❌ Error Loading Dashboard</h5>
          <p>{error}</p>
          <Button variant="outline-danger" onClick={() => {
            setError(null);
            fetchData();
          }}>
            🔄 Try Again
          </Button>
        </Alert>
      </Container>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <div className="animate-fade-in">
        <h2 className="mb-4">👋 Welcome, {user?.full_name || 'Student'}</h2>

        {/* Debug Panel */}
        <Card className="mb-4 p-3" style={{ background: '#f8f9fa', border: '2px solid #007bff' }}>
          <h6 className="mb-2">🔍 Debug Log ({debugMessages.length} messages)</h6>
          <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '12px', fontFamily: 'monospace' }}>
            {debugMessages.length === 0 ? (
              <div className="text-muted">No logs yet...</div>
            ) : (
              debugMessages.map((msg, idx) => (
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
          <Button 
            variant="outline-secondary" 
            size="sm" 
            className="mt-2"
            onClick={() => {
              setDebugMessages([]);
              fetchData();
            }}
          >
            🔄 Refresh Data
          </Button>
        </Card>

        {/* Statistics Cards */}
        <Row className="mb-4">
          <Col md={4}>
            <Card className="stat-card">
              <h2>{stats.totalPresent || 0}</h2>
              <p>Total Present Days</p>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}>
              <h2>{stats.totalCourses || 0}</h2>
              <p>Enrolled Courses</p>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
              <h2>{stats.attendancePercentage || 0}%</h2>
              <p>Overall Attendance</p>
            </Card>
          </Col>
        </Row>

        {/* My Courses Section */}
        <Row className="mb-4">
          <Col md={12}>
            <Card className="p-3">
              <h5 className="mb-3">📚 My Enrolled Courses ({courses.length} course{courses.length !== 1 ? 's' : ''})</h5>
              {courses.length === 0 ? (
                <Alert variant="info">
                  You are not enrolled in any courses yet. Please contact your lecturer or admin.
                </Alert>
              ) : (
                <div className="d-flex flex-wrap gap-2">
                  {courses.map((course) => (
                    <Badge 
                      key={course.id} 
                      bg="primary" 
                      className="p-3"
                      style={{ fontSize: '1rem' }}
                    >
                      {course.course_code} - {course.course_name}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* Attendance by Course */}
        <Row className="mb-4">
          <Col md={12}>
            <Card className="p-3">
              <h5 className="mb-3">📊 Attendance by Course</h5>
              <div className="table-container">
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Course Code</th>
                      <th>Course Name</th>
                      <th>Present</th>
                      <th>Total Classes</th>
                      <th>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseStats.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center text-muted">
                          No attendance records found.
                        </td>
                      </tr>
                    ) : (
                      courseStats.map((course, index) => {
                        const percentage = course.total > 0 
                          ? Math.round((course.present / course.total) * 100) 
                          : 0;
                        return (
                          <tr key={index}>
                            <td><strong>{course.courseCode}</strong></td>
                            <td>{course.courseName}</td>
                            <td>{course.present}</td>
                            <td>{course.total}</td>
                            <td>
                              <Badge 
                                bg={percentage >= 75 ? 'success' : percentage >= 50 ? 'warning' : 'danger'}
                                className="px-3 py-2"
                              >
                                {percentage}%
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
          </Col>
        </Row>

        {/* Recent Attendance History */}
        <Row>
          <Col md={12}>
            <Card className="p-3">
              <h5 className="mb-3">🕐 Recent Attendance History</h5>
              <div className="table-container">
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Course</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!attendance || attendance.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center text-muted">
                          No attendance records yet.
                        </td>
                      </tr>
                    ) : (
                      attendance.slice(0, 20).map((record) => (
                        <tr key={record.id}>
                          <td>{record.date ? new Date(record.date).toLocaleString() : 'Unknown'}</td>
                          <td>{record.course?.course_code || 'Unknown'} - {record.course?.course_name || 'Unknown'}</td>
                          <td>
                            <Badge bg="success" className="px-3 py-2">
                              ✅ Present
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </Container>
  );
};

export default StudentDashboard;
