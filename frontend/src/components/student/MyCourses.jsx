import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Container, Row, Col, Card, Table, Spinner, Alert, Form, Badge } from 'react-bootstrap';

const MyCourses = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [semesterPreference, setSemesterPreference] = useState('First');
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get student's enrolled course IDs and semester preference
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('enrolled_courses, semester_preference')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      const pref = userData?.semester_preference || 'First';
      setSemesterPreference(pref);

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
            <Col md={12}>
              <div className="text-center">
                <h4>{filteredCourses.length}</h4>
                <p className="text-muted">Total Courses in {semesterPreference} Semester</p>
              </div>
            </Col>
          </Row>
        </Card>
      </div>
    </Container>
  );
};

export default MyCourses;
