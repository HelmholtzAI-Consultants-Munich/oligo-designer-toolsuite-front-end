import React, { useEffect } from 'react';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../modules/auth';
import { Navbar, Nav, Container, Spinner } from 'react-bootstrap';

const AdminLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, loading } = useAuth();

    useEffect(() => {
        // Check if user is admin
        if (!loading && (!user || user.role !== 'admin')) {
            navigate('/');
        }
    }, [user, loading, navigate]);

    const handleLogout = async () => {
        try {
            await fetch('http://localhost:5000/logout', {
                method: 'POST',
                credentials: 'include',
            });
            navigate('/');
        } catch (error) {
            console.error('Logout failed:', error);
            navigate('/');
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </div>
        );
    }

    if (!user || user.role !== 'admin') {
        return null; // Will redirect
    }

    return (
        <div>
            <Navbar bg="dark" variant="dark" expand="lg">
                <Container fluid>
                    <Navbar.Brand as={Link} to="/admin">
                        Admin Panel
                    </Navbar.Brand>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="me-auto">
                            <Nav.Link as={Link} to="/admin/users" active={location.pathname.startsWith('/admin/users')}>
                                Users
                            </Nav.Link>
                        </Nav>
                        <Nav>
                            <Nav.Link as={Link} to="/">
                                Back to App
                            </Nav.Link>
                            <Nav.Link onClick={handleLogout} style={{ cursor: 'pointer' }}>
                                Logout
                            </Nav.Link>
                        </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>

            <main>
                {children || <Outlet />}
            </main>
        </div>
    );
};

export default AdminLayout;
