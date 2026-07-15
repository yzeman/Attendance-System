import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, Badge } from 'react-bootstrap';

const MyProfile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    matric_no: '',
    email: '',
    phone: '',
    gender: '',
    level: '',
    department: '',
    profile_completed: false
  });
  
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchUserData();
    fetchDepartments();
  }, []);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setUserData(data);
      setFormData({
        full_name: data.full_name || '',
        matric_no: data.matric_no || '',
        email: data.email || '',
        phone: data.phone || '',
        gender: data.gender || '',
        level: data.level || '',
        department: data.department || '',
        profile_completed: data.profile_completed || false
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
      setMessage('❌ Error loading profile data');
      setMessageType('danger');
    } finally {
      setLoading(false);
    }
  };

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
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (name === 'department') {
      setShowDepartmentDropdown(false);
    }
  };

  const handleDepartmentSelect = (dept) => {
    setFormData({ ...formData, department: dept });
    setSearchTerm(dept);
    setShowDepartmentDropdown(false);
  };

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    // Validate required fields
    if (!formData.gender) {
      setMessage('❌ Please select your gender');
      setMessageType('danger');
      setSaving(false);
      return;
    }
    if (!formData.level) {
      setMessage('❌ Please select your level');
      setMessageType('danger');
      setSaving(false);
      return;
    }
    if (!formData.department) {
      setMessage('❌ Please select your department');
      setMessageType('danger');
      setSaving(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({
          phone: formData.phone,
          gender: formData.gender,
          level: formData.level,
          department: formData.department,
          profile_completed: true
        })
        .eq('id', user.id);

      if (error) throw error;

      setFormData({ ...formData, profile_completed: true });
      setMessage('✅ Profile updated successfully! Your profile is now complete.');
      setMessageType('success');
      
      // Update local storage user data
      const updatedUser = { ...user, ...formData };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('❌ Error updating profile: ' + error.message);
      setMessageType('danger');
    } finally {
      setSaving(false);
    }
  };

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
        <h2 className="mb-4">👤 My Profile</h2>

        <Row>
          <Col md={8} className="mx-auto">
            <Card className="p-4 shadow-lg">
              {message && (
                <Alert variant={messageType} className="mb-3">
                  {message}
                </Alert>
              )}

              {/* Profile Completion Status */}
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center">
                  <span>Profile Completion</span>
                  <Badge bg={formData.profile_completed ? 'success' : 'warning'} className="p-2">
                    {formData.profile_completed ? '✅ Complete' : '⏳ Incomplete'}
                  </Badge>
                </div>
                <div className="mt-1" style={{ height: '8px', background: '#e9ecef', borderRadius: '4px' }}>
                  <div 
                    style={{ 
                      height: '8px', 
                      width: formData.profile_completed ? '100%' : '60%',
                      background: formData.profile_completed ? '#28a745' : '#ffc107',
                      borderRadius: '4px',
                      transition: 'width 0.5s ease'
                    }}
                  />
                </div>
                <small className="text-muted">
                  {formData.profile_completed 
                    ? 'Your profile is complete! ✅' 
                    : 'Please fill in your gender, level, and department to complete your profile.'}
                </small>
              </div>

              <Form onSubmit={handleSubmit}>
                {/* Read-only fields */}
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Full Name</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.full_name}
                        disabled
                        style={{ backgroundColor: '#e9ecef' }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Matric Number</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.matric_no}
                        disabled
                        style={{ backgroundColor: '#e9ecef' }}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        value={formData.email}
                        disabled
                        style={{ backgroundColor: '#e9ecef' }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Phone Number</Form.Label>
                      <Form.Control
                        type="tel"
                        name="phone"
                        value={formData.phone || ''}
                        onChange={handleChange}
                        disabled={formData.profile_completed}
                        placeholder={formData.profile_completed ? 'Already set' : 'Enter phone number'}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <hr />

                {/* Editable fields - only if profile not completed */}
                <h5 className="mb-3">Additional Information</h5>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Gender <span className="text-danger">*</span></Form.Label>
                      <Form.Select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        disabled={formData.profile_completed}
                        required={!formData.profile_completed}
                      >
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </Form.Select>
                      {formData.profile_completed && (
                        <small className="text-muted">Gender already set</small>
                      )}
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Level <span className="text-danger">*</span></Form.Label>
                      <Form.Select
                        name="level"
                        value={formData.level}
                        onChange={handleChange}
                        disabled={formData.profile_completed}
                        required={!formData.profile_completed}
                      >
                        <option value="">Select Level</option>
                        <option value="ND1">ND1</option>
                        <option value="ND2">ND2</option>
                        <option value="HND1">HND1</option>
                        <option value="HND2">HND2</option>
                      </Form.Select>
                      {formData.profile_completed && (
                        <small className="text-muted">Level already set</small>
                      )}
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>Department <span className="text-danger">*</span></Form.Label>
                      <div style={{ position: 'relative' }}>
                        <Form.Control
                          type="text"
                          placeholder={formData.profile_completed ? 'Department already set' : 'Search for your department...'}
                          value={formData.profile_completed ? formData.department : searchTerm}
                          onChange={(e) => {
                            if (formData.profile_completed) return;
                            setSearchTerm(e.target.value);
                            setShowDepartmentDropdown(true);
                            if (e.target.value === '') {
                              setFormData({ ...formData, department: '' });
                            }
                          }}
                          onFocus={() => !formData.profile_completed && setShowDepartmentDropdown(true)}
                          onBlur={() => setTimeout(() => setShowDepartmentDropdown(false), 200)}
                          disabled={formData.profile_completed}
                          style={formData.profile_completed ? { backgroundColor: '#e9ecef' } : {}}
                        />
                        {showDepartmentDropdown && !formData.profile_completed && searchTerm && (
                          <div className="dropdown-menu show w-100" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {filteredDepartments.length > 0 ? (
                              filteredDepartments.map((dept) => (
                                <button
                                  key={dept.id}
                                  className="dropdown-item"
                                  type="button"
                                  onClick={() => handleDepartmentSelect(dept.name)}
                                >
                                  {dept.name}
                                </button>
                              ))
                            ) : (
                              <div className="dropdown-item text-muted">
                                {searchTerm ? `No department found matching "${searchTerm}"` : 'Type to search...'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {formData.profile_completed && (
                        <small className="text-muted">Department already set</small>
                      )}
                      {!formData.profile_completed && (
                        <small className="text-muted">Start typing to search for your department</small>
                      )}
                    </Form.Group>
                  </Col>
                </Row>

                {/* Submit Button - only if profile not completed */}
                {!formData.profile_completed && (
                  <Button
                    variant="primary"
                    type="submit"
                    className="w-100 mt-3"
                    disabled={saving}
                    style={{ padding: '12px' }}
                  >
                    {saving ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Saving...
                      </>
                    ) : (
                      '💾 Save Profile'
                    )}
                  </Button>
                )}

                {formData.profile_completed && (
                  <div className="text-center mt-3">
                    <Badge bg="success" className="p-3" style={{ fontSize: '1rem' }}>
                      ✅ Your profile is complete!
                    </Badge>
                    <p className="text-muted mt-2">All information has been saved.</p>
                  </div>
                )}
              </Form>
            </Card>
          </Col>
        </Row>
      </div>
    </Container>
  );
};

export default MyProfile;
