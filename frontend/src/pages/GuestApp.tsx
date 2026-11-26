import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import DashboardPage from "./DashboardPage";
import WeeksPage from "./WeeksPage";
import WeekDetailPage from "./WeekDetailPage";
import SwapsPage from "./SwapsPage";
import TeamPage from "./TeamPage";
import AnalyticsPage from "./AnalyticsPage";
import DocumentsPage from "./DocumentsPage";
import TimesheetPage from "./TimesheetPage";
import VacationsPage from "./VacationsPage";
import SickLeavesPage from "./SickLeavesPage";
import HistoryPage from "./HistoryPage";
import TemplatesPage from "./TemplatesPage";

export default function GuestApp() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (localStorage.getItem("isGuest") !== "true") {
      localStorage.setItem("isGuest", "true");
      localStorage.setItem("token", "guest-mock");
      localStorage.setItem("user", JSON.stringify({ id: "guest", name: "Гость", role: "OWNER", orgId: "guest-org" }));
    }
    
    document.title = "Демо-режим | Планировщик смен";
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex, follow");
  }, []);

  if (pathname === "/demo" || pathname === "/demo/") {
    return <Navigate to="/demo/dashboard" replace />;
  }

  return (
    <Routes>
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="weeks" element={<WeeksPage />} />
      <Route path="weeks/:id" element={<WeekDetailPage />} />
      <Route path="swaps" element={<SwapsPage />} />
      <Route path="team" element={<TeamPage />} />
      <Route path="vacations" element={<VacationsPage />} />
      <Route path="sick-leaves" element={<SickLeavesPage />} />
      <Route path="analytics" element={<AnalyticsPage />} />
      <Route path="history" element={<HistoryPage />} />
      <Route path="documents" element={<DocumentsPage />} />
      <Route path="timesheet" element={<TimesheetPage />} />
      <Route path="templates" element={<TemplatesPage />} />
      <Route path="*" element={<Navigate to="/demo/dashboard" replace />} />
    </Routes>
  );
}