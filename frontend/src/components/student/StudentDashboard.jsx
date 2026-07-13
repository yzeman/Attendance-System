import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Container, Row, Col, Card, Table, Badge, Spinner } from 'react-bootstrap';

const StudentDashboard = () => {
  const [attendance, setAttendance] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPresent: 0,
    totalCourses: 0,
    attendancePercentage: 0
  });
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch student's attendance records
      const { data: attendanceData, error: attError } = await supabase
        .from('attendance')
        .select('*, course:course_id(course_code, course_name)')
        .eq('student_id', user.id)
        .order('date', { ascending: false });

      if (attError) throw attError;

      setAttendance(attendanceData || []);

      // 2. Fetch student's enrolled courses
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('enrolled_courses')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      if (userData?.enrolled_courses?.length) {
        const { data: coursesData, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .in('id', userData.enrolled_courses);

        if (courseError) throw courseError;
        setCourses(coursesData || []);
      }

      // 3. Calculate statistics
      const presentCount = (attendanceData || []).filter(a => a.status === 'present').length;
      const totalClasses = (attendanceData || []).length;
      const percentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;

      setStats({
        totalPresent: presentCount,
        totalCourses: userData?.enrolled_courses?.length || 0,
        attendancePercentage: percentage
      });

    } catch (error) {
      console.error('Error fetching data:', error);
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
          <Col md={4}>
            <Card className="stat-card">
              <h2>{stats.totalPresent}</h2>
              <p>Total Present Days</p>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}>
              <h2>{stats.totalCourses}</h2>
              <p>Enrolled Courses</p>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
              <h2>{stats.attendancePercentage}%</h2>
              <p>Overall Attendance</p>
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
                    {attendance.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center text-muted">
                          No attendance records yet.
                        </td>
                      </tr>
                    ) : (
                      attendance.slice(0, 20).map((record) => (
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
