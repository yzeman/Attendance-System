import React from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';

const AppNavbar = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('user');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="shadow">
      <Container>
        <Navbar.Brand as={Link} to="/" className="fw-bold">
          📚 Smart Attendance
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            {user && user.role === 'student' && (
              <>
                <Nav.Link as={Link} to="/student">Dashboard</Nav.Link>
                <Nav.Link as={Link} to="/student/mark">Mark Attendance</Nav.Link>
                <Nav.Link as={Link} to="/student/profile">👤 My Profile</Nav.Link>
              </>
            )}
            {user && user.role === 'admin' && (
              <>
                <Nav.Link as={Link} to="/admin">Admin Panel</Nav.Link>
              </>
            )}
          </Nav>
          {user ? (
            <div className="d-flex align-items-center">
              <span className="text-light me-3">
                👋 {user.full_name || user.email}
              </span>
              <Button 
                variant="outline-light" 
                size="sm" 
                onClick={handleLogout}
              >
                Logout
              </Button>
            </div>
          ) : (
            <Nav.Link as={Link} to="/login" className="text-light">
              Login
            </Nav.Link>
          )}
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default AppNavbar;
