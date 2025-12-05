import React, { useEffect, useState } from 'react';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../modules/auth';
import { Navbar, Nav, Container, Spinner, Button } from 'react-bootstrap';
import { People, House, BoxArrowRight, List, Gear } from 'react-bootstrap-icons';
import axios from 'axios';

const AdminLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, loading } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Desktop sidebar collapse state

    useEffect(() => {
        // Check if user is authenticated and is admin
        if (!loading) {
            console.log('Admin check - loading:', loading, 'user:', user, 'role:', user?.role);
            if (!user) {
                // Not logged in - redirect to login with return URL
                console.log('Redirecting to login - user not authenticated');
                navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
            } else if (user.role !== 'admin') {
                // Logged in but not admin - redirect to home
                console.log('Redirecting to home - user is not admin');
                navigate('/');
            }
        }
    }, [user, loading, navigate, location.pathname]);

    const handleLogout = async () => {
        try {
            await axios.post('http://localhost:5000/logout', {}, {
                withCredentials: true,
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

    const isActive = (path: string) => {
        return location.pathname.startsWith(path);
    };

    const sidebarWidth = sidebarCollapsed ? '70px' : '250px';

    // Extracted common styles for nav links
    const getNavLinkStyle = (collapsed?: boolean) => ({
        padding: '0.75rem 1rem',
        marginBottom: '0.25rem',
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        ...(collapsed !== undefined && { justifyContent: collapsed ? 'center' : 'flex-start' }),
    });

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Desktop Sidebar */}
            <div
                className="bg-dark text-white d-none d-lg-block"
                style={{
                    width: sidebarWidth,
                    minHeight: '100vh',
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    zIndex: 1000,
                    paddingTop: '56px',
                    transition: 'width 0.3s ease',
                    overflow: 'hidden',
                }}
            >
                <div className="p-3">
                    <Nav className="flex-column">
                        <Nav.Item>
                            <Nav.Link
                                as={Link}
                                to="/admin/users"
                                className={`text-white ${isActive('/admin/users') ? 'bg-primary rounded' : ''}`}
                                style={getNavLinkStyle(sidebarCollapsed)}
                                title={sidebarCollapsed ? 'User Management' : ''}
                            >
                                <People size={20} className={sidebarCollapsed ? '' : 'me-2'} />
                                {!sidebarCollapsed && <span>User Management</span>}
                            </Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link
                                as={Link}
                                to="/admin/pipelines"
                                className={`text-white ${isActive('/admin/pipelines') ? 'bg-primary rounded' : ''}`}
                                style={getNavLinkStyle(sidebarCollapsed)}
                                title={sidebarCollapsed ? 'Pipeline Management' : ''}
                            >
                                <Gear size={20} className={sidebarCollapsed ? '' : 'me-2'} />
                                {!sidebarCollapsed && <span>Pipeline Management</span>}
                            </Nav.Link>
                        </Nav.Item>
                        {/* Add more navigation items here as needed */}
                    </Nav>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{ marginLeft: sidebarWidth, flex: 1, display: 'flex', flexDirection: 'column', transition: 'margin-left 0.3s ease' }}>
                {/* Top Navbar */}
                <Navbar bg="light" variant="light" expand="lg" style={{ borderBottom: '1px solid #dee2e6' }}>
                    <Container fluid>
                        <Navbar.Brand>
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                className="me-3 d-lg-none"
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                            >
                                <List />
                            </Button>
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                className="me-3 d-none d-lg-inline-block"
                                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            >
                                <List />
                            </Button>
                            Admin Dashboard
                        </Navbar.Brand>
                        <Navbar.Collapse className="justify-content-end">
                            <Nav>
                                <Nav.Link as={Link} to="/">
                                    <House className="me-1" />
                                    Back to App
                                </Nav.Link>
                                <Nav.Link onClick={handleLogout} style={{ cursor: 'pointer' }}>
                                    <BoxArrowRight className="me-1" />
                                    Logout
                                </Nav.Link>
                            </Nav>
                        </Navbar.Collapse>
                    </Container>
                </Navbar>

                {/* Main Content */}
                <main style={{ flex: 1, padding: '2rem', backgroundColor: '#f8f9fa' }}>
                    {children || <Outlet />}
                </main>
            </div>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="d-lg-none"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 999,
                    }}
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <div
                className={`d-lg-none bg-dark text-white ${sidebarOpen ? '' : 'd-none'}`}
                style={{
                    width: '250px',
                    minHeight: '100vh',
                    position: 'fixed',
                    left: sidebarOpen ? 0 : '-250px',
                    top: 0,
                    zIndex: 1001,
                    transition: 'left 0.3s ease',
                    paddingTop: '56px',
                }}
            >
                <div className="p-3">
                    <Nav className="flex-column">
                        <Nav.Item>
                            <Nav.Link
                                as={Link}
                                to="/admin/users"
                                className={`text-white ${isActive('/admin/users') ? 'bg-primary rounded' : ''}`}
                                style={getNavLinkStyle()}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <People className="me-2" />
                                User Management
                            </Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link
                                as={Link}
                                to="/admin/pipelines"
                                className={`text-white ${isActive('/admin/pipelines') ? 'bg-primary rounded' : ''}`}
                                style={getNavLinkStyle()}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <Gear className="me-2" />
                                Pipeline Management
                            </Nav.Link>
                        </Nav.Item>
                    </Nav>
                </div>
            </div>
        </div>
    );
};

export default AdminLayout;
