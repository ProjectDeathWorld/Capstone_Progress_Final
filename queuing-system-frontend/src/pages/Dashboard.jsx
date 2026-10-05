import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import AdminLayout from "../components/AdminLayout";
import KPICard from "../components/KPICard";
import ModuleCard from "../components/ModuleCard";

import { getDashboardAnalytics } from "../api";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    const loadDashboard = async () => {

      try {

        const data = await getDashboardAnalytics();
        setAnalytics(data);

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

      </Box>

    </AdminLayout>
  );
}

export default Dashboard;