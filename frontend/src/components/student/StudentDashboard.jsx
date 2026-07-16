import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Container, Row, Col, Card, Table, Badge, Spinner, Alert, Form } from 'react-bootstrap';

const StudentDashboard = () => {
  const [attendance, setAttendance] = useState([]);
  const [courses, setCourses] = useState([]);
  const [todayCourses, setTodayCourses] = useState([]);
  const [todayAbsent, setTodayAbsent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [semesterPreference, setSemesterPreference] = useState('First');
  const [secondSemesterEnabled, setSecondSemesterEnabled] = useState(false);
  const [stats, setStats] = useState({
    totalPresent: 0,
    totalAbsent: 0,
    totalCourses: 0,
    attendancePercentage: 0,
    todayPresent: 0,
    todayAbsent: 0
  });
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('🔵 Student: Fetching data for:', user?.email);

      // 1. Get student's enrolled courses and semester preference
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('enrolled_courses, semester_preference')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('❌ User fetch error:', userError);
      } else {
        console.log('✅ User data fetched:', userData);
      }

      // 2. Get admin's semester preference
      const { data: adminData, error: adminError } = await supabase
        .from('users')
        .select('semester_preference')
        .eq('role', 'admin')
        .limit(1)
        .single();

      let adminPref = 'First';
      if (!adminError && adminData) {
        adminPref = adminData.semester_preference || 'First';
      }
      setSecondSemesterEnabled(adminPref === 'Second');

      // 3. Get student's semester preference
      let studentPref = userData?.semester_preference || 'First';
      
      if (studentPref === 'Second' && adminPref !== 'Second') {
        studentPref = 'First';
        await supabase
          .from('users')
          .update({ semester_preference: 'First' })
          .eq('id', user.id);
      }
      
      setSemesterPreference(studentPref);

      // 4. Update localStorage
      const storedUser = JSON.parse(localStorage.getItem('user'));
      if (storedUser && storedUser.semester_preference !== studentPref) {
        const updatedUser = { ...storedUser, semester_preference: studentPref };
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }

      // 5. Remove duplicates from enrolled_courses
      let enrolledIds = userData?.enrolled_courses || [];
      enrolledIds = [...new Set(enrolledIds)];

      // 6. Fetch courses
      let coursesData = [];
      if (enrolledIds.length > 0) {
        const { data: data, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .in('id', enrolledIds);

        if (courseError) {
          console.error('❌ Courses fetch error:', courseError);
        } else {
          console.log('✅ Courses fetched:', data?.length || 0, 'courses');
          coursesData = data || [];
        }
        setCourses(coursesData);
      } else {
        console.log('⚠️ No enrolled courses found');
        setCourses([]);
      }

      // 7. Fetch student's attendance records (ALL - present and absent)
      const { data: attendanceData, error: attError } = await supabase
        .from('attendance')
        .select('*, course:course_id(course_code, course_name)')
        .eq('student_id', user.id)
        .order('date', { ascending: false });

      if (attError) {
        console.error('❌ Attendance fetch error:', attError);
      } else {
        console.log('✅ Attendance fetched:', attendanceData?.length || 0, 'records');
        console.log('📊 Attendance statuses:', attendanceData?.map(a => a.status));
      }
      setAttendance(attendanceData || []);

      // 8. Filter courses by student's selected semester
      const filteredCourseIds = coursesData
        .filter(c => c.semester === studentPref)
        .map(c => c.id);

      // 9. Filter attendance by student's selected semester
      const filteredAttendance = (attendanceData || []).filter(a => 
        filteredCourseIds.includes(a.course_id)
      );

      // 10. Calculate statistics (TOTAL)
      const presentCount = filteredAttendance.filter(a => a.status === 'present').length;
      const absentCount = filteredAttendance.filter(a => a.status === 'absent').length;
      const totalClasses = filteredAttendance.length;
      const percentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;

      // 11. Get TODAY's attendance (filtered by semester)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayAttendance = filteredAttendance.filter(a => new Date(a.date) >= today);
      
      // Count today's present and absent
      const todayPresent = todayAttendance.filter(a => a.status === 'present').length;
      const todayAbsent = todayAttendance.filter(a => a.status === 'absent').length;
      
      console.log('📊 Today attendance:', { todayPresent, todayAbsent, total: todayAttendance.length });
      
      // 12. Get today's attended courses (present)
      const todayCourseIds = [...new Set(todayAttendance.filter(a => a.status === 'present').map(a => a.course_id))];
      let todayCoursesData = [];
      if (todayCourseIds.length > 0) {
        const { data: data } = await supabase
          .from('courses')
          .select('*')
          .in('id', todayCourseIds);
        todayCoursesData = data || [];
      }
      setTodayCourses(todayCoursesData);

      // 13. Get today's absent courses (status = 'absent')
      const absentCourseIds = todayAttendance
        .filter(a => a.status === 'absent')
        .map(a => a.course_id);
      
      const absentCourses = coursesData.filter(c => 
        absentCourseIds.includes(c.id) && 
        c.semester === studentPref
      );
      setTodayAbsent(absentCourses);
      console.log('📊 Today absent courses:', absentCourses.map(c => c.course_code));

      setStats({
        totalPresent: presentCount,
        totalAbsent: absentCount,
        totalCourses: filteredCourseIds.length,
        attendancePercentage: percentage,
        todayPresent: todayPresent,
        todayAbsent: todayAbsent
      });

    } catch (error) {
      console.error('❌ Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group attendance by course (filtered by semester)
  const getAttendanceByCourse = () => {
    const courseMap = {};
    const filteredAttendance = attendance.filter(a => {
      const course = courses.find(c => c.id === a.course_id);
      return course && course.semester === semesterPreference;
    });
    
    filteredAttendance.forEach(record => {
      const courseId = record.course_id;
      if (!courseMap[courseId]) {
        courseMap[courseId] = {
          courseCode: record.course?.course_code || 'Unknown',
          courseName: record.course?.course_name || 'Unknown',
          present: 0,
          absent: 0,
          total: 0
        };
      }
      courseMap[courseId].total++;
      if (record.status === 'present') {
        courseMap[courseId].present++;
      } else if (record.status === 'absent') {
        courseMap[courseId].absent++;
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

  // Get courses for the current semester
  const semesterCourses = courses.filter(c => c.semester === semesterPreference);

  // Check if student has any second semester courses
  const hasSecondSemesterCourses = courses.some(c => c.semester === 'Second');

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
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>👋 Welcome, {user?.full_name}</h2>
          <Badge bg="primary" className="p-2" style={{ fontSize: '1rem' }}>
            📅 {semesterPreference} Semester
          </Badge>
        </div>

        {/* Statistics Cards */}
        <Row className="mb-4">
          <Col md={2}>
            <Card className="stat-card">
              <h2>{stats.totalPresent}</h2>
              <p>✅ Total Present</p>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)' }}>
              <h2>{stats.totalAbsent}</h2>
              <p>❌ Total Absent</p>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}>
              <h2>{stats.totalCourses}</h2>
              <p>📚 Enrolled Courses</p>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
              <h2>{stats.attendancePercentage}%</h2>
              <p>📈 Attendance Rate</p>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
              <h2>{stats.todayPresent}</h2>
              <p>✅ Today Present</p>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)' }}>
              <h2>{stats.todayAbsent}</h2>
              <p>❌ Today Absent</p>
            </Card>
          </Col>
        </Row>

        {/* Today's Attended Courses */}
        <Row className="mb-3">
          <Col md={12}>
            <Card className="p-3">
              <h5 className="mb-3">✅ Today's Attended Courses</h5>
              {todayCourses.length === 0 ? (
                <Alert variant="info">
                  You haven't attended any courses today in <strong>{semesterPreference} Semester</strong>.
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

        {/* Today's Absent Courses */}
        <Row className="mb-3">
          <Col md={12}>
            <Card className="p-3" style={{ background: '#fff5f5', border: '1px solid #dc3545' }}>
              <h5 className="mb-3" style={{ color: '#dc3545' }}>❌ Today's Absent Courses</h5>
              {todayAbsent.length === 0 ? (
                <Alert variant="success" style={{ background: '#d4edda', borderColor: '#28a745' }}>
                  🎉 You have no absents today! Great job!
                </Alert>
              ) : (
                <>
                  <div className="d-flex flex-wrap gap-2" style={{ maxWidth: '100%' }}>
                    {todayAbsent.map((course) => (
                      <Badge 
                        key={course.id} 
                        bg="danger" 
                        className="p-2"
                        style={{ 
                          fontSize: '0.9rem', 
                          maxWidth: '100%',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word'
                        }}
                      >
                        ❌ {course.course_code} - {course.course_name}
                      </Badge>
                    ))}
                  </div>
                  <small className="text-muted mt-2">
                    You were absent for these courses today in <strong>{semesterPreference} Semester</strong>.
                  </small>
                </>
              )}
            </Card>
          </Col>
        </Row>

        {/* My Courses Section */}
        <Row className="mb-4">
          <Col md={12}>
            <Card className="p-3">
              <h5 className="mb-3">📚 My Enrolled Courses ({semesterCourses.length}) - {semesterPreference} Semester</h5>
              {semesterCourses.length === 0 ? (
                <Alert variant="info">
                  You are not enrolled in any courses for <strong>{semesterPreference} Semester</strong>.
                  {semesterPreference === 'First' && secondSemesterEnabled && hasSecondSemesterCourses && (
                    <span> Please switch to Second Semester in the <strong>My Courses</strong> page.</span>
                  )}
                  {semesterPreference === 'Second' && (
                    <span> Please switch to First Semester in the <strong>My Courses</strong> page.</span>
                  )}
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
                      {semesterCourses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.course_code} - {course.course_name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>

                  <div className="table-container">
                    <Table striped bordered hover responsive>
                      <thead>
                        <tr>
                          <th>Course Code</th>
                          <th>Course Name</th>
                          <th>Lecturer</th>
                          <th>✅ Present</th>
                          <th>❌ Absent</th>
                          <th>📊 Total</th>
                          <th>📈 Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courseStats
                          .filter(c => !selectedCourse || c.courseCode === semesterCourses.find(c => c.id === selectedCourse)?.course_code)
                          .map((course, index) => {
                            const percentage = course.total > 0 
                              ? Math.round((course.present / course.total) * 100) 
                              : 0;
                            return (
                              <tr key={index}>
                                <td><strong>{course.courseCode}</strong></td>
                                <td>{course.courseName}</td>
                                <td>{semesterCourses.find(c => c.course_code === course.courseCode)?.lecturer || 'N/A'}</td>
                                <td>{course.present}</td>
                                <td>{course.absent}</td>
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
                        {selectedCourse && courseStats.filter(c => c.courseCode === semesterCourses.find(c => c.id === selectedCourse)?.course_code).length === 0 && (
                          <tr>
                            <td colSpan="7" className="text-center text-muted">
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
              <h5 className="mb-3">🕐 Recent Attendance History - {semesterPreference} Semester</h5>
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
                    {attendance.filter(a => {
                      const course = courses.find(c => c.id === a.course_id);
                      return course && course.semester === semesterPreference;
                    }).length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center text-muted">
                          No attendance records for {semesterPreference} Semester yet.
                        </td>
                      </tr>
                    ) : (
                      attendance
                        .filter(a => {
                          const course = courses.find(c => c.id === a.course_id);
                          return course && course.semester === semesterPreference;
                        })
                        .slice(0, 20)
                        .map((record) => (
                          <tr key={record.id}>
                            <td>{new Date(record.date).toLocaleString()}</td>
                            <td>{record.course?.course_code} - {record.course?.course_name}</td>
                            <td>
                              {record.status === 'present' ? (
                                <Badge bg="success" className="px-3 py-2">
                                  ✅ Present
                                </Badge>
                              ) : (
                                <Badge bg="danger" className="px-3 py-2">
                                  ❌ Absent
                                </Badge>
                              )}
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
