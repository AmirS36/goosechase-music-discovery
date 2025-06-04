import styled from "styled-components";

export const Container = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(to bottom, rgb(17, 24, 39), rgb(88, 28, 135));
`;

export const FormContainer = styled.div`
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  margin: 1rem;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

export const Title = styled.h1`
  color: white;
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 2rem;
  text-align: center;
`;

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

export const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

export const Label = styled.label`
  color: rgb(229, 231, 235);
  font-size: 0.875rem;
  font-weight: 500;
`;

export const Input = styled.input`
  width: 100%;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  color: white;
  font-size: 1rem;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: rgb(147, 51, 234);
    box-shadow: 0 0 0 2px rgba(147, 51, 234, 0.2);
  }

  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
`;

export const Button = styled.button`
  width: 100%;
  padding: 0.75rem;
  background: rgb(147, 51, 234);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgb(126, 34, 206);
  }
`;

export const Message = styled.div<{ isError?: boolean }>`
  padding: 0.75rem;
  margin-top: -0.5rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  text-align: center;
  background: ${(props) =>
    props.isError ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)"};
  color: ${(props) =>
    props.isError ? "rgb(239, 68, 68)" : "rgb(34, 197, 94)"};
`;

export const Text = styled.p`
  color: rgb(229, 231, 235);
  text-align: center;
  margin-top: 1.5rem;
  font-size: 0.875rem;
`;

export const LinkButton = styled.button`
  background: none;
  border: none;
  color: rgb(147, 51, 234);
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s;

  &:hover {
    color: rgb(126, 34, 206);
  }
`;