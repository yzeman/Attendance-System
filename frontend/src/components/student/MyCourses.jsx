import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Container, Row, Col, Card, Table, Spinner, Alert, Form, Badge } from 'react-bootstrap';

const MyCourses = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [semesterPreference, setSemesterPreference] = useState('First');
  const [secondSemesterEnabled, setSecondSemesterEnabled] = useState(false);
  const [adminSemesterLoaded, setAdminSemesterLoaded] = useState(false);
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

      // 2. Get admin's semester preference (from admin user)
      // First, get the admin user ID
      const { data: adminData, error: adminError } = await supabase
        .from('users')
        .select('id, semester_preference')
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (adminError) {
        console.error('Error fetching admin semester preference:', adminError);
        // Default to false if admin not found
        setSecondSemesterEnabled(false);
      } else {
        // Check if admin has second semester enabled
        const adminPref = adminData?.semester_preference || 'First';
        setSecondSemesterEnabled(adminPref === 'Second');
      }
      setAdminSemesterLoaded(true);

      // 3. Get student's semester preference
      let pref = userData?.semester_preference || 'First';
      
      // If second semester is OFF in admin, force student to First semester
      if (secondSemesterEnabled === false && pref === 'Second') {
        pref = 'First';
        // Update student's preference to match admin
        await supabase
          .from('users')
          .update({ semester_preference: 'First' })
          .eq('id', user.id);
        
        const updatedUser = { ...user, semester_preference: 'First' };
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      
      setSemesterPreference(pref);

      // 4. Fetch courses
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
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSemesterSwitch = async (semester) => {
    // Check if second semester is enabled by admin
    if (semester === 'Second' && !secondSemesterEnabled) {
      alert('⚠️ Second semester is currently not available. Please contact the administrator.');
      return;
    }

    setSemesterPreference(semester);
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ semester_preference: semester })
        .eq('id', user.id);

      if (error) throw error;
      
      const updatedUser = { ...user, semester_preference: semester };
      localStorage.setItem('user', JSON.stringify(updatedUser));

    } catch (error) {
      console.error('Error saving semester preference:', error);
    }
  };

  // Filter courses by selected semester (only if second semester is enabled)
  const filteredCourses = courses.filter(c => {
    // If student is trying to view second semester but admin has it OFF
    if (semesterPreference === 'Second' && !secondSemesterEnabled) {
      return false;
    }
    return c.semester === semesterPreference;
  });

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
              disabled={!secondSemesterEnabled || !hasSecondSemesterCourses}
            />
            {!secondSemesterEnabled && (
              <small className="text-muted d-block text-end">
                ⚠️ Second semester is currently disabled by admin
              </small>
            )}
            {secondSemesterEnabled && !hasSecondSemesterCourses && (
              <small className="text-muted d-block text-end">
                ℹ️ No second semester courses available
              </small>
            )}
          </div>
        </div>

        {courses.length === 0 ? (
          <Alert variant="info">
            You are not enrolled in any courses yet. Please contact your lecturer or admin.
          </Alert>
        ) : semesterPreference === 'Second' && !secondSemesterEnabled ? (
          <Alert variant="warning">
            <strong>⚠️ Second Semester Not Available</strong>
            <br />
            The second semester has not been opened by the administrator yet. 
            Please check back later or contact your admin for more information.
            <br />
            <br />
            <Button 
              variant="outline-primary" 
              size="sm"
              onClick={() => handleSemesterSwitch('First')}
            >
              Switch to First Semester
            </Button>
          </Alert>
        ) : filteredCourses.length === 0 && semesterPreference === 'Second' ? (
          <Alert variant="info">
            You have no courses for <strong>Second Semester</strong>. 
            Please switch to First Semester to view your courses.
          </Alert>
        ) : filteredCourses.length === 0 ? (
          <Alert variant="warning">
            You have no courses for <strong>{semesterPreference} Semester</strong>. Please switch to the other semester.
          </Alert>
        ) : (
          <Card className="shadow-sm" style={{ borderRadius: '15px' }}>
            <Card.Body>
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Course Code</th>
                    <th>Course Title</th>
                    <th>Lecturer</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.map((course, index) => (
                    <tr key={course.id}>
                      <td>{index + 1}</td>
                      <td><strong>{course.course_code}</strong></td>
                      <td>{course.course_name}</td>
                      <td>{course.lecturer || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        )}

        {/* Summary */}
        <Card className="mt-4 p-3 shadow-sm" style={{ borderRadius: '15px' }}>
          <Row>
            <Col md={6}>
              <div className="text-center">
                <h4>{filteredCourses.length}</h4>
                <p className="text-muted">Courses in {semesterPreference} Semester</p>
              </div>
            </Col>
            <Col md={6}>
              <div className="text-center">
                <h4 style={{ color: secondSemesterEnabled ? '#28a745' : '#dc3545' }}>
                  {secondSemesterEnabled ? '✅ ON' : '❌ OFF'}
                </h4>
                <p className="text-muted">Second Semester Status</p>
              </div>
            </Col>
          </Row>
        </Card>
      </div>
    </Container>
  );
};

export default MyCourses;
