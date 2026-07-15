import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Container, Row, Col, Card, Table, Badge, Spinner, Alert, Form } from 'react-bootstrap';

const StudentDashboard = () => {
  const [attendance, setAttendance] = useState([]);
  const [courses, setCourses] = useState([]);
  const [todayCourses, setTodayCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [stats, setStats] = useState({
    totalPresent: 0,
    totalCourses: 0,
    attendancePercentage: 0,
    todayPresent: 0
  });
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('🔵 Student: Fetching data for:', user?.email);
      
      // 1. Fetch student's attendance records
      const { data: attendanceData, error: attError } = await supabase
        .from('attendance')
        .select('*, course:course_id(course_code, course_name)')
        .eq('student_id', user.id)
        .order('date', { ascending: false });

      if (attError) {
        console.error('❌ Attendance fetch error:', attError);
      } else {
        console.log('✅ Attendance fetched:', attendanceData?.length || 0, 'records');
      }
      setAttendance(attendanceData || []);

      // 2. Fetch student's enrolled courses - get DISTINCT courses
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('enrolled_courses')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('❌ User fetch error:', userError);
      } else {
        console.log('✅ User data fetched:', userData);
      }

      // Remove duplicates from enrolled_courses
      let enrolledIds = userData?.enrolled_courses || [];
      enrolledIds = [...new Set(enrolledIds)];
      console.log('🔵 Unique enrolled course IDs:', enrolledIds);

      if (enrolledIds.length > 0) {
        const { data: coursesData, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .in('id', enrolledIds);

        if (courseError) {
          console.error('❌ Courses fetch error:', courseError);
        } else {
          console.log('✅ Courses fetched:', coursesData?.length || 0, 'courses');
        }
        setCourses(coursesData || []);
      } else {
        console.log('⚠️ No enrolled courses found');
        setCourses([]);
      }

      // 3. Calculate statistics
      const uniqueAttendance = attendanceData || [];
      const presentCount = uniqueAttendance.filter(a => a.status === 'present').length;
      const totalClasses = uniqueAttendance.length;
      const percentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;

      // 4. Get today's attendance
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayAttendance = uniqueAttendance.filter(a => new Date(a.date) >= today);
      const todayPresent = todayAttendance.filter(a => a.status === 'present').length;
      
      // 5. Get today's courses (distinct)
      const todayCourseIds = [...new Set(todayAttendance.map(a => a.course_id))];
      let todayCoursesData = [];
      if (todayCourseIds.length > 0) {
        const { data: data } = await supabase
          .from('courses')
          .select('*')
          .in('id', todayCourseIds);
        todayCoursesData = data || [];
      }
      setTodayCourses(todayCoursesData);

      setStats({
        totalPresent: presentCount,
        totalCourses: enrolledIds.length,
        attendancePercentage: percentage,
        todayPresent: todayPresent
      });

    } catch (error) {
      console.error('❌ Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group attendance by course
  const getAttendanceByCourse = () => {
    const courseMap = {};
    attendance.forEach(record => {
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
  };

  const courseStats = getAttendanceByCourse();

  // Get filtered attendance for selected course
  const getFilteredAttendance = () => {
    if (!selectedCourse) return attendance;
    return attendance.filter(a => a.course_id === selectedCourse);
  };

  const filteredAttendance = getFilteredAttendance();

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
        <h2 className="mb-4">👋 Welcome, {user?.full_name}</h2>

        {/* Statistics Cards */}
        <Row className="mb-4">
          <Col md={3}>
            <Card className="stat-card">
              <h2>{stats.totalPresent}</h2>
              <p>📋 Total Present</p>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}>
              <h2>{stats.totalCourses}</h2>
              <p>📚 Enrolled Courses</p>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
              <h2>{stats.attendancePercentage}%</h2>
              <p>📈 Attendance Rate</p>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)' }}>
              <h2>{stats.todayPresent}</h2>
              <p>✅ Today Present</p>
            </Card>
          </Col>
        </Row>

        {/* Today's Courses Section - FIXED STYLING */}
        <Row className="mb-4">
          <Col md={12}>
            <Card className="p-3">
              <h5 className="mb-3">📅 Today's Attended Courses</h5>
              {todayCourses.length === 0 ? (
                <Alert variant="info">
                  You haven't attended any courses today.
                </Alert>
              ) : (
                <div className="d-flex flex-wrap gap-2" style={{ maxWidth: '100%' }}>
                  {todayCourses.map((course) => (
                    <Badge 
                      key={course.id} 
                      bg="success" 
                      className="p-2"
                      style={{ 
                        fontSize: '0.9rem', 
                        maxWidth: '100%',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word'
                      }}
                    >
                      ✅ {course.course_code} - {course.course_name}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* My Courses Section - Dropdown */}
        <Row className="mb-4">
          <Col md={12}>
            <Card className="p-3">
              <h5 className="mb-3">📚 My Enrolled Courses ({courses.length})</h5>
              {courses.length === 0 ? (
                <Alert variant="info">
                  You are not enrolled in any courses yet. Please contact your lecturer or admin.
                </Alert>
              ) : (
                <>
                  <Form.Group className="mb-3">
                    <Form.Label>Select a course to view details:</Form.Label>
                    <Form.Select
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                    >
                      <option value="">-- All Courses --</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.course_code} - {course.course_name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>

                  {/* Course Details Table */}
                  <div className="table-container">
                    <Table striped bordered hover responsive>
                      <thead>
                        <tr>
                          <th>Course Code</th>
                          <th>Course Name</th>
                          <th>Lecturer</th>
                          <th>Present</th>
                          <th>Total Classes</th>
                          <th>Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courseStats
                          .filter(c => !selectedCourse || c.courseCode === courses.find(c => c.id === selectedCourse)?.course_code)
                          .map((course, index) => {
                            const percentage = course.total > 0 
                              ? Math.round((course.present / course.total) * 100) 
                              : 0;
                            return (
                              <tr key={index}>
                                <td><strong>{course.courseCode}</strong></td>
                                <td>{course.courseName}</td>
                                <td>{courses.find(c => c.course_code === course.courseCode)?.lecturer || 'N/A'}</td>
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
                          })}
                        {selectedCourse && courseStats.filter(c => c.courseCode === courses.find(c => c.id === selectedCourse)?.course_code).length === 0 && (
                          <tr>
                            <td colSpan="6" className="text-center text-muted">
                              No attendance records for this course yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </div>
                </>
              )}
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
                    {attendance.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center text-muted">
                          No attendance records yet.
                        </td>
                      </tr>
                    ) : (
                      (selectedCourse ? filteredAttendance : attendance).slice(0, 20).map((record) => (
                        <tr key={record.id}>
                          <td>{new Date(record.date).toLocaleString()}</td>
                          <td>{record.course?.course_code} - {record.course?.course_name}</td>
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
