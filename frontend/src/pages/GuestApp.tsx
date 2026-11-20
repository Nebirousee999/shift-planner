import { Navigate } from "react-router-dom";
import { useAuth } from "../store/auth";

export default function GuestApp() {
  const token = useAuth((s) => s.token);
  if (!token) return <Navigate to="/" replace />;
  return <Navigate to="/weeks" replace />;
}
