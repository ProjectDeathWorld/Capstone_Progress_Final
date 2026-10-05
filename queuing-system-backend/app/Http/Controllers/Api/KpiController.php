<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KpiMonitoring;
use App\Models\ServiceTransaction;
use App\Models\QueueTicket;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Services\WaitingTime;

class KpiController extends Controller
{
    private function durationMinutesSql(string $startColumn, string $endExpression): string
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return "((julianday({$endExpression}) - julianday({$startColumn})) * 1440.0)";
        }

        return "(TIMESTAMPDIFF(SECOND, {$startColumn}, {$endExpression}) / 60.0)";
    }

    private function hourSql(string $column): string
    {
        return DB::connection()->getDriverName() === 'sqlite'
            ? "CAST(strftime('%H', {$column}) AS INTEGER)"
            : "HOUR({$column})";
    }

    private function dayOfWeekSql(string $column): string
    {
        return DB::connection()->getDriverName() === 'sqlite'
            ? "(CAST(strftime('%w', {$column}) AS INTEGER) + 1)"
            : "DAYOFWEEK({$column})";
    }

    
    public function generateKpi(Request $request)
    {
        $request->validate([
            'staff_id' => 'required|exists:users,user_id',
            'date_range_start' => 'required|date',
            'date_range_end' => 'required|date|after_or_equal:date_range_start'
        ]);

        $transactions = ServiceTransaction::where('staff_id', $request->staff_id)
            ->whereBetween('start_time', [$request->date_range_start, $request->date_range_end])
            ->get();

        $totalTransactions = $transactions->count();
        $avgServiceTime = $transactions->avg('duration_seconds');

        $excellentCount = $transactions->where('performance_rating', 'Excellent')->count();
        $verygoodCount = $transactions->where('performance_rating', 'Very Good')->count();
        $goodCount = $transactions->where('performance_rating', 'Good')->count();
        $fairCount = $transactions->where('performance_rating', 'Fair')->count();
        $poorCount = $transactions->where('performance_rating', 'Poor')->count();

        
        $kpiScore = 0;
        if ($totalTransactions > 0) {
            $kpiScore = (
                ($excellentCount * 5) +
                ($verygoodCount * 4) +
                ($goodCount * 3) +
                ($fairCount * 2) +
                ($poorCount * 1)
            ) / $totalTransactions;
        }

        $kpi = KpiMonitoring::create([
            'staff_id' => $request->staff_id,
            'date_range_start' => $request->date_range_start,
            'date_range_end' => $request->date_range_end,
            'total_transactions' => $totalTransactions,
            'avg_service_time' => round($avgServiceTime, 2),
            'excellent_count' => $excellentCount,
            'verygood_count' => $verygoodCount,
            'good_count' => $goodCount,
            'fair_count' => $fairCount,
            'poor_count' => $poorCount,
            'kpi_score' => round($kpiScore, 2)
        ]);

        return response()->json([
            'message' => 'KPI generated successfully',
            'kpi' => $kpi
        ], 201);
    }

    
    public function index()
    {
        $kpis = KpiMonitoring::with('staff')->get();
        return response()->json($kpis);
    }

    
    public function getByStaff($staffId)
    {
        $kpis = KpiMonitoring::where('staff_id', $staffId)
            ->orderBy('date_range_start', 'desc')
            ->get();

        return response()->json($kpis);
    }

    
    protected function parseDateRange(Request $request)
    {
        return \App\Services\WindowUtilization::dateRange($request);
    }

    public function getTransactionAnalytics(Request $request)
    {
        $validated = $request->validate([
            'department' => 'required|in:Cashier,Registrar,ITM,Admission,cashier,registrar,itm,admission',
            'period' => 'nullable|in:today,week,weekly,month,monthly,semester,custom',
            'start_date' => 'nullable|date|required_if:period,custom',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        $currentUser = $request->user('sanctum') ?? $request->user();
        if ($currentUser?->isDeptAdmin()) {
            $userDept = $currentUser->department;
            $reqDept = \App\Services\Departments::name($validated['department']);
            abort_unless($reqDept === $userDept, 403, 'Access denied to other departments.');
        }

        $department = strtolower($validated['department']);
        $period = strtolower($validated['period'] ?? 'today');
        $endDate = Carbon::now()->endOfDay();

        if ($period === 'custom') {
            $startDate = Carbon::parse($validated['start_date'])->startOfDay();
            $endDate = Carbon::parse($validated['end_date'] ?? $validated['start_date'])->endOfDay();
        } elseif (in_array($period, ['week', 'weekly'], true)) {
            $startDate = Carbon::today()->subDays(6)->startOfDay();
        } elseif (in_array($period, ['month', 'monthly'], true)) {
            $startDate = Carbon::today()->subDays(29)->startOfDay();
        } elseif ($period === 'semester') {
            $startDate = Carbon::today()->subMonths(6)->startOfDay();
        } else {
            $startDate = Carbon::today()->startOfDay();
        }

        $serviceTypes = \App\Services\Departments::types($department);
        $transactionTypes = match ($department) {
            'cashier' => ['Payment', 'Clearance', 'Others'],
            'registrar' => ['Document Request', 'Clearance', 'Others'],
            default => [\App\Services\Departments::name($department).' Service'],
        };

        $counts = QueueTicket::query()
            ->whereIn('service_type', $serviceTypes)
            ->whereIn('status', ['done', 'Completed', 'completed'])
            ->whereIn('transaction_type', $transactionTypes)
            ->whereBetween('completed_at', [$startDate, $endDate])
            ->select('transaction_type')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('transaction_type')
            ->pluck('total', 'transaction_type');

        $totalTransactions = (int) $counts->sum();
        $days = max(1, $startDate->copy()->startOfDay()->diffInDays($endDate->copy()->startOfDay()) + 1);
        $transactions = collect($transactionTypes)->map(function ($type) use ($counts, $totalTransactions, $days) {
            $count = (int) ($counts[$type] ?? 0);

            return [
                'type' => $type,
                'count' => $count,
                'percentage' => $totalTransactions > 0 ? round(($count / $totalTransactions) * 100, 2) : 0,
                'average_per_day' => round($count / $days, 2),
            ];
        })->values();

        $mostUsed = $totalTransactions > 0
            ? $transactions->sortByDesc('count')->first()
            : null;

        return response()->json([
            'department' => $department,
            'period' => $period,
            'total_transactions' => $totalTransactions,
            'most_used_transaction' => $mostUsed,
            'transactions' => $transactions,
        ]);
    }

    public function getDepartmentComparison(Request $request)
    {
        [$startDate, $endDate] = $this->parseDateRange($request);
        $currentUser = $request->user('sanctum') ?? $request->user();
        if ($currentUser?->isDeptAdmin()) {
            $userDept = $currentUser->department;
            if ($request->filled('department')) {
                $reqDept = match (strtolower((string) $request->query('department'))) {
                    'cashier' => 'Cashier', 'registrar' => 'Registrar', 'itm' => 'ITM', 'admission' => 'Admission', default => $request->query('department'),
                };
                abort_unless($reqDept === $userDept, 403, 'Access denied to other departments.');
            }
            $department = $userDept;
        } else {
            $department = match (strtolower((string) $request->query('department'))) {
                'cashier' => 'Cashier', 'registrar' => 'Registrar', 'itm' => 'ITM', 'admission' => 'Admission', default => $request->query('department'),
            };
        }
        $waitingDurationSql = $this->durationMinutesSql('created_at', 'called_at');
        $serviceDurationSql = $this->durationMinutesSql('called_at', 'completed_at');

        $results = [];

        if ($department === 'Registrar') {
            // Compare 6 Registrar windows: Registrar 1 to Registrar 6
            for ($w = 1; $w <= 6; $w++) {
                $completed = QueueTicket::where(function ($q) {
                        $q->where('service_type', 'R')->orWhere('service_type', 'RT');
                    })
                    ->where(function ($q) use ($w) {
                        $q->where('window', $w)->orWhere('window', $w + 8);
                    })
                    ->whereIn('status', ['done', 'Completed', 'completed'])
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->count();

                $avgWaitingRow = QueueTicket::where(function ($q) {
                        $q->where('service_type', 'R')->orWhere('service_type', 'RT');
                    })
                    ->where(function ($q) use ($w) {
                        $q->where('window', $w)->orWhere('window', $w + 8);
                    })
                    ->whereIn('status', ['done', 'Completed', 'completed'])
                    ->whereNotNull('created_at')
                    ->whereNotNull('called_at')
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->selectRaw("AVG({$waitingDurationSql}) as avg_waiting_minutes")
                    ->first();

                $avgWaitingTime = $avgWaitingRow && $avgWaitingRow->avg_waiting_minutes !== null
                    ? round((float) $avgWaitingRow->avg_waiting_minutes, 2)
                    : 0;

                $avgServiceRow = QueueTicket::where(function ($q) {
                        $q->where('service_type', 'R')->orWhere('service_type', 'RT');
                    })
                    ->where(function ($q) use ($w) {
                        $q->where('window', $w)->orWhere('window', $w + 8);
                    })
                    ->whereIn('status', ['done', 'Completed', 'completed'])
                    ->whereNotNull('called_at')
                    ->whereNotNull('completed_at')
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->selectRaw("AVG({$serviceDurationSql}) as avg_service_minutes")
                    ->first();

                $avgServiceTime = $avgServiceRow && $avgServiceRow->avg_service_minutes !== null
                    ? round((float) $avgServiceRow->avg_service_minutes, 2)
                    : 0;

                $results[] = [
                    'department' => "Registrar {$w}",
                    'customers_served' => $completed,
                    'average_waiting_time' => $avgWaitingTime,
                    'average_service_time' => $avgServiceTime,
                ];
            }
        } elseif ($department === 'Cashier') {
            // Compare 3 Cashier windows: Cashier 1 to Cashier 3
            for ($w = 1; $w <= 3; $w++) {
                $queryWindow = function ($q) use ($w) {
                    $q->where('window', $w);
                    if ($w === 1) {
                        $q->orWhereNull('window');
                    }
                };

                $completed = QueueTicket::where(function ($q) {
                        $q->where('service_type', 'C')->orWhere('service_type', 'CS');
                    })
                    ->where($queryWindow)
                    ->whereIn('status', ['done', 'Completed', 'completed'])
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->count();

                $avgWaitingRow = QueueTicket::where(function ($q) {
                        $q->where('service_type', 'C')->orWhere('service_type', 'CS');
                    })
                    ->where($queryWindow)
                    ->whereIn('status', ['done', 'Completed', 'completed'])
                    ->whereNotNull('created_at')
                    ->whereNotNull('called_at')
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->selectRaw("AVG({$waitingDurationSql}) as avg_waiting_minutes")
                    ->first();

                $avgWaitingTime = $avgWaitingRow && $avgWaitingRow->avg_waiting_minutes !== null
                    ? round((float) $avgWaitingRow->avg_waiting_minutes, 2)
                    : 0;

                $avgServiceRow = QueueTicket::where(function ($q) {
                        $q->where('service_type', 'C')->orWhere('service_type', 'CS');
                    })
                    ->where($queryWindow)
                    ->whereIn('status', ['done', 'Completed', 'completed'])
                    ->whereNotNull('called_at')
                    ->whereNotNull('completed_at')
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->selectRaw("AVG({$serviceDurationSql}) as avg_service_minutes")
                    ->first();

                $avgServiceTime = $avgServiceRow && $avgServiceRow->avg_service_minutes !== null
                    ? round((float) $avgServiceRow->avg_service_minutes, 2)
                    : 0;

                $results[] = [
                    'department' => "Cashier {$w}",
                    'customers_served' => $completed,
                    'average_waiting_time' => $avgWaitingTime,
                    'average_service_time' => $avgServiceTime,
                ];
            }
        } else {
            // General Department mode (Cashier vs Registrar)
            foreach (['C', 'R'] as $st) {
                $deptName = $st === 'C' ? 'Cashier' : 'Registrar';

                $completedTransactions = QueueTicket::where(function ($q) use ($st) {
                        if ($st === 'C') {
                            $q->where('service_type', 'C')->orWhere('service_type', 'CS');
                        } else {
                            $q->where('service_type', 'R')->orWhere('service_type', 'RT');
                        }
                    })
                    ->whereIn('status', ['done', 'Completed', 'completed'])
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->count();

                $avgWaitingRow = QueueTicket::where(function ($q) use ($st) {
                        if ($st === 'C') {
                            $q->where('service_type', 'C')->orWhere('service_type', 'CS');
                        } else {
                            $q->where('service_type', 'R')->orWhere('service_type', 'RT');
                        }
                    })
                    ->whereIn('status', ['done', 'Completed', 'completed'])
                    ->whereNotNull('created_at')
                    ->whereNotNull('called_at')
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->selectRaw("AVG({$waitingDurationSql}) as avg_waiting_minutes")
                    ->first();

                $avgWaitingTime = $avgWaitingRow && $avgWaitingRow->avg_waiting_minutes !== null
                    ? round((float) $avgWaitingRow->avg_waiting_minutes, 2)
                    : 0;

                $avgServiceRow = QueueTicket::where(function ($q) use ($st) {
                        if ($st === 'C') {
                            $q->where('service_type', 'C')->orWhere('service_type', 'CS');
                        } else {
                            $q->where('service_type', 'R')->orWhere('service_type', 'RT');
                        }
                    })
                    ->whereIn('status', ['done', 'Completed', 'completed'])
                    ->whereNotNull('called_at')
                    ->whereNotNull('completed_at')
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->selectRaw("AVG({$serviceDurationSql}) as avg_service_minutes")
                    ->first();

                $avgServiceTime = $avgServiceRow && $avgServiceRow->avg_service_minutes !== null
                    ? round((float) $avgServiceRow->avg_service_minutes, 2)
                    : 0;

                $results[] = [
                    'department' => $deptName,
                    'customers_served' => $completedTransactions,
                    'average_waiting_time' => $avgWaitingTime,
                    'average_service_time' => $avgServiceTime,
                ];
            }

            // ITM is a separate ticket service, independent of the staff account/position.
            // Match the existing office date scope and completed-ticket duration semantics.
            foreach (['ITM' => 'ITM', 'Admission' => 'ADM'] as $office => $type) {
            $itm = QueueTicket::whereRaw('UPPER(service_type) = ?', [$type])
                ->whereBetween('created_at', [$startDate, $endDate])
                ->selectRaw("SUM(CASE WHEN LOWER(status) = 'waiting' THEN 1 ELSE 0 END) as waiting")
                ->selectRaw("SUM(CASE WHEN LOWER(status) IN ('done', 'completed') THEN 1 ELSE 0 END) as completed")
                ->selectRaw("AVG(CASE WHEN LOWER(status) IN ('done', 'completed') THEN {$waitingDurationSql} END) as average_waiting")
                ->selectRaw("AVG(CASE WHEN LOWER(status) IN ('done', 'completed') THEN {$serviceDurationSql} END) as average_service")
                ->first();
            $results[] = [
                'department' => $office,
                'waiting' => (int) ($itm->waiting ?? 0),
                'customers_served' => (int) ($itm->completed ?? 0),
                'average_waiting_time' => round((float) ($itm->average_waiting ?? 0), 2),
                'average_service_time' => round((float) ($itm->average_service ?? 0), 2),
            ];
            }
            if (in_array($department, ['ITM', 'Admission'], true)) {
                $results = array_values(array_filter($results, fn ($row) => $row['department'] === $department));
            }
        }

        if (in_array($department, ['Cashier', 'Registrar'], true)) {
            $utilization = collect(app(\App\Services\WindowUtilization::class)->summarize($request, $department))
                ->keyBy('window_number');
            foreach ($results as &$row) {
                preg_match('/(\d+)$/', $row['department'], $match);
                $number = (int) ($match[1] ?? 0) + ($department === 'Registrar' ? 8 : 0);
                $row['window_utilization'] = $utilization->get($number);
            }
            unset($row);
        }
        return response()->json($results);
    }

    public function getDashboardAnalytics(Request $request)
    {
        [$startDate, $endDate] = $this->parseDateRange($request);
        $currentUser = $request->user('sanctum') ?? $request->user();
        if ($currentUser?->isDeptAdmin()) {
            $userDept = $currentUser->department;
            if ($request->filled('department')) {
                $reqDept = \App\Services\Departments::name($request->query('department'));
                abort_unless($reqDept === $userDept, 403, 'Access denied to other departments.');
            }
            $department = $userDept;
        } else {
            $department = $request->query('department');
        }

        // Historical KPIs follow the selected date range. Live queue counts must
        // include active tickets carried over from an earlier day.
        $baseQuery = QueueTicket::whereBetween('created_at', [$startDate, $endDate]);
        $liveQuery = QueueTicket::query();
        if ($department) {
            $departmentFilter = function ($q) use ($department) {
                $q->whereIn('service_type', \App\Services\Departments::types($department));
            };
            $baseQuery->where($departmentFilter);
            $liveQuery->where($departmentFilter);
        }

        // Queue Counts using the same database records and status values used by staff actions.
        $waitingStatuses = ['waiting', 'Waiting'];
        $servingStatuses = ['serving', 'Serving', 'called', 'Called'];
        $completedStatuses = ['done', 'Completed', 'completed'];
        $cancelledStatuses = ['cancelled', 'Cancelled', 'skipped', 'Skipped', 'no-show', 'No-Show', 'no_show', 'noshow', 'NoShow'];
        $waitingDurationSql = $this->durationMinutesSql('created_at', 'called_at');
        $serviceDurationSql = $this->durationMinutesSql('called_at', 'completed_at');
        $turnaroundDurationSql = $this->durationMinutesSql('created_at', 'completed_at');

        // Calculate period statistics from period tickets. Waiting duration ends
        // at called_at; it never continues growing after a ticket is called.
        $stats = (clone $baseQuery)->selectRaw("
            COUNT(*) AS total_tickets,
            SUM(CASE WHEN status IN ('waiting', 'Waiting') THEN 1 ELSE 0 END) AS waiting_tickets,
            SUM(CASE WHEN status IN ('serving', 'Serving', 'called', 'Called') THEN 1 ELSE 0 END) AS serving_tickets,
            SUM(CASE WHEN status IN ('done', 'Completed', 'completed') THEN 1 ELSE 0 END) AS completed_tickets,
            SUM(CASE WHEN status IN ('cancelled', 'Cancelled', 'skipped', 'Skipped', 'no-show', 'No-Show', 'no_show', 'noshow', 'NoShow') THEN 1 ELSE 0 END) AS cancelled_tickets,
            AVG(CASE WHEN status IN ('done', 'Completed', 'completed') AND created_at IS NOT NULL AND called_at IS NOT NULL AND called_at >= created_at THEN {$waitingDurationSql} END) AS average_waiting_time,
            AVG(CASE WHEN status IN ('done', 'Completed', 'completed') AND called_at IS NOT NULL AND completed_at IS NOT NULL THEN {$serviceDurationSql} END) AS average_service_time,
            AVG(CASE WHEN status IN ('done', 'Completed', 'completed') AND completed_at IS NOT NULL THEN {$turnaroundDurationSql} END) AS turnaround_time
        ")->first();

        $liveStats = (clone $liveQuery)->selectRaw("
            SUM(CASE WHEN status IN ('waiting', 'Waiting') THEN 1 ELSE 0 END) AS waiting_tickets,
            SUM(CASE WHEN status IN ('serving', 'Serving', 'called', 'Called') THEN 1 ELSE 0 END) AS serving_tickets
        ")->first();

        $totalTickets = (int) ($stats->total_tickets ?? 0);
        $waitingTickets = (int) ($liveStats->waiting_tickets ?? 0);
        $servingTickets = (int) ($liveStats->serving_tickets ?? 0);
        $completedTickets = (int) ($stats->completed_tickets ?? 0);
        $cancelledTickets = (int) ($stats->cancelled_tickets ?? 0);
        $averageWaitingTime = round((float) ($stats->average_waiting_time ?? 0), 2);
        $averageServiceTime = round((float) ($stats->average_service_time ?? 0), 2);
        $turnaroundTime = round((float) ($stats->turnaround_time ?? 0), 2);
        $periodTickets = (clone $baseQuery)->get(['created_at', 'called_at', 'status']);
        $longestWaitingMinutes = $periodTickets->map(function ($ticket) {
            $status = strtolower((string) $ticket->status);
            $calledAt = in_array($status, ['waiting'], true) ? null : $ticket->called_at;

            return WaitingTime::minutes($ticket->created_at, $calledAt);
        })->filter(fn ($minutes) => $minutes !== null)->max() ?? 0;
        $longestWaitingTime = round((float) $longestWaitingMinutes, 2);

        $validWaitingSql = "queue_tickets.created_at IS NOT NULL
            AND queue_tickets.called_at IS NOT NULL
            AND queue_tickets.called_at >= queue_tickets.created_at";
        $validServiceSql = "queue_tickets.called_at IS NOT NULL
            AND queue_tickets.completed_at IS NOT NULL
            AND queue_tickets.completed_at >= queue_tickets.called_at";
        $staffServiceDurationSql = $this->durationMinutesSql(
            'queue_tickets.called_at',
            'queue_tickets.completed_at'
        );
        $staffWaitingDurationSql = $this->durationMinutesSql(
            'queue_tickets.created_at',
            'queue_tickets.called_at'
        );
        $staffPerformanceAggregate = ServiceTransaction::query()
            ->join('queue_tickets', 'queue_tickets.ticket_id', '=', 'service_transactions.ticket_id')
            ->whereBetween('queue_tickets.created_at', [$startDate, $endDate])
            ->select('service_transactions.staff_id')
            ->selectRaw("SUM(CASE WHEN LOWER(queue_tickets.status) IN ('done', 'completed') THEN 1 ELSE 0 END) AS transactions_served")
            ->selectRaw("SUM(CASE WHEN LOWER(queue_tickets.status) IN ('cancelled', 'skipped', 'no-show', 'no_show', 'noshow') THEN 1 ELSE 0 END) AS skip_no_show")
            ->selectRaw("AVG(CASE WHEN LOWER(queue_tickets.status) IN ('done', 'completed') AND {$validServiceSql} THEN {$staffServiceDurationSql} END) AS average_service_time")
            ->selectRaw("AVG(CASE WHEN LOWER(queue_tickets.status) IN ('done', 'completed') AND {$validWaitingSql} THEN {$staffWaitingDurationSql} END) AS average_waiting_time")
            ->groupBy('service_transactions.staff_id');

        $staffPerformance = User::query()
            ->leftJoinSub($staffPerformanceAggregate, 'staff_metrics', function ($join) {
                $join->on('staff_metrics.staff_id', '=', 'users.user_id');
            })
            ->whereRaw('LOWER(TRIM(users.role)) = ?', ['staff'])
            ->whereIn(DB::raw('LOWER(TRIM(users.position))'), $currentUser?->isDeptAdmin() ? [strtolower((string) $currentUser->position)] : ['cashier', 'registrar', 'itm', 'admission'])
            ->select([
                'users.user_id',
                'users.username',
                'users.full_name',
                'users.position',
                'users.status',
            ])
            ->selectRaw('COALESCE(staff_metrics.transactions_served, 0) AS transactions_served')
            ->selectRaw('COALESCE(staff_metrics.skip_no_show, 0) AS skip_no_show')
            ->selectRaw('COALESCE(staff_metrics.average_service_time, 0) AS average_service_time')
            ->selectRaw('COALESCE(staff_metrics.average_waiting_time, 0) AS average_waiting_time')
            ->orderByRaw("CASE WHEN LOWER(TRIM(users.position)) = 'registrar' THEN 0 ELSE 1 END")
            ->orderBy('users.full_name')
            ->orderBy('users.username')
            ->get()
            ->map(function ($staff) {
                $served = (int) $staff->transactions_served;
                $skipped = (int) $staff->skip_no_show;
                $processed = $served + $skipped;
                $completionRate = $processed > 0 ? round(($served / $processed) * 100, 1) : 0;

                return [
                    'user_id' => (int) $staff->user_id,
                    'username' => $staff->username,
                    'staff_name' => $staff->full_name ?: $staff->username,
                    'position' => strtolower((string) $staff->position),
                    'status' => $staff->status,
                    'transactions_served' => $served,
                    'average_service_time' => round((float) $staff->average_service_time, 2),
                    'average_waiting_time' => round((float) $staff->average_waiting_time, 2),
                    'completion_rate' => $completionRate,
                    'skip_no_show' => $skipped,
                    'utilization' => $processed > 0 ? round(($served / $processed) * 100, 1) : 0,
                ];
            });

        // Helper to format minutes into "X min Y sec"
        $formatMinSec = fn ($minutes) => WaitingTime::formatMinutes((float) $minutes);

        // Completion Rate: (Completed / Total Issued) * 100
        $completionRate = $totalTickets > 0
            ? round(($completedTickets / $totalTickets) * 100, 1)
            : 0;

        // KPI Status
        $kpiStatus = [
            "waiting_time" => $averageWaitingTime <= 5 ? "PASSED" : "FAILED",
            "service_time" => $averageServiceTime <= 10 ? "PASSED" : "FAILED",
            "turnaround_time" => $turnaroundTime <= 15 ? "PASSED" : "FAILED",
            "completion_rate" => $completionRate >= 95 ? "PASSED" : "FAILED",
        ];

        // Department-specific completed counts
        $cashierCompleted = QueueTicket::where(function ($q) {
                $q->where('service_type', 'C')->orWhere('service_type', 'CS');
            })
            ->whereIn('status', ['done', 'Completed', 'completed'])
            ->whereBetween('created_at', [$startDate, $endDate])
            ->count();

        $registrarCompleted = QueueTicket::where(function ($q) {
                $q->where('service_type', 'R')->orWhere('service_type', 'RT');
            })
            ->whereIn('status', ['done', 'Completed', 'completed'])
            ->whereBetween('created_at', [$startDate, $endDate])
            ->count();

        return response()->json([
            "total_tickets" => $totalTickets,
            "customers_served" => $completedTickets,
            "completed_tickets_count" => $completedTickets,
            "waiting_tickets" => $waitingTickets,
            "serving_tickets" => $servingTickets,
            "cancelled_tickets" => $cancelledTickets,
            "skipped_tickets" => $cancelledTickets,
            "average_waiting_time" => $averageWaitingTime,
            "average_waiting_time_minutes" => $averageWaitingTime,
            "average_waiting_time_formatted" => $formatMinSec($averageWaitingTime),
            "longest_waiting_time" => $longestWaitingTime,
            "longest_waiting_time_minutes" => $longestWaitingTime,
            "longest_waiting_time_formatted" => $formatMinSec($longestWaitingTime),
            "average_service_time" => $averageServiceTime,
            "average_service_time_minutes" => $averageServiceTime,
            "average_service_time_formatted" => $formatMinSec($averageServiceTime),
            "turnaround_time" => $turnaroundTime,
            "average_turnaround_time_minutes" => $turnaroundTime,
            "average_turnaround_time_formatted" => $formatMinSec($turnaroundTime),
            "completion_rate" => $completionRate,
            "staff_performance" => $staffPerformance,
            "cashier_completed" => (!$currentUser?->isDeptAdmin() || $currentUser->department === 'Cashier') ? $cashierCompleted : 0,
            "registrar_completed" => (!$currentUser?->isDeptAdmin() || $currentUser->department === 'Registrar') ? $registrarCompleted : 0,
            "kpi_status" => $kpiStatus,
        ]);
    }

    /**
     * Get Peak Hours analytics.
     * Returns hourly distribution of queue tickets for a given period.
     */
    public function getPeakHours(Request $request)
    {
        // Ticket creation writes app-timezone clock values (UTC). Interpret these
        // exactly as Eloquent/API serialization does, then convert once to Manila.
        // Do not change the MySQL session timezone here: existing TIMESTAMP values
        // were written through that same session convention.
        $timezone = 'Asia/Manila';
        [$startDate, $endDate] = \App\Services\WindowUtilization::dateRange($request, $timezone);
        $period = $request->query('period', 'today');
        $storageTimezone = config('app.timezone');
        $now = Carbon::now($storageTimezone);
        $offsetSeconds = $now->copy()->setTimezone($timezone)->getOffset() - $now->getOffset();
        $localCreatedAt = DB::connection()->getDriverName() === 'sqlite'
            ? "datetime(created_at, '{$offsetSeconds} seconds')"
            : "DATE_ADD(created_at, INTERVAL {$offsetSeconds} SECOND)";
        $hourSql = $this->hourSql($localCreatedAt);

        $query = QueueTicket::where('created_at', '>=', $startDate->copy()->setTimezone($storageTimezone))
            ->where('created_at', '<', $endDate->copy()->addDay()->startOfDay()->setTimezone($storageTimezone))
            ->where('created_at', '<=', $now);
        $currentUser = $request->user('sanctum') ?? $request->user();
        if ($currentUser?->isDeptAdmin()) {
            $userDept = $currentUser->department;
            if ($request->filled('department') && strtolower(trim((string) $request->query('department'))) !== 'all') {
                $reqDept = \App\Services\Departments::name($request->query('department'));
                abort_unless($reqDept === $userDept, 403, 'Access denied to other departments.');
            }
            $department = strtolower((string) $currentUser->position);
        } else {
            $department = strtolower(trim((string) $request->query('department')));
        }
        if ($department !== '' && $department !== 'all') {
            $types = match ($department) {
                'cashier', 'c', 'cs' => ['C', 'CS'],
                'registrar', 'r', 'rt' => ['R', 'RT'],
                'itm' => ['ITM'],
                'admission' => ['ADM'],
                default => [],
            };
            abort_if($types === [], 422, 'Invalid department.');
            $query->whereIn('service_type', $types);
        }

        // Get hourly distribution of tickets during the school's operating hours.
        $hourlyData = (clone $query)
            ->selectRaw("{$hourSql} AS hour, COUNT(*) AS total_tickets")
            ->whereRaw("{$hourSql} BETWEEN 7 AND 19")
            ->groupBy(DB::raw($hourSql))
            ->orderBy('hour')
            ->get()
            ->keyBy('hour');

        // Build school operating hours array: 7 AM to 7 PM inclusive.
        $distribution = [];
        $maxTickets = 0;
        $peakHour = null;
        $totalTickets = 0;

        for ($h = 7; $h <= 19; $h++) {
            $count = isset($hourlyData[$h]) ? (int) $hourlyData[$h]->total_tickets : 0;
            $totalTickets += $count;

            $label = $h < 12 ? $h . ' AM' : ($h === 12 ? '12 PM' : ($h - 12) . ' PM');

            $distribution[] = [
                'hour' => $h,
                'label' => $label,
                'total' => $count,
                'count' => $count,
            ];

            if ($count > $maxTickets) {
                $maxTickets = $count;
                $peakHour = $h;
            }
        }

        // Format peak hour range within school operating hours.
        $peakHourStart = $peakHour !== null ? $peakHour : 9;
        $peakHourEnd = min($peakHourStart + 1, 19);
        $peakStartLabel = $peakHourStart < 12 ? $peakHourStart . ':00 AM' : ($peakHourStart === 12 ? '12:00 PM' : ($peakHourStart - 12) . ':00 PM');
        $peakEndLabel = $peakHourEnd < 12 ? $peakHourEnd . ':00 AM' : ($peakHourEnd === 12 ? '12:00 PM' : ($peakHourEnd - 12) . ':00 PM');

        return response()->json([
            'period' => $period,
            'timezone' => $timezone,
            'date_range' => [
                'start' => $startDate->toDateTimeString(),
                'end' => $endDate->toDateTimeString(),
            ],
            'total_tickets' => $totalTickets,
            'peak_hour' => $peakHour,
            'peak_hour_label' => $peakHour === null ? 'No data available' : $peakStartLabel . ' – ' . $peakEndLabel,
            'peak_hour_count' => $maxTickets,
            'distribution' => $distribution,
        ]);
    }

    /**
     * Get Busiest Day of the Week analytics.
     * Identifies which day of the week has the highest number of completed transactions.
     */
    public function getBusiestDayAnalytics(Request $request)
    {
        [$startDate, $endDate] = $this->parseDateRange($request);
        $currentUser = $request->user('sanctum') ?? $request->user();
        if ($currentUser?->isDeptAdmin()) {
            $userDept = $currentUser->department;
            if ($request->filled('department') && strtolower(trim((string)$request->query('department'))) !== 'all') {
                $reqDept = \App\Services\Departments::name($request->query('department'));
                abort_unless($reqDept === $userDept, 403, 'Access denied to other departments.');
            }
            $department = $userDept;
        } else {
            $department = $request->query('department');
        }
        $dayOfWeekSql = $this->dayOfWeekSql('completed_at');

        // Build query for completed tickets
        $query = QueueTicket::whereIn('status', ['done', 'Completed', 'completed']);
        if ($department) {
            $query->where(function ($q) use ($department) {
                $q->whereIn('service_type', \App\Services\Departments::types($department));
            });
        }

        // Get distribution by day of week
        $dayDistribution = (clone $query)
            ->selectRaw("{$dayOfWeekSql} AS day_of_week, COUNT(*) AS total")
            ->whereNotNull('completed_at')
            ->whereBetween('completed_at', [$startDate, $endDate])
            ->groupBy(DB::raw($dayOfWeekSql))
            ->orderBy('day_of_week')
            ->get()
            ->keyBy('day_of_week');

        // Day name mapping (MySQL DAYOFWEEK: 1=Sunday, 2=Monday, ..., 7=Saturday)
        $dayNames = [
            1 => 'Sunday',
            2 => 'Monday',
            3 => 'Tuesday',
            4 => 'Wednesday',
            5 => 'Thursday',
            6 => 'Friday',
            7 => 'Saturday',
        ];

        // Build complete 7-day distribution
        $distribution = [];
        $maxCount = 0;
        $busiestDay = null;
        $totalCompleted = 0;

        foreach ($dayNames as $dayNum => $dayName) {
            $count = isset($dayDistribution[$dayNum]) ? (int) $dayDistribution[$dayNum]->total : 0;
            $totalCompleted += $count;

            $distribution[] = [
                'day_number' => $dayNum,
                'day_name' => $dayName,
                'count' => $count,
            ];

            if ($count > $maxCount) {
                $maxCount = $count;
                $busiestDay = $dayName;
            }
        }

        return response()->json([
            'busiest_day' => $busiestDay,
            'busiest_day_count' => $maxCount,
            'total_completed' => $totalCompleted,
            'distribution' => $distribution,
        ]);
    }
}
