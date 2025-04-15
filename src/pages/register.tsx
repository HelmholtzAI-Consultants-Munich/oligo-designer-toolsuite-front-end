import React, { useState } from "react";
import axios from "axios";
import Navbar from "../modules/nav";

const Register = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleSubmit = async (e: { preventDefault: () => void }) => {
        e.preventDefault();
        try {
            const res = await axios.post("http://localhost:5000/register", {
                email,
                password
            });
            console.log(res.data);
            alert("Registration successful!");
        } catch (err: any) {
            if (err.response && err.response.status === 409) {
                alert("Email already in use.");
            } else {
                console.error(err);
                alert("Registration failed.");
            }
        }
    };

    return (
        <div>
            <Navbar />
            <div className="container mt-5">
                <div className="row justify-content-center">
                    <div className="col-md-6">
                        <h2 className="text-center mb-4">Register</h2>
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
                            <button type="submit" className="btn btn-primary w-100">Register</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;