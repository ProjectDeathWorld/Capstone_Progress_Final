import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import AdminLayout from "../components/AdminLayout";
import KPICard from "../components/KPICard";
import ModuleCard from "../components/ModuleCard";

import { getDashboardAnalytics, getPredictedWaitTimes, getPeakHourPredictions, getCongestionRisks } from "../api";
import { getDepartmentDisplayName } from "../utils/departments";

import {
  Box,
  Typography,
  Grid,
  CircularProgress,
} from "@mui/material";

import {
  Analytics,
  Assessment,
  Monitor,
  People,
  Settings,
} from "@mui/icons-material";

function Dashboard() {

  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [peakPredictions, setPeakPredictions] = useState([]);
  const [congestionRisks, setCongestionRisks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    const loadDashboard = async () => {

      try {

        const [dashRes, predRes, peakRes, congRes] = await Promise.allSettled([
          getDashboardAnalytics(),
          getPredictedWaitTimes(),
          getPeakHourPredictions(),
          getCongestionRisks(),
        ]);
        if (dashRes.status === "fulfilled") setAnalytics(dashRes.value);
        if (predRes.status === "fulfilled") {
          const list = Array.isArray(predRes.value?.predictions)
            ? predRes.value.predictions
            : (Array.isArray(predRes.value?.data) ? predRes.value.data : []);
          setPredictions(list);
        }
        if (peakRes.status === "fulfilled") {
          const peakList = Array.isArray(peakRes.value?.peak_predictions)
            ? peakRes.value.peak_predictions
            : (Array.isArray(peakRes.value?.predictions)
              ? peakRes.value.predictions
              : (Array.isArray(peakRes.value?.data) ? peakRes.value.data : []));
          setPeakPredictions(peakList);
        }
        if (congRes.status === "fulfilled") {
          const congList = Array.isArray(congRes.value?.congestion_predictions)
            ? congRes.value.congestion_predictions
            : (Array.isArray(congRes.value?.predictions)
              ? congRes.value.predictions
              : (Array.isArray(congRes.value?.data) ? congRes.value.data : []));
          setCongestionRisks(congList);
        }

      } catch (error) {

        console.error("Failed to load dashboard analytics.", error);

      } finally {

        setLoading(false);

      }

    };

    loadDashboard();

  }, []);

  const modules = [
    {
      title: "Service Performance Analytics & KPI Monitoring",
      description:
        "Monitor waiting time, turnaround time, KPI trends and department comparison.",
      route: "/admin/analytics",
      icon: <Analytics sx={{ fontSize: 45 }} />,
      status: "Analytics Ready",
      color: "#1976d2",
    },
    {
      title: "Reports & Data Extraction",
      description:
        "Generate PDF, Excel, Weekly and Monthly reports.",
      route: "/admin/reports",
      icon: <Assessment sx={{ fontSize: 45 }} />,
      status: "Reports Ready",
      color: "#2e7d32",
    },
    {
      title: "Queue Monitoring",
      description:
        "Monitor all Cashier and Registrar windows in real time.",
      route: "/admin/queue",
      icon: <Monitor sx={{ fontSize: 45 }} />,
      status: "Live Queue",
      color: "#ed6c02",
    },
    {
      title: "Staff Management",
      description:
        "Manage employee accounts, permissions and assignments.",
      route: "/admin/staff",
      icon: <People sx={{ fontSize: 45 }} />,
      status: "Staff Module",
      color: "#7b1fa2",
    },
    {
      title: "Display Board Settings",
      description:
        "Customize the queue display board layout, announcements and themes.",
      route: "/admin/display",
      icon: <Settings sx={{ fontSize: 45 }} />,
      status: "Display Online",
      color: "#455a64",
    },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "60vh",
          }}
        >
          <CircularProgress />
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>

      <Box>

        <Typography
          variant="h4"
          fontWeight="bold"
        >
          Administrator Dashboard
        </Typography>

        <Typography
          color="text.secondary"
          sx={{ mb: 4 }}
        >
          Intelligent Queue Management System with Integrated Service Performance Analytics and KPI Monitoring
        </Typography>

        {/* Welcome Banner */}

        <Box
          sx={{
            mb: 5,
            p: 3,
            borderRadius: 3,
            background: "linear-gradient(135deg,#1565C0,#42A5F5)",
            color: "white",
          }}
        >
          <Typography
            variant="h5"
            fontWeight="bold"
          >
            Welcome, Administrator
          </Typography>

          <Typography sx={{ mt: 1 }}>
            Monitor service performance, KPI indicators, reports and queue operations in real time.
          </Typography>
        </Box>

        {/* KPI Cards */}

        <Grid container spacing={3} sx={{ mb: 5 }}>

          <Grid size={{ xs: 12, md: 3 }}>
            <KPICard
              title="Students Served Today"
              value={analytics?.customers_served ?? 0}
              subtitle="Completed Transactions"
              color="#1976d2"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <KPICard
              title="Average Waiting Time"
              value={`${analytics?.average_waiting_time ?? 0} min`}
              subtitle="Queue Performance"
              color="#ed6c02"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <KPICard
              title="Completion Rate"
              value={`${analytics?.completion_rate ?? 0}%`}
              subtitle="Service Completion"
              color="#2e7d32"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <KPICard
              title="Average Service Time"
              value={`${analytics?.average_service_time ?? 0} min`}
              subtitle="Current Performance"
              color="#7b1fa2"
            />
          </Grid>

        </Grid>

        {/* Module Cards */}

        <Typography
          variant="h5"
          fontWeight="bold"
          sx={{ mb: 3 }}
        >
          Quick Access Modules
        </Typography>

        <Grid container spacing={3}>

          {modules.map((module, index) => (

            <Grid
              key={index}
              size={{ xs: 12, md: 6, lg: 4 }}
            >
              <ModuleCard
                title={module.title}
                description={module.description}
                icon={module.icon}
                status={module.status}
                color={module.color}
                onClick={() => navigate(module.route)}
              />
            </Grid>

          ))}

        </Grid>

        {/* INTELLIGENCE SECTION */}
        <Box sx={{ mt: 6, mb: 4 }}>
          <Typography
            variant="overline"
            sx={{
              display: "inline-block",
              px: 1.5,
              py: 0.5,
              borderRadius: 5,
              backgroundColor: "#eff6ff",
              color: "#1d4ed8",
              fontWeight: "bold",
              letterSpacing: 1.5,
              mb: 1,
            }}
          >
            System Intelligence
          </Typography>
          <Typography
            variant="h4"
            fontWeight="bold"
            sx={{ mb: 1 }}
          >
            INTELLIGENCE
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ mb: 3 }}
          >
            Algorithmic queue analytics and dynamic operational forecasts.
          </Typography>

          <Box
            sx={{
              p: 3,
              borderRadius: 3,
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
            }}
          >
            <Box sx={{ mb: 3, pb: 2, borderBottom: "1px solid #f1f5f9" }}>
              <Typography variant="h6" fontWeight="bold">
                Predicted Waiting Time
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Estimates how long a student/customer will likely wait before being served based on the current queue and historical service performance.
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {predictions && predictions.length > 0 ? (
                predictions.map((dept) => {
                  const status = String(dept.queue_status || "LOW").toUpperCase();
                  const statusColor =
                    status === "CRITICAL"
                      ? "#ef4444"
                      : status === "HIGH"
                      ? "#f97316"
                      : status === "NORMAL"
                      ? "#0284c7"
                      : "#10b981";
                  const statusBg =
                    status === "CRITICAL"
                      ? "#fee2e2"
                      : status === "HIGH"
                      ? "#ffedd5"
                      : status === "NORMAL"
                      ? "#e0f2fe"
                      : "#dcfce7";

                  return (
                    <Grid key={dept.department_key || dept.department_name} size={{ xs: 12, md: 6, lg: 3 }}>
                      <Box
                        sx={{
                          p: 2.5,
                          borderRadius: 2.5,
                          border: "1px solid #e2e8f0",
                          borderTop: `4px solid ${statusColor}`,
                          backgroundColor: "#fafbfc",
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ textTransform: "uppercase" }}>
                              Department
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                              {getDepartmentDisplayName(dept.department_name)}
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              px: 1.2,
                              py: 0.4,
                              borderRadius: 1.5,
                              backgroundColor: statusBg,
                              color: statusColor,
                              fontSize: "0.75rem",
                              fontWeight: "bold",
                            }}
                          >
                            {status}
                          </Box>
                        </Box>

                        <Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                            <Typography variant="caption" fontWeight="600" color="text.secondary">
                              ESTIMATED WAIT
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: "0.65rem", px: 0.8, py: 0.2, bgcolor: "#f1f5f9", borderRadius: 1 }}>
                              ESTIMATE
                            </Typography>
                          </Box>
                          <Typography variant="h5" fontWeight="bold" sx={{ color: "#0f172a" }}>
                            {dept.predicted_wait_formatted}
                          </Typography>
                          {dept.status_reason && (
                            <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
                              {dept.status_reason}
                            </Typography>
                          )}
                        </Box>

                        <Grid container spacing={1}>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1, bgcolor: "#ffffff", borderRadius: 1.5, border: "1px solid #f1f5f9" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.7rem" }}>
                                CURRENT QUEUE
                              </Typography>
                              <Typography variant="body1" fontWeight="bold">
                                {dept.waiting_count}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1, bgcolor: "#ffffff", borderRadius: 1.5, border: "1px solid #f1f5f9" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.7rem" }}>
                                ACTIVE WINDOWS
                              </Typography>
                              <Typography variant="body1" fontWeight="bold">
                                {dept.active_windows}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1, bgcolor: "#ffffff", borderRadius: 1.5, border: "1px solid #f1f5f9" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.7rem" }}>
                                AVG. SERVICE
                              </Typography>
                              <Typography variant="body1" fontWeight="bold">
                                {dept.average_service_time_minutes !== null ? `${dept.average_service_time_minutes} min` : "N/A"}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1, bgcolor: "#ffffff", borderRadius: 1.5, border: "1px solid #f1f5f9" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.7rem" }}>
                                QUEUE STATUS
                              </Typography>
                              <Typography variant="body1" fontWeight="bold" sx={{ color: statusColor }}>
                                {status}
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </Box>
                    </Grid>
                  );
                })
              ) : (
                <Grid size={{ xs: 12 }}>
                  <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                    Calculating waiting time predictions...
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>

          <Box
            sx={{
              p: 3,
              mt: 3,
              borderRadius: 3,
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
            }}
          >
            <Box sx={{ mb: 3, pb: 2, borderBottom: "1px solid #f1f5f9" }}>
              <Typography variant="h6" fontWeight="bold">
                Peak Hour Prediction
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Predicts the busiest upcoming time period for each department based on historical queue arrivals and recent queue activity.
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {peakPredictions && peakPredictions.length > 0 ? (
                peakPredictions.map((dept) => {
                  const risk = String(dept.peak_risk || "NORMAL").toUpperCase();
                  const riskColor =
                    risk === "CRITICAL"
                      ? "#ef4444"
                      : risk === "HIGH"
                      ? "#f97316"
                      : risk === "NORMAL"
                      ? "#0284c7"
                      : "#10b981";
                  const riskBg =
                    risk === "CRITICAL"
                      ? "#fee2e2"
                      : risk === "HIGH"
                      ? "#ffedd5"
                      : risk === "NORMAL"
                      ? "#e0f2fe"
                      : "#dcfce7";

                  return (
                    <Grid key={dept.department_key || dept.department_name} size={{ xs: 12, md: 6, lg: 3 }}>
                      <Box
                        sx={{
                          p: 2.5,
                          borderRadius: 2.5,
                          border: "1px solid #e2e8f0",
                          borderTop: `4px solid ${riskColor}`,
                          backgroundColor: "#fafbfc",
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ textTransform: "uppercase" }}>
                              Department
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                              {getDepartmentDisplayName(dept.department_name)}
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              px: 1.2,
                              py: 0.4,
                              borderRadius: 1.5,
                              backgroundColor: riskBg,
                              color: riskColor,
                              fontSize: "0.75rem",
                              fontWeight: "bold",
                            }}
                          >
                            {risk} RISK
                          </Box>
                        </Box>

                        <Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                            <Typography variant="caption" fontWeight="600" color="text.secondary">
                              PREDICTED PEAK TIME
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                fontSize: "0.65rem",
                                px: 0.8,
                                py: 0.2,
                                bgcolor: dept.is_upcoming ? "#eff6ff" : "#f1f5f9",
                                color: dept.is_upcoming ? "#1d4ed8" : "#64748b",
                                borderRadius: 1,
                                fontWeight: "bold",
                              }}
                            >
                              {dept.is_upcoming ? "UPCOMING TODAY" : "CONCLUDED"}
                            </Typography>
                          </Box>
                          <Typography variant="h5" fontWeight="bold" sx={{ color: "#0f172a" }}>
                            {dept.predicted_peak_formatted || "Unavailable"}
                          </Typography>
                          {dept.status_reason && (
                            <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
                              {dept.status_reason}
                            </Typography>
                          )}
                        </Box>

                        <Grid container spacing={1}>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1, bgcolor: "#ffffff", borderRadius: 1.5, border: "1px solid #f1f5f9" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.7rem" }}>
                                EXPECTED VOLUME
                              </Typography>
                              <Typography variant="body1" fontWeight="bold">
                                {dept.expected_arrivals_formatted || "N/A"}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1, bgcolor: "#ffffff", borderRadius: 1.5, border: "1px solid #f1f5f9" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.7rem" }}>
                                PEAK RISK
                              </Typography>
                              <Typography variant="body1" fontWeight="bold" sx={{ color: riskColor }}>
                                {risk}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1, bgcolor: "#ffffff", borderRadius: 1.5, border: "1px solid #f1f5f9" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.7rem" }}>
                                CONFIDENCE
                              </Typography>
                              <Typography variant="body1" fontWeight="bold">
                                {dept.confidence_text || `${dept.confidence}%`}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1, bgcolor: "#ffffff", borderRadius: 1.5, border: "1px solid #f1f5f9" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.7rem" }}>
                                HISTORICAL PATTERN
                              </Typography>
                              <Typography variant="caption" sx={{ display: "block", fontWeight: 500, color: "#334155", lineHeight: 1.2 }}>
                                {dept.historical_pattern || "Standard pattern"}
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </Box>
                    </Grid>
                  );
                })
              ) : (
                <Grid size={{ xs: 12 }}>
                  <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                    Calculating peak hour predictions...
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>

          <Box
            sx={{
              p: 3,
              mt: 3,
              borderRadius: 3,
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
            }}
          >
            <Box sx={{ mb: 3, pb: 2, borderBottom: "1px solid #f1f5f9" }}>
              <Typography variant="h6" fontWeight="bold">
                Smart Queue Congestion Risk
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Multi-factor capacity analysis evaluating queue length, arrival velocity, service speed, active windows, and growth trends.
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {congestionRisks && congestionRisks.length > 0 ? (
                congestionRisks.map((dept) => {
                  const risk = String(dept.risk_level || "NORMAL").toUpperCase();
                  const riskColor =
                    risk === "CRITICAL"
                      ? "#ef4444"
                      : risk === "HIGH"
                      ? "#f97316"
                      : risk === "NORMAL"
                      ? "#0284c7"
                      : "#10b981";
                  const riskBg =
                    risk === "CRITICAL"
                      ? "#fee2e2"
                      : risk === "HIGH"
                      ? "#ffedd5"
                      : risk === "NORMAL"
                      ? "#e0f2fe"
                      : "#dcfce7";
                  const score = dept.risk_score ?? 0;
                  const trend = dept.queue_trend || "STABLE";

                  return (
                    <Grid key={dept.department_key || dept.department_name} size={{ xs: 12, md: 6, lg: 3 }}>
                      <Box
                        sx={{
                          p: 2.5,
                          borderRadius: 2.5,
                          border: "1px solid #e2e8f0",
                          borderTop: `4px solid ${riskColor}`,
                          backgroundColor: "#fafbfc",
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ textTransform: "uppercase" }}>
                              Department
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                              {getDepartmentDisplayName(dept.department_name)}
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              px: 1.2,
                              py: 0.4,
                              borderRadius: 1.5,
                              backgroundColor: riskBg,
                              color: riskColor,
                              fontSize: "0.75rem",
                              fontWeight: "bold",
                            }}
                          >
                            {risk} RISK
                          </Box>
                        </Box>

                        <Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                            <Typography variant="caption" fontWeight="600" color="text.secondary">
                              CONGESTION RISK SCORE
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                fontSize: "0.75rem",
                                px: 1,
                                py: 0.2,
                                bgcolor: riskBg,
                                color: riskColor,
                                borderRadius: 1,
                                fontWeight: "bold",
                              }}
                            >
                              {score} / 100
                            </Typography>
                          </Box>
                          <Box sx={{ width: "100%", bgcolor: "#f1f5f9", borderRadius: 1, height: 8, mt: 1, overflow: "hidden" }}>
                            <Box sx={{ width: `${Math.max(4, Math.min(100, score))}%`, bgcolor: riskColor, height: "100%", borderRadius: 1 }} />
                          </Box>
                          {dept.peak_period_approaching && (
                            <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.8, fontWeight: 600 }}>
                              ⚠️ Peak period approaching
                            </Typography>
                          )}
                        </Box>

                        <Grid container spacing={1}>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1, bgcolor: "#ffffff", borderRadius: 1.5, border: "1px solid #f1f5f9" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.7rem" }}>
                                CURRENT QUEUE
                              </Typography>
                              <Typography variant="body1" fontWeight="bold">
                                {dept.waiting_count}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1, bgcolor: "#ffffff", borderRadius: 1.5, border: "1px solid #f1f5f9" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.7rem" }}>
                                PREDICTED WAIT
                              </Typography>
                              <Typography variant="body2" fontWeight="bold" sx={{ color: "#0f172a" }}>
                                {dept.predicted_wait_formatted || "Unavailable"}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1, bgcolor: "#ffffff", borderRadius: 1.5, border: "1px solid #f1f5f9" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.7rem" }}>
                                ACTIVE WINDOWS
                              </Typography>
                              <Typography variant="body1" fontWeight="bold">
                                {dept.active_windows}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1, bgcolor: "#ffffff", borderRadius: 1.5, border: "1px solid #f1f5f9" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.7rem" }}>
                                QUEUE TREND
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {trend}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1, bgcolor: "#ffffff", borderRadius: 1.5, border: "1px solid #f1f5f9" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.7rem" }}>
                                ARRIVAL RATE
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {dept.arrival_rate_per_hour}/hour
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1, bgcolor: "#ffffff", borderRadius: 1.5, border: "1px solid #f1f5f9" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.7rem" }}>
                                SERVICE RATE
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {dept.service_rate_per_hour}/hour
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>

                        {dept.reason && (
                          <Box sx={{ p: 1.2, bgcolor: "#f8fafc", borderRadius: 1.5, border: "1px solid #e2e8f0" }}>
                            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: "block" }}>
                              REASON
                            </Typography>
                            <Typography variant="caption" color="text.primary" sx={{ display: "block", lineHeight: 1.3 }}>
                              {dept.reason}
                            </Typography>
                          </Box>
                        )}

                        {dept.recommended_action && (
                          <Box sx={{ p: 1.2, bgcolor: riskBg, borderRadius: 1.5, border: `1px solid ${riskColor}33` }}>
                            <Typography variant="caption" sx={{ color: riskColor, fontWeight: "bold", display: "block" }}>
                              RECOMMENDED ACTION
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#0f172a", display: "block", lineHeight: 1.3 }}>
                              {dept.recommended_action}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Grid>
                  );
                })
              ) : (
                <Grid size={{ xs: 12 }}>
                  <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                    Calculating queue congestion risks...
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        </Box>

      </Box>

    </AdminLayout>
  );
}

export default Dashboard;