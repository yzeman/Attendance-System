import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Container, Row, Col, Card, Badge, Spinner, Alert, Form, Button } from 'react-bootstrap';

const MyCourses = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [semesterPreference, setSemesterPreference] = useState('First');
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Get student's enrolled course IDs and semester preference
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('enrolled_courses, semester_preference')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      setEnrolledCourses(userData?.enrolled_courses || []);
      
      // Set semester preference (default to 'First')
      const pref = userData?.semester_preference || 'First';
      setSemesterPreference(pref);

      // 2. Fetch course details for enrolled courses
      if (userData?.enrolled_courses?.length > 0) {
        const { data: coursesData, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .in('id', userData.enrolled_courses);

        if (courseError) throw courseError;
        setCourses(coursesData || []);
      } else {
        setCourses([]);
      }

    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSemesterSwitch = async (semester) => {
    setSemesterPreference(semester);
    
    // Save to database
    try {
      const { error } = await supabase
        .from('users')
        .update({ semester_preference: semester })
        .eq('id', user.id);

      if (error) throw error;
      
      // Update local storage
      const updatedUser = { ...user, semester_preference: semester };
      localStorage.setItem('user', JSON.stringify(updatedUser));

    } catch (error) {
      console.error('Error saving semester preference:', error);
    }
  };

  // Filter courses by selected semester
  const filteredCourses = courses.filter(c => c.semester === semesterPreference);

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
          <h2>📚 My Courses</h2>
          <div>
            <Form.Check
              type="switch"
              id="semester-switch"
              label={semesterPreference === 'First' ? 'First Semester' : 'Second Semester'}
              checked={semesterPreference === 'Second'}
              onChange={(e) => {
                const newSemester = e.target.checked ? 'Second' : 'First';
                handleSemesterSwitch(newSemester);
              }}
            />
          </div>
        </div>

        {courses.length === 0 ? (
          <Alert variant="info">
            You are not enrolled in any courses yet. Please contact your lecturer or admin.
          </Alert>
        ) : filteredCourses.length === 0 ? (
          <Alert variant="warning">
            You have no courses for <strong>{semesterPreference} Semester</strong>. Please switch to the other semester.
          </Alert>
        ) : (
          <Row>
            {filteredCourses.map((course) => {
              const isAttendanceOn = course.attendance_enabled !== false;
              const isActive = course.is_active !== false;
              
              // Determine status message
              let statusMessage = '';
              let statusColor = '';
              let statusBadge = '';

              if (!isActive) {
                statusMessage = '⏳ Course Inactive';
                statusColor = '#6c757d';
                statusBadge = 'secondary';
              } else if (!isAttendanceOn) {
                statusMessage = '⏳ Class hasn\'t commenced yet';
                statusColor = '#ffc107';
                statusBadge = 'warning';
              } else {
                statusMessage = '✅ Active - You can mark attendance';
                statusColor = '#28a745';
                statusBadge = 'success';
              }

              return (
                <Col md={6} lg={4} key={course.id} className="mb-3">
                  <Card className="h-100 shadow-sm" style={{ borderRadius: '15px' }}>
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <h5 className="mb-1">{course.course_code}</h5>
                          <h6 className="text-muted">{course.course_name}</h6>
                        </div>
                        <Badge bg={statusBadge} className="p-2">
                          {isActive && isAttendanceOn ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      
                      <div className="mt-3">
                        <small className="text-muted d-block">
                          <strong>Lecturer:</strong> {course.lecturer || 'N/A'}
                        </small>
                        <small className="text-muted d-block">
                          <strong>Department:</strong> {course.department || 'N/A'}
                        </small>
                        <small className="text-muted d-block">
                          <strong>Level:</strong> {course.level || 'N/A'}
                        </small>
                        <small className="text-muted d-block">
                          <strong>Semester:</strong> {course.semester || 'N/A'}
                        </small>
                      </div>

                      <hr />
                      
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          {isActive && isAttendanceOn ? (
                            <span style={{ color: '#28a745' }}>✅ Available</span>
                          ) : (
                            <span style={{ color: '#ffc107' }}>⏳ {isActive ? 'Class hasn\'t commenced' : 'Course Inactive'}</span>
                          )}
                        </div>
                        <Badge bg={isAttendanceOn ? 'success' : 'warning'}>
                          {isAttendanceOn ? '✅ ON' : '⏳ OFF'}
                        </Badge>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}

        {/* Summary */}
        <Card className="mt-4 p-3 shadow-sm" style={{ borderRadius: '15px' }}>
          <h6>📊 Summary</h6>
          <Row>
            <Col md={4}>
              <div className="text-center">
                <h4>{filteredCourses.length}</h4>
                <p className="text-muted">Courses in {semesterPreference} Semester</p>
              </div>
            </Col>
            <Col md={4}>
              <div className="text-center">
                <h4 style={{ color: '#28a745' }}>
                  {filteredCourses.filter(c => c.attendance_enabled !== false && c.is_active !== false).length}
                </h4>
                <p className="text-muted">Active Courses</p>
              </div>
            </Col>
            <Col md={4}>
              <div className="text-center">
                <h4 style={{ color: '#ffc107' }}>
                  {filteredCourses.filter(c => c.attendance_enabled === false || c.is_active === false).length}
                </h4>
                <p className="text-muted">Inactive / Not Started</p>
              </div>
            </Col>
          </Row>
        </Card>
      </div>
    </Container>
  );
};

export default MyCourses;
