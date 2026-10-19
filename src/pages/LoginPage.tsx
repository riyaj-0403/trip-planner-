import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ApiError } from "../api/index";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import AuthLayout from "../components/auth/AuthLayout";

function loginMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0 || err.status === 400) return err.message; // offline / validation
    // The backend currently answers wrong passwords with a 500 (and sometimes 401/403).
    return "Invalid email or password.";
  }
  return "Something went wrong. Please try again.";
}

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";

  // Logged in (including right after a successful login) -> go where they were headed.
  if (isAuthenticated) return <Navigate to={from} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
    } catch (err) {
      setError(loginMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Log in to plan your trips.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-4">
            {params.get("expired") && !error && (
              <p role="status" className="text-sm text-muted-foreground">
                Your session expired. Please log in again.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">{error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="example@gmail.com" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              Log in
            </Button>
            <p className="text-sm text-muted-foreground">
              New here? <Link to="/register" className="text-primary hover:underline">Create an account</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  );
}