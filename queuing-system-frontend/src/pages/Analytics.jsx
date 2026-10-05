import { displayValue, isMissingValue } from '../utils/adminDisplay'
import CalendarDateRange from '../components/CalendarDateRange'
import { useAdminPolling, retainEqual } from '../hooks/useAdminPolling';
import { useEffect, useState, useCallback, useRef } from "react";

import {
  Box,
  Typography,
  Grid,
  Paper,
  Stack,
  Button,
  Card,
  CardContent,
  Divider,
  Skeleton,
} from "@mui/material";

import {
  getReportData,
  getDepartmentComparison,
  getWindowAvailability,
} from "../api";
import { isDeptAdminUser, getDepartmentDisplayName } from "../utils/departments";

function Analytics({ department, user }) {
  const isDeptAdmin = isDeptAdminUser(user);
  const lockedDept = isDeptAdmin ? (user?.department || department || "Cashier") : (department ?? "Cashier");
  // selectedUnit controls whether Cashier or Registrar analytics are shown.
  // Default to the incoming `department` prop if provided, otherwise Cashier.
  const [selectedUnit, setSelectedUnit] = useState(() => lockedDept);

  useEffect(() => {
    if (isDeptAdmin) {
      setSelectedUnit(lockedDept);
    }
  }, [isDeptAdmin, lockedDept]);
  const [dashboard, setDashboard] = useState(null);
  const [ticketVolume, setTicketVolume] = useState(null);
  const [reportWindows, setReportWindows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [transactionAnalytics, setTransactionAnalytics] = useState(null);
  const [peakHoursData, setPeakHoursData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [busiestDay, setBusiestDay] = useState(null);
  const [configuredWindows, setConfiguredWindows] = useState([]);

  const [period, setPeriod] = useState("today");
  const [customStartDate, setCustomStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const latestRequestRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const activeRequestControllerRef = useRef(null);

  // Load analytics function (useCallback so it can be referenced by Retry).
  const loadAnalytics = useCallback(async (silent = false, signal = null) => {
    if (signal?.aborted || (period === 'custom' && (!customStartDate || !customEndDate || customStartDate > customEndDate))) return;
    if (silent && activeRequestControllerRef.current && !activeRequestControllerRef.current.signal.aborted) return;
    activeRequestControllerRef.current?.abort();
    const requestController = new AbortController();
    activeRequestControllerRef.current = requestController;
    const abortCurrentRequest = () => requestController.abort();
    if (signal) signal.addEventListener("abort", abortCurrentRequest, { once: true });

    const requestId = ++latestRequestRef.current;
    const isInitialLoad = !hasLoadedRef.current;
    if (!silent) setInitialLoading(isInitialLoad);
    if (!silent) setRefreshing(!isInitialLoad);
    if (!silent) setError(null);

    const sDate = period === "custom" ? customStartDate : null;
    const eDate = period === "custom" ? customEndDate : null;

    try {
      const updateIfCurrent = (update) => (value) => {
        if (requestId === latestRequestRef.current && !requestController.signal.aborted) update(value);
        return value;
      };
      const requests = [
        getWindowAvailability(requestController.signal).then(updateIfCurrent(value => setConfiguredWindows(previous => retainEqual(previous, value)))),
        getReportData(period, sDate, eDate, selectedUnit, requestController.signal).then(updateIfCurrent(value => {
          setDashboard(value.analytics.dashboard);
          setTicketVolume(value.analytics.ticket_volume ?? null);
          setTransactionAnalytics(value.analytics.transactions);
          setPeakHoursData(value.analytics.peak_hours);
          setCustomers(value.analytics.customers);
          setBusiestDay(value.analytics.busiest_day);
          setReportWindows(value.charts.windows);
        })),
        ...([getDepartmentComparison(period, sDate, eDate, selectedUnit, requestController.signal)
          .then(updateIfCurrent(value => setDepartments(value)))]),
      ];
      const results = await Promise.allSettled(requests);

      // A filter can change while a request is running. Ignore that stale response.
      if (requestId !== latestRequestRef.current || requestController.signal.aborted) return;

      const failures = results.filter((result) => result.status === "rejected" && result.reason?.name !== "AbortError");
      failures.forEach((result) => console.error("Analytics endpoint failed:", result.reason));
      if (!silent || failures.length === 0) setError(failures.length > 0 ? "Some analytics data could not be refreshed." : null);
      hasLoadedRef.current = results.some((result) => result.status === "fulfilled");
    } catch (err) {
      if (requestId !== latestRequestRef.current || requestController.signal.aborted) return;
      if (err?.name === "AbortError") return;
      console.error("Failed to load analytics data:", err);
      if (!silent) setError(err?.message || "Unable to load analytics data.");
    } finally {
      if (signal) signal.removeEventListener("abort", abortCurrentRequest);
      if (activeRequestControllerRef.current === requestController) {
        activeRequestControllerRef.current = null;
      }
      if (requestId === latestRequestRef.current) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, [period, customStartDate, customEndDate, selectedUnit]);

  // keep selectedUnit in sync if a `department` prop is provided/changes
  useEffect(() => {
    if (department && department !== selectedUnit) {
      setSelectedUnit(department);
    }
  }, [department]);

  useAdminPolling((signal, manual) => loadAnalytics(!manual, signal), `${period}:${customStartDate}:${customEndDate}:${selectedUnit}`, period !== 'custom' || Boolean(customStartDate && customEndDate && customStartDate <= customEndDate), 10000);

  const peakDistribution = peakHoursData?.distribution || [];
  const peakLabel = peakHoursData?.peak_hour_label || "No Peak Hour";
  const peakCount = peakHoursData?.peak_hour_count ?? 0;
  let departmentWindows = configuredWindows
    .filter((windowItem) => String(windowItem?.department || "").toLowerCase() === selectedUnit.toLowerCase())
    .map((windowItem) => {
      const configuredNumber = Number(windowItem.window_number);
      const displayNumber = selectedUnit === "Registrar" && configuredNumber >= 1 && configuredNumber <= 6
        ? configuredNumber + 8
        : configuredNumber;
      return { ...windowItem, displayNumber, analyticsNumber: configuredNumber };
    })
    .filter((windowItem) => selectedUnit === "Cashier"
      ? windowItem.displayNumber >= 1 && windowItem.displayNumber <= 3
      : ['ITM', 'Admission'].includes(selectedUnit) || (windowItem.displayNumber >= 9 && windowItem.displayNumber <= 13))
    .sort((a, b) => a.displayNumber - b.displayNumber);


  const windowPerformance = departmentWindows.map((windowItem) => {
    const analyticsRecord = reportWindows.find(item => item.label === `${selectedUnit} / Window ${windowItem.displayNumber}`);

    return {
      ...windowItem,
      customersServed: analyticsRecord?.completed ?? 0,
      averageWaitingTime: analyticsRecord?.average_waiting_time ?? null,
      averageServiceTime: analyticsRecord?.average_service_time ?? null,
      completionRate: analyticsRecord?.completion_rate ?? 0,
    };
  });

  const utilizationRows = departments.map(row => row.window_utilization)
    .filter(row => row && row.department.toLowerCase() === selectedUnit.toLowerCase())
    .sort((a, b) => a.window_number - b.window_number);
  const formatUtilizationMinutes = value => isMissingValue(value) || !Number.isFinite(Number(value))
    ? '0' : `${Number(Number(value).toFixed(2))} min`;

  return (
    <Box className="admin-standard-page analytics-admin-page" sx={{ mb: 2 }}>
          <Box className="analytics-page-header">
            <Typography variant="h4" fontWeight={800} sx={{ color: "#0f172a", lineHeight: 1.1 }}>
              Analytics
            </Typography>
            <Typography sx={{ mt: 0.5, color: "#64748b", fontSize: "0.98rem" }}>
              Monitor queue performance, service efficiency, transaction trends, and window performance.
            </Typography>
          </Box>

        {period === 'custom' && (!customStartDate || !customEndDate || customStartDate > customEndDate) && <Typography color="error">Select valid start and end dates; start must be on or before end.</Typography>}
        {refreshing && <Typography role="status" sx={{color: '#64748b'}}>Updating selected filters...</Typography>}
        {error && (
          <Paper sx={{ mb: 2, p: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap", boxShadow: "none", border: "1px solid #fecaca" }}>
            <Typography sx={{ color: "#b91c1c" }}>{error}</Typography>
            <Button variant="outlined" onClick={() => loadAnalytics(false)} disabled={initialLoading || refreshing}>
              Retry
            </Button>
          </Paper>
        )}

        <Box className="analytics-department-header" sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 3, flexWrap: "wrap" }}>
          <Box className="analytics-department-copy">
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.6 }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 2,
                  background: "linear-gradient(135deg, #1d4ed8, #0f172a)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: "1rem",
                  boxShadow: "0 10px 24px rgba(37,99,235,0.25)",
                }}
              >
                {selectedUnit === "Registrar" ? "🏢" : "💼"}
              </Box>
              <Typography variant="h5" fontWeight={700} sx={{ color: "#0f172a" }}>
                {`${getDepartmentDisplayName(selectedUnit)} Analytics`}
              </Typography>
            </Box>
            <Typography sx={{ color: "#64748b", fontSize: "0.95rem" }}>
              {`Showing performance data for ${getDepartmentDisplayName(selectedUnit)} Department`}
            </Typography>
            <Typography sx={{ mt: 0.5, color: "#374151", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {departmentWindows.length} Window{departmentWindows.length !== 1 ? "s" : ""}
            </Typography>
          </Box>

          {!isDeptAdmin ? (
            <Box className="analytics-department-switcher"
              sx={{
                display: "inline-flex",
                background: "#f8fafc",
                p: "4px",
                borderRadius: "14px",
                border: "1px solid #dfe7f1",
                boxShadow: "0 8px 18px rgba(15,23,42,0.04)",
              }}
            >
              <Button
                onClick={() => setSelectedUnit("Cashier")}
                sx={{
                  minWidth: 180,
                  borderRadius: "10px",
                  px: 2,
                  py: 1.2,
                  textTransform: "none",
                  fontWeight: 700,
                  background: selectedUnit === "Cashier" ? "#0f172a" : "transparent",
                  color: selectedUnit === "Cashier" ? "#fff" : "#475569",
                  boxShadow: selectedUnit === "Cashier" ? "0 8px 20px rgba(15,23,42,0.18)" : "none",
                  '&:hover': { background: selectedUnit === "Cashier" ? "#0f172a" : "#eef2ff" },
                }}
              >
                Cashier Analytics
              </Button>
              <Button
                onClick={() => setSelectedUnit("Registrar")}
                sx={{
                  minWidth: 180,
                  borderRadius: "10px",
                  px: 2,
                  py: 1.2,
                  textTransform: "none",
                  fontWeight: 700,
                  background: selectedUnit === "Registrar" ? "#0f172a" : "transparent",
                  color: selectedUnit === "Registrar" ? "#fff" : "#475569",
                  boxShadow: selectedUnit === "Registrar" ? "0 8px 20px rgba(15,23,42,0.18)" : "none",
                  '&:hover': { background: selectedUnit === "Registrar" ? "#0f172a" : "#eef2ff" },
                }}
              >
                Registrar Analytics
              </Button>
              <Button onClick={() => setSelectedUnit('ITM')} variant={selectedUnit === 'ITM' ? 'contained' : 'text'}>ITM Analytics</Button>
              <Button onClick={() => setSelectedUnit('Admission')} variant={selectedUnit === 'Admission' ? 'contained' : 'text'}>Admission Analytics</Button>
            </Box>
          ) : (
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                px: 2.5,
                py: 1.2,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "12px",
                color: "#166534",
                fontWeight: 700,
                fontSize: "0.95rem"
              }}
            >
              <span>🏢</span> {getDepartmentDisplayName(selectedUnit)}
            </Box>
          )}
        </Box>

        <Grid className="analytics-overview-grid" container spacing={2.2} sx={{ mb: 3 }}>
          {[
            { title: "Students Served", value: dashboard?.customers_served ?? 0, support: "Completed services", tone: "blue", accent: "#1d4ed8", icon: "👥" },
            { title: "Average Waiting Time", value: isMissingValue(dashboard?.average_waiting_time) ? '0' : `${dashboard.average_waiting_time}m`, support: "For selected period", tone: "orange", accent: "#f59e0b", icon: "⏱" },
            { title: "Average Service Time", value: isMissingValue(dashboard?.average_service_time) ? '0' : `${dashboard.average_service_time}m`, support: "Per completed ticket", tone: "green", accent: "#10b981", icon: "⏲" },
            { title: "Completion Rate", value: `${displayValue(dashboard?.completion_rate)}%`, support: "Completed / tickets issued", tone: "teal", accent: "#0d9488", icon: "◎" },
          ].map((kpi) => (
            <Grid item xs={12} sm={6} md={3} key={kpi.title}>
              <Box
                className={`analytics-kpi-card analytics-kpi-card--${kpi.tone}`}
                sx={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 3,
                  p: 2.2,
                  height: "100%",
                  boxShadow: "0 12px 24px rgba(15,23,42,0.04)",
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                  <Typography variant="body2" sx={{ color: "#475569", fontWeight: 700, letterSpacing: 0.2 }}>
                    {kpi.title}
                  </Typography>
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: `${kpi.accent}1a`,
                      color: kpi.accent,
                      fontSize: "1rem",
                    }}
                  >
                    {kpi.icon}
                  </Box>
                </Box>

                <Typography variant="h4" fontWeight={800} sx={{ color: "#0f172a", lineHeight: 1.1, letterSpacing: -0.5 }}>
                  {dashboard === null && initialLoading ? <Skeleton variant="text" width={100} /> : kpi.value}
                </Typography>
                <Typography className="analytics-kpi-support">{kpi.support}</Typography>

              </Box>
            </Grid>
          ))}
        </Grid>

        <Box className="analytics-filter-bar" sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {[
              { key: "today", label: "Today" },
              { key: "weekly", label: "7 Days" },
              { key: "monthly", label: "30 Days" },
              { key: "semester", label: "Semester" },
              { key: "custom", label: "Custom Range" },
            ].map((option) => (
              <Button
                className={`analytics-period-button ${period === option.key ? "is-active" : ""}`}
                key={option.key}
                onClick={() => setPeriod(option.key)}
                sx={{
                  minWidth: 90,
                  borderRadius: 2,
                  px: 1.5,
                  py: 0.9,
                  textTransform: "none",
                  fontWeight: 600,
                  border: "1px solid #dfe7f1",
                  background: period === option.key ? "#0f172a" : "#f8fafc",
                  color: period === option.key ? "#fff" : "#475569",
                  boxShadow: period === option.key ? "0 8px 18px rgba(15,23,42,0.12)" : "none",
                  '&:hover': { background: period === option.key ? "#0f172a" : "#eef2ff" },
                }}
              >
                {option.label}
              </Button>
            ))}
          </Stack>
        </Box>

        {period === "custom" && (
          <Box className="analytics-custom-range" sx={{ mb: 3 }}>
            <CalendarDateRange
              label="Analytics custom date range"
              start={customStartDate}
              end={customEndDate}
              onApply={(from, to) => { setCustomStartDate(from); setCustomEndDate(to) }}
            />
          </Box>
        )}

        <Box className="analytics-section" sx={{ mb: 4 }}>
          <Typography variant="h5" fontWeight={700} sx={{ color: '#0f172a', mb: 1 }}>Priority vs Regular Ticket Volume</Typography>
          <Typography sx={{ color: '#64748b', mb: 2 }}>Tickets issued for {selectedUnit} during the selected period, including all ticket statuses.</Typography>
          {ticketVolume === null ? (
            initialLoading || refreshing ? <Skeleton variant="rounded" height={180} /> : <Typography>Ticket volume is unavailable.</Typography>
          ) : (
            <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0' }} elevation={0}>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Total tickets: {ticketVolume.total}</Typography>
              {[
                { label: 'Priority', count: ticketVolume.priority, color: '#2563eb' },
                { label: 'Regular', count: ticketVolume.regular, color: '#f59e0b' },
              ].map(row => {
                const percentage = ticketVolume.total ? row.count / ticketVolume.total * 100 : 0;
                return <Box key={row.label} sx={{ mb: 2 }}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography sx={{ fontWeight: 600 }}>{row.label}</Typography>
                    <Typography>{row.count} {row.count === 1 ? 'ticket' : 'tickets'} ({percentage.toFixed(1)}%)</Typography>
                  </Stack>
                  <Box role="img" aria-label={`${row.label}: ${row.count} tickets, ${percentage.toFixed(1)} percent`} sx={{ height: 20, borderRadius: 2, bgcolor: '#eef2f7', overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${percentage}%`, bgcolor: row.color, borderRadius: 2 }} />
                  </Box>
                </Box>;
              })}
              {ticketVolume.total === 0 && <Typography sx={{ color: '#64748b' }}>No tickets were issued for the selected filters.</Typography>}
            </Paper>
          )}
        </Box>

        <Box className="analytics-section analytics-transaction-section" sx={{ mb: 4 }}>
          <Typography variant="h5" fontWeight={700} sx={{ color: "#0f172a", mb: 2 }}>
            {selectedUnit} Transaction Analytics
          </Typography>

          {transactionAnalytics === null && (initialLoading || refreshing) ? (
            <Stack spacing={2}>
              <Skeleton variant="rounded" height={150} />
              <Grid container spacing={2.2}>
                {[0, 1, 2].map((item) => (
                  <Grid item xs={12} md={4} key={item}>
                    <Skeleton variant="rounded" height={170} />
                  </Grid>
                ))}
              </Grid>
            </Stack>
          ) : !transactionAnalytics || transactionAnalytics.total_transactions === 0 ? (
            <Paper sx={{ p: 3, boxShadow: "none", border: "1px solid #e2e8f0", borderRadius: 3 }}>
              <Typography sx={{ color: "#64748b" }}>
                No transaction records available for the selected period.
              </Typography>
            </Paper>
          ) : (
            <>
              <Box className="analytics-top-transaction"
                sx={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 3,
                  p: 2.5,
                  mb: 2.2,
                  boxShadow: "0 12px 24px rgba(15,23,42,0.04)",
                }}
              >
                <Box className="analytics-card-heading-row">
                  <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 700 }}>Most Used Transaction</Typography>
                  <span className="analytics-top-badge">TOP TRANSACTION</span>
                </Box>
                <Typography variant="h4" fontWeight={800} sx={{ color: "#0f172a", mb: 1.5 }}>
                  {transactionAnalytics.most_used_transaction.type}
                </Typography>
                <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", gap: 1 }}>
                  <Typography sx={{ color: "#475569" }}>
                    <strong>{transactionAnalytics.most_used_transaction.count} Transactions</strong>
                  </Typography>
                  <Typography sx={{ color: "#475569" }}>
                    <strong>{transactionAnalytics.most_used_transaction.percentage}%</strong> of {selectedUnit} transactions
                  </Typography>
                  <Typography sx={{ color: "#475569" }}>
                    Average Per Day: <strong>{transactionAnalytics.most_used_transaction.average_per_day}</strong>
                  </Typography>
                </Stack>
              </Box>

              <Typography className="analytics-comparison-title" variant="h6">Transaction Type Comparison</Typography>
              <Grid className="analytics-transaction-grid" container spacing={2.2}>
                {transactionAnalytics.transactions.map((transaction) => {
                  const isTop = transaction.type === transactionAnalytics.most_used_transaction.type;
                  return (
                    <Grid item xs={12} md={4} key={`${selectedUnit}-${transaction.type}`}>
                      <Box className="analytics-transaction-card"
                        sx={{
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: 3,
                          p: 2.2,
                          height: "100%",
                          boxShadow: "0 12px 24px rgba(15,23,42,0.03)",
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 2 }}>
                          <Typography variant="h6" fontWeight={800} sx={{ color: "#0f172a" }}>
                            {transaction.type}
                          </Typography>
                          {isTop && (
                            <Typography
                              variant="caption"
                              sx={{ px: 1, py: 0.4, borderRadius: 1.5, fontWeight: 800, color: "#166534", background: "#dcfce7" }}
                            >
                              TOP
                            </Typography>
                          )}
                        </Box>
                        <div className="analytics-transaction-metrics">
                          <div><strong>{transaction.count}</strong><span>Total Transactions</span></div>
                          <div><strong>{transaction.percentage}%</strong><span>Share</span></div>
                          <div><strong>{transaction.average_per_day}</strong><span>Average / Day</span></div>
                        </div>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </>
          )}
        </Box>

        <Box className="analytics-section-heading" sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h5" fontWeight={700} sx={{ color: "#0f172a" }}>
            {selectedUnit ? `${selectedUnit} Window Performance Comparison` : "Window Performance Comparison"}
          </Typography>
        </Box>

        <Grid className="analytics-window-grid" container spacing={2.2} sx={{ mb: 4 }}>
          {windowPerformance.map((windowItem) => (
            <Grid item key={`${selectedUnit}-${windowItem.displayNumber}`} xs={12} sm={6} md={4}>
              <Box className="analytics-window-card"
                sx={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 3,
                  p: 2,
                  height: "100%",
                  boxShadow: "0 12px 24px rgba(15,23,42,0.03)",
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, mb: 2 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={800} sx={{ color: "#0f172a" }}>
                    {`Window ${windowItem.displayNumber}`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#64748b", letterSpacing: 1.2, fontWeight: 700 }}>
                      {selectedUnit.toUpperCase()}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      px: 1,
                      py: 0.4,
                      borderRadius: 1.5,
                      fontWeight: 800,
                      color: windowItem.is_available ? "#166534" : "#991b1b",
                      background: windowItem.is_available ? "#dcfce7" : "#fee2e2",
                    }}
                  >
                    {windowItem.is_available ? "ACTIVE" : "CLOSED"}
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 1.5 }}>
                  <Typography variant="body2" sx={{ color: "#64748b" }}>Completed Tickets</Typography>
                  <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a" }}>
                    {departments.length === 0 && initialLoading ? <Skeleton variant="text" width={80} /> : windowItem.customersServed}
                  </Typography>
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: "#64748b" }}>Avg. Waiting</Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ color: "#0f172a" }}>
                    {departments.length === 0 && initialLoading ? <Skeleton variant="text" width={60} /> : isMissingValue(windowItem.averageWaitingTime) ? '0' : `${windowItem.averageWaitingTime} min`}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: "#64748b" }}>Avg. Service</Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ color: "#0f172a" }}>
                    {departments.length === 0 && initialLoading ? <Skeleton variant="text" width={60} /> : isMissingValue(windowItem.averageServiceTime) ? '0' : `${windowItem.averageServiceTime} min`}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mt: 1.5, borderTop: "1px solid #e2e8f0", pt: 1.5 }}>
                  <Typography variant="caption" sx={{ color: "#64748b" }}>Completion Rate</Typography>
                  <Typography variant="body2" sx={{ color: "#10b981", fontWeight: 700 }}>{departments.length === 0 && initialLoading ? <Skeleton variant="text" width={40} /> : `${windowItem.completionRate}%`}</Typography>
                </Box>
              </Box>
            </Grid>
          ))}
          {configuredWindows.length > 0 && windowPerformance.length === 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 3, textAlign: "center", color: "#64748b", background: "#f8fafc", boxShadow: "none", border: "1px solid #e2e8f0", borderRadius: 3 }}>
                No configured {selectedUnit} windows found.
              </Paper>
            </Grid>
          )}
        </Grid>

        {/* Peak Hours */}
        <Typography className="analytics-section-title" variant="h5" fontWeight="bold" sx={{ mb: 3, color: "#071b4d" }}>
          Peak Hours
        </Typography>

        <Card className="analytics-chart-section analytics-peak-section" elevation={0} sx={{ mb: 5, borderRadius: 3, background: 'transparent', boxShadow: 'none' }}>
          <CardContent>
            <Typography className="analytics-section-subtitle">Hourly queue activity for the selected period</Typography>
            {initialLoading ? (
              <Box sx={{ mb: 3 }}>
                <Skeleton variant="rectangular" height={28} width={240} />
                <Box sx={{ mt: 2 }}><Skeleton variant="rectangular" height={120} /></Box>
              </Box>
            ) : peakCount > 0 && (
              <Box className="analytics-peak-highlight"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  mb: 3,
                  p: 2,
                  borderRadius: 2,
                  background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
                  border: "1px solid #fed7aa",
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "#ed6c02",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: "1.2rem",
                    fontWeight: "bold",
                    flexShrink: 0,
                  }}
                >
                  🔥
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight="bold" sx={{ color: "#7c2d12" }}>
                    Busiest Peak Hour: {peakLabel}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#9a3412" }}>
                    {peakCount} ticket{peakCount !== 1 ? "s" : ""} processed during peak
                  </Typography>
                </Box>
              </Box>
            )}

            <Typography variant="subtitle2" sx={{ mb: 2, color: "#475569" }}>
              Hourly Traffic Distribution (24 Hours)
            </Typography>

            {initialLoading ? (
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', minHeight: 120 }}>
                <Skeleton variant="rectangular" width="100%" height={120} />
              </Box>
            ) : (
              <Box className="analytics-hourly-chart" sx={{ display: "flex", gap: 0.5, alignItems: "flex-end", minHeight: 120, overflowX: "auto", pb: 1 }}>
                {peakDistribution.map((item) => {
                const maxCount = Math.max(...peakDistribution.map((d) => d.count || d.total || 0), 1);
                const count = item.count ?? item.total ?? 0;
                const heightPercent = (count / maxCount) * 100;
                const isPeak = count > 0 && count === peakCount;

                return (
                  <Box className="analytics-hourly-bar-track"
                    key={item.hour}
                    sx={{
                      flex: 1,
                      minWidth: 24,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 0.5,
                    }}
                  >
                    <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.65rem", fontWeight: isPeak ? 700 : 400 }}>
                      {count > 0 ? count : ''}
                    </Typography>
                    <Box
                      sx={{
                        width: "100%",
                        maxWidth: 28,
                        height: 90,
                        borderRadius: "4px 4px 0 0",
                        background: "#e2e8f0",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: `${Math.max(heightPercent, count > 0 ? 6 : 0)}%`,
                          borderRadius: "4px 4px 0 0",
                          background: isPeak
                            ? "linear-gradient(180deg, #ed6c02, #c75100)"
                            : "linear-gradient(180deg, #90caf9, #42a5f5)",
                          transition: "height 0.3s ease",
                        }}
                      />
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#475569",
                        fontWeight: isPeak ? 700 : 400,
                        fontSize: "0.6rem",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}
          </CardContent>
        </Card>

        {/* Busiest Day of the Week */}
        <Typography className="analytics-section-title" variant="h5" fontWeight="bold" sx={{ mb: 3, color: "#071b4d" }}>
          Busiest Day of the Week
        </Typography>

        <Card className="analytics-chart-section analytics-daily-card" elevation={0} sx={{ mb: 5, borderRadius: 3, background: 'transparent', boxShadow: 'none' }}>
          <CardContent>
            {initialLoading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Skeleton variant='rectangular' height={40} width={300} />
                <Skeleton variant='rectangular' height={140} />
              </Box>
            ) : busiestDay && busiestDay.total_completed > 0 ? (
              <Box>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    mb: 3,
                    p: 2,
                    borderRadius: 2,
                    background: "linear-gradient(135deg, #e8f4fd 0%, #f0f8ff 100%)",
                    border: "1px solid #b3d9f2",
                  }}
                >
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: "#1976d2",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: "1.5rem",
                      fontWeight: "bold",
                      flexShrink: 0,
                    }}
                  >
                    {busiestDay.busiest_day?.charAt(0) || "?"}
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight="bold" sx={{ color: "#071b4d" }}>
                      {busiestDay.busiest_day || "No data available"}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#475569" }}>
                      {busiestDay.busiest_day_count} completed transaction{busiestDay.busiest_day_count !== 1 ? "s" : ""}
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="subtitle2" sx={{ mb: 2, color: "#475569" }}>
                  Distribution Across Days
                </Typography>
                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end", minHeight: 120 }}>
                  {busiestDay.distribution.map((item) => {
                    const maxCount = Math.max(...busiestDay.distribution.map((d) => d.count), 1);
                    const heightPercent = (item.count / maxCount) * 100;
                    const isBusiest = item.day_name === busiestDay.busiest_day && item.count > 0;
                    return (
                      <Box
                        key={item.day_number}
                        sx={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        <Typography variant="caption" sx={{ color: "#475569", fontWeight: isBusiest ? 700 : 400 }}>
                          {item.count}
                        </Typography>
                        <Box
                          sx={{
                            width: "100%",
                            maxWidth: 40,
                            height: 100,
                            borderRadius: "6px 6px 0 0",
                            background: "#e2e8f0",
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          <Box
                            sx={{
                              position: "absolute",
                              bottom: 0,
                              left: 0,
                              right: 0,
                              height: `${Math.max(heightPercent, item.count > 0 ? 4 : 0)}%`,
                              borderRadius: "6px 6px 0 0",
                              background: isBusiest
                                ? "linear-gradient(180deg, #1976d2, #1565c0)"
                                : "linear-gradient(180deg, #90caf9, #64b5f6)",
                              transition: "height 0.3s ease",
                            }}
                          />
                        </Box>
                        <Typography
                          variant="caption"
                          sx={{
                            color: "#475569",
                            fontWeight: isBusiest ? 700 : 400,
                            fontSize: "0.65rem",
                            textAlign: "center",
                          }}
                        >
                          {item.day_name.substring(0, 3)}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            ) : (
              <Typography className="analytics-empty-state" sx={{ color: "#64748b" }}>No day distribution data available for this period.</Typography>
            )}
          </CardContent>
        </Card>

        {/* Customers Served Per Day */}
        <Typography className="analytics-section-title" variant="h5" fontWeight="bold" sx={{ mb: 3, color: "#071b4d" }}>
          Completed Tickets by Creation Day
        </Typography>

        <Card className="analytics-chart-section analytics-daily-card" elevation={0} sx={{ mb: 5, borderRadius: 3, background: 'transparent', boxShadow: 'none' }}>
          <CardContent>
            <Typography className="analytics-section-subtitle">Completed students during the selected period</Typography>
            {initialLoading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Skeleton variant='rectangular' height={40} width={300} />
                <Skeleton variant='rectangular' height={160} />
              </Box>
            ) : customers && customers.length > 0 ? (
              <Box>
                {/* Bar Chart */}
                <Box className="analytics-daily-chart" sx={{ display: "flex", gap: 1, alignItems: "flex-end", minHeight: 160, mb: 2, overflowX: "auto", pb: 1 }}>
                  {customers.map((item) => {
                    const maxCount = Math.max(...customers.map((d) => d.customers_served), 1);
                    const heightPercent = (item.customers_served / maxCount) * 100;
                    return (
                      <Box className="analytics-daily-bar-track"
                        key={item.date}
                        sx={{
                          flex: 1,
                          minWidth: 40,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        <Typography variant="caption" sx={{ color: "#475569", fontWeight: 600 }}>
                          {item.customers_served}
                        </Typography>
                        <Box
                          sx={{
                            width: "100%",
                            maxWidth: 50,
                            height: 120,
                            borderRadius: "6px 6px 0 0",
                            background: "#e2e8f0",
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          <Box
                            sx={{
                              position: "absolute",
                              bottom: 0,
                              left: 0,
                              right: 0,
                              height: `${Math.max(heightPercent, item.customers_served > 0 ? 4 : 0)}%`,
                              borderRadius: "6px 6px 0 0",
                              background: "linear-gradient(180deg, #2e7d32, #1b5e20)",
                              transition: "height 0.3s ease",
                            }}
                          />
                        </Box>
                        <Typography
                          variant="caption"
                          sx={{
                            color: "#475569",
                            fontSize: "0.6rem",
                            textAlign: "center",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.label}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>

                {/* Summary */}
                <Typography variant="body2" sx={{ color: "#475569", mt: 1 }}>
                  Total completed tickets in this period:{" "}
                  <strong>{customers.reduce((sum, d) => sum + d.customers_served, 0)}</strong>
                </Typography>
              </Box>
            ) : (
              <Typography className="analytics-empty-state" sx={{ color: "#64748b" }}>No daily ticket data available for this period.</Typography>
            )}
          </CardContent>
        </Card>

        {/* Window Utilization */}
        <Typography className="analytics-section-title" variant="h5" fontWeight="bold" sx={{ mb: 2, color: "#071b4d" }}>
          Window Utilization
        </Typography>

        <Card className="analytics-utilization-card" elevation={0} sx={{ mb: 6, borderRadius: 3, background: 'transparent', boxShadow: 'none' }}>
          <CardContent>
            {initialLoading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Skeleton variant='rectangular' height={40} width='60%' />
                <Skeleton variant='rectangular' height={200} />
              </Box>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Box className="analytics-utilization-head" sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 2, alignItems: 'center', borderBottom: '1px solid #eef2f7', pb: 1, mb: 1 }}>
                  <Typography variant='caption' sx={{ color: '#64748b', fontWeight: 700 }}>Window</Typography>
                  <Typography variant='caption' sx={{ color: '#64748b', fontWeight: 700 }}>Department</Typography>
                  <Typography variant='caption' sx={{ color: '#64748b', fontWeight: 700 }}>Tickets Handled</Typography>
                  <Typography variant='caption' sx={{ color: '#64748b', fontWeight: 700 }}>Active Time</Typography>
                  <Typography variant='caption' sx={{ color: '#64748b', fontWeight: 700 }}>Idle Time</Typography>
                  <Typography variant='caption' sx={{ color: '#64748b', fontWeight: 700 }}>Avg Service Time</Typography>
                  <Typography variant='caption' sx={{ color: '#64748b', fontWeight: 700 }}>Utilization Rate</Typography>
                </Box>

                {utilizationRows.map((w) => (
                  <Box className="analytics-utilization-row" key={`util-${w.window_number}`} sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 2, alignItems: 'center', py: 1, borderBottom: '1px solid #f5f7fb' }}>
                    <Typography variant='subtitle2' sx={{ color: '#0f172a', fontWeight: 800 }}>Window {w.window_number}</Typography>
                    <Typography variant='body2' sx={{ color: '#0f172a' }}>{selectedUnit}</Typography>
                    <Typography variant='body2' sx={{ color: '#0f172a' }}>{w.tickets_handled ?? 0}</Typography>
                    <Typography variant='body2' sx={{ color: '#0f172a' }}>{formatUtilizationMinutes(w.active_minutes)}</Typography>
                    <Typography variant='body2' sx={{ color: '#0f172a' }}>{formatUtilizationMinutes(w.idle_minutes)}</Typography>
                    <Typography variant='body2' sx={{ color: '#0f172a' }}>{formatUtilizationMinutes(w.avg_service_minutes)}</Typography>
                    <Typography variant='body2' sx={{ color: '#64748b' }}>{`${displayValue(w.utilizationRate)}%`}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
  );
}

export default Analytics;
