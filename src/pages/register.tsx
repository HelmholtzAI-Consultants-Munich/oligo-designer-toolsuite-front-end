import { useState } from "react";
import axios from "axios";
import Navbar from "../components/ui/Topbar";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../modules/useAuth";
import { BACKEND_URL } from "../config";
import { Alert, Button, Col, Container, Form, Row } from "react-bootstrap";

const Register = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();
    const { checkAuth } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await axios.post(
                BACKEND_URL + "/register",
                {
                    email,
                    password,
                },
                { withCredentials: true }
            );
            console.log(res.data);
            alert("Registration successful!");

            await checkAuth();
            navigate("/");
        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response?.status === 409) {
                alert("Email already in use.");
            } else {
                console.error(err);
                alert("Registration failed.");
            }
        }
    };

    return (
        <>
            <Navbar />
            <Container>
                <Row className="justify-content-center">
                    <Col md={6}>
                        <h2>Register</h2>
                        <Form onSubmit={handleSubmit}>
                            <Form.Group controlId="registerEmail">
                                <Form.Label>Email address</Form.Label>
                                <Form.Control
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </Form.Group>
                            <Form.Group controlId="registerPassword">
                                <Form.Label>Password</Form.Label>
                                <Form.Control
                                    type="password"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    required
                                />
                            </Form.Group>
                            <Alert variant="warning">
                                Your pipeline runs will be transferred to your
                                account when you log in!
                            </Alert>
                            <Button type="submit">Register</Button>
                        </Form>
                    </Col>
                </Row>
            </Container>
        </>
    );
};

export default Register;
