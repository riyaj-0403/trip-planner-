import type { AuthResponse } from "../types";
import { request } from "./http";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

export interface LoginInput {
  email: string;
  password: string;
}
export interface RegisterInput extends LoginInput {
  name: string;
}

function mockResponse(email: string, name?: string): AuthResponse {
  return {
    token: "mock-token",
    tokenType: "Bearer",
    id: 1,
    name: name ?? email.split("@")[0],
    email,
    role: "USER",
  };
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  if (USE_MOCK) return mockResponse(input.email);
  return request<AuthResponse>("/auth/login", { method: "POST", body: input, auth: false });
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  if (USE_MOCK) return mockResponse(input.email, input.name);
  return request<AuthResponse>("/auth/register", { method: "POST", body: input, auth: false });
}