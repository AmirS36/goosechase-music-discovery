import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  FormContainer,
  Title,
  Form,
  FormGroup,
  Label,
  Input,
  Button,
  Message,
  Text,
  LinkButton,
} from "../styles/LoginForm.styles";

const LoginForm = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    console.log("Login button clicked");

    try {
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("token", data.token); // Store the token in local storage
        localStorage.setItem("username", username); // Store the username in local storage
        setMessage("Login successful! Redirecting...");
        setIsError(false);
        setTimeout(() => navigate("/home"), 2000); // Redirect to home after 2 seconds
      } else {
        setMessage("Invalid credentials");
        setIsError(true);
      }
    } catch (err) {
      setMessage("Login failed. Please try again.");
      setIsError(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-purple-900 text-white flex flex-col">
      <header className="flex justify-between items-center p-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">GooseChase</span>
        </div>
      </header>

      <Container>
        <FormContainer>
          <Title>Login</Title>
          <Form onSubmit={handleSubmit}>
            <FormGroup>
              <Label htmlFor="username">Username</Label>
              <Input
                type="text"
                id="username"
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setUsername(e.target.value)
                }
                placeholder="Enter your username"
              />
            </FormGroup>
            <FormGroup>
              <Label htmlFor="password">Password</Label>
              <Input
                type="password"
                id="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPassword(e.target.value)
                }
                placeholder="Enter your password"
              />
            </FormGroup>
            {message && <Message isError={isError}>{message}</Message>}
            <Button type="submit">Login</Button>
          </Form>
          <Text>
            Don't have an account?{" "}
            <LinkButton onClick={() => navigate("/register")}>
              Register here
            </LinkButton>
          </Text>
        </FormContainer>
      </Container>
    </div>
  );
};

export default LoginForm;