import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Navbar from "../modules/nav";
import {useAuth} from "../modules/auth";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate(); //
    // 👈 yönlendirme için hook
    // @ts-ignore
    const { checkAuth } = useAuth(); // Get checkAuth from context

    const handleSubmit = async (e: { preventDefault: () => void }) => {
        e.preventDefault();
        try {
            const res = await axios.post("http://localhost:5000/login", {
                email,
                password
            }, { withCredentials: true });

            console.log(res.data);
            alert("Login successful!");

            await checkAuth();

            navigate("/");
        } catch (err) {
            // @ts-ignore
            if (err.response && err.response.status === 401) {
                alert("Invalid email or password.");
            } else {
                console.error(err);
                alert("Login failed.");
            }
        }
    };

    return (
        <div>
            <Navbar />
            <div className="container mt-5">
                <div className="row justify-content-center">
                    <div className="col-md-6">
                        <h2 className="text-center mb-4">Login</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="mb-3">
                                <label htmlFor="email" className="form-label">Email address</label>
                                <input
                                    type="email"
                                    className="form-control"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="password" className="form-label">Password</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" className="btn btn-primary w-100">Login</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;