<?php

namespace App\Services;

use App\Models\QueueTicket;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** One ticket-created cohort for the report UI, analytics overview and PDF. */
class QueueReport
{
    public static function department($type): string
    {
        return match (strtoupper((string) $type)) {
            'C', 'CS' => 'Cashier', 'R', 'RT' => 'Registrar', 'ITM' => 'ITM', 'ADM' => 'Admission', default => 'Unknown',
        };
    }

    public static function status($ticket): string
    {
        return match (strtolower($ticket->status)) {
            'done', 'completed' => 'Completed', 'waiting' => 'Waiting',
            'called', 'serving' => 'Serving',
            'cancelled', 'skipped', 'no-show', 'no_show', 'noshow' => 'Skipped / No Show',
            default => 'Other',
        };
    }

    public static function minutes($start, $end): ?float
    {
        if (!$start || !$end) return null;
        return WaitingTime::minutes($start, $end);
    }

    public static function window($ticket): string
    {
        if (!$ticket->window) return 'Unassigned';
        $number = (int) $ticket->window;
        if (self::department($ticket->service_type) === 'Registrar' && $number >= 1 && $number <= 5) $number += 8;
        return 'Window '.$number;
    }

    public function summary(Collection $tickets): array
    {
        $done = $tickets->filter(fn ($t) => self::status($t) === 'Completed');
        $wait = $done->map(fn ($t) => self::minutes($t->created_at, $t->called_at))->filter(fn ($v) => $v !== null);
        $service = $done->map(fn ($t) => self::minutes($t->created_at, $t->called_at) === null ? null : self::minutes($t->called_at, $t->completed_at))->filter(fn ($v) => $v !== null);
        $turn = $done->map(fn ($t) => self::minutes($t->created_at, $t->completed_at))->filter(fn ($v) => $v !== null);
        return [
            'tickets_issued' => $tickets->count(),
            'students_served' => $done->filter(fn ($t) => $this->isStudent($t))->count(),
            'completed' => $done->count(),
            'waiting_tickets' => $tickets->filter(fn ($t) => self::status($t) === 'Waiting')->count(),
            'cancelled_skipped' => $tickets->filter(fn ($t) => self::status($t) === 'Skipped / No Show')->count(),
            'average_waiting_time' => $wait->isEmpty() ? null : round($wait->avg(), 2),
            'average_service_time' => $service->isEmpty() ? null : round($service->avg(), 2),
            'average_turnaround_time' => $turn->isEmpty() ? null : round($turn->avg(), 2),
            'completion_rate' => $tickets->isEmpty() ? 0 : round($done->count() / $tickets->count() * 100, 2),
            'valid_waiting_samples' => $wait->count(), 'valid_service_samples' => $service->count(),
            'excluded_waiting_samples' => $done->count() - $wait->count(),
            'excluded_service_samples' => $done->count() - $service->count(),
        ];
    }

    private function isStudent($ticket): bool
    {
        return !in_array(strtolower(trim((string) $ticket->student_number)), ['', 'guest'], true);
    }

    public function build(Request $request): array
    {
        $request->validate(['department' => 'nullable|in:all,Cashier,Registrar,ITM,Admission,cashier,registrar,itm,admission']);
        [$start, $end] = WindowUtilization::dateRange($request);
        $currentUser = $request->user('sanctum') ?? $request->user();
        if ($currentUser?->isDeptAdmin()) {
            $userDept = $currentUser->department;
            if ($request->filled('department') && strtolower(trim((string)$request->query('department'))) !== 'all') {
                $reqDept = \App\Services\Departments::name($request->query('department'));
                abort_unless($reqDept === $userDept, 403, 'Access denied to other departments.');
            }
            $department = $userDept;
        } else {
            $department = match (strtolower($request->query('department', 'all'))) {
                'cashier' => 'Cashier', 'registrar' => 'Registrar', 'itm' => 'ITM', 'admission' => 'Admission', default => 'all',
            };
        }
        // Half-open range includes the whole selected last day, never the following midnight.
        $query = QueueTicket::where('created_at', '>=', $start)->where('created_at', '<', $end->copy()->addDay()->startOfDay());
        if ($department !== 'all') $query->whereIn('service_type', match ($department) {
            'Cashier' => ['C', 'CS'], 'Registrar' => ['R', 'RT'], 'ITM' => ['ITM'], 'Admission' => ['ADM'],
        });
        $tickets = $query->with('serviceTransaction.staff')->orderBy('created_at')->get();
        $summary = $this->summary($tickets);
        $departments = $tickets->groupBy(fn ($t) => self::department($t->service_type))->map(fn ($rows, $name) => ['department' => $name] + $this->summary($rows));
        $daily = $tickets->groupBy(fn ($t) => $t->created_at->toDateString())->map(fn ($rows, $date) => ['date' => $date, 'label' => Carbon::parse($date)->format('M d')] + $this->summary($rows))->values();
        $byDate = $daily->keyBy('date');
        $daily = collect();
        for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
            $daily->push($byDate->get($date->toDateString()) ?? (['date' => $date->toDateString(), 'label' => $date->format('M d')] + $this->summary(collect())));
        }
        $statuses = $tickets->groupBy(fn ($t) => self::status($t))->map(fn ($rows, $label) => ['label' => $label, 'value' => $rows->count()])->values();
        $hourly = $tickets->groupBy(fn ($t) => $t->created_at->hour)->sortKeys()->map(fn ($rows, $hour) => ['hour' => (int) $hour, 'label' => Carbon::today()->setHour($hour)->format('g A'), 'value' => $rows->count()])->values();
        $windows = $tickets->filter(fn ($t) => $t->window)->groupBy(fn ($t) => self::department($t->service_type).' / '.self::window($t))->map(fn ($rows, $label) => ['label' => $label] + $this->summary($rows))->values();
        $transactions = $tickets->filter(fn ($t) => self::status($t) === 'Completed' && trim((string) $t->transaction_type) !== '')->groupBy('transaction_type')->map(fn ($rows, $label) => ['label' => $label, 'value' => $rows->count()])->values();
        $students = $tickets->filter(fn ($t) => $this->isStudent($t))->count();
        $priorityCount = $tickets->filter(fn ($t) => strtoupper((string) $t->priority_type) === 'P')->count();
        // Attribution comes from historical service transactions, never today's window assignee.
        // Start with users so active staff with no tickets still appear in the report.
        $eligibleStaffQuery = User::query()
            ->with('assignedWindow:id,staff_id,department,window_number')
            ->whereRaw('LOWER(TRIM(role)) = ?', ['staff'])
            ->whereRaw('LOWER(TRIM(status)) = ?', ['active']);

        if ($currentUser?->isDeptAdmin()) {
            $eligibleStaffQuery->whereRaw('LOWER(TRIM(position)) = ?', [strtolower((string) $currentUser->position)]);
        } else {
            $eligibleStaffQuery->whereIn(DB::raw('LOWER(TRIM(position))'), ['cashier', 'registrar', 'itm', 'admission']);
        }
        $eligibleStaff = $eligibleStaffQuery->get(['user_id', 'username', 'full_name', 'position']);
        $staff = $eligibleStaff->map(function ($staffMember) use ($tickets) {
            $rows = $tickets->filter(fn ($ticket) =>
                (int) ($ticket->serviceTransaction?->staff_id ?? 0) === (int) $staffMember->user_id
            );
            $stats = $this->summary($rows);
            $windows = $rows->filter(fn ($ticket) => $ticket->window)
                ->map(fn ($ticket) => self::window($ticket))->unique()->values();
            $assignedWindowNumber = $staffMember->assignedWindow?->window_number;
            $assignedDepartment = strtolower((string) $staffMember->assignedWindow?->department);
            $position = strtolower(trim((string) $staffMember->position));
            $hasValidAssignment = match ($position) {
                'cashier' => $assignedDepartment === 'cashier' && (int) $assignedWindowNumber >= 1 && (int) $assignedWindowNumber <= 3,
                'registrar' => $assignedDepartment === 'registrar' && (int) $assignedWindowNumber >= 9 && (int) $assignedWindowNumber <= 13,
                'itm', 'admission' => $assignedDepartment === $position && (int) $assignedWindowNumber > 0,
                default => false,
            };
            $displayWindow = $position === 'itm' && $windows->count() === 1
                ? $windows->first()
                : ($hasValidAssignment
                    ? 'Window '.(int) $assignedWindowNumber
                    : ($windows->count() === 1 ? $windows->first() : ($windows->isEmpty() ? 'Unassigned' : 'Multiple')));
            $processed = $stats['completed'] + $stats['cancelled_skipped'];
            return [
                'staff_id' => (int) $staffMember->user_id,
                'staff_name' => $staffMember->full_name,
                'username' => $staffMember->username,
                'department' => $position === 'itm' ? 'ITM' : ucfirst($position),
                'window' => $displayWindow,
                '_department_order' => match ($position) {
                    'cashier' => 1, 'registrar' => 2, 'itm' => 3, 'admission' => 4, default => 99,
                },
                '_sort_window' => $hasValidAssignment
                    ? (int) $assignedWindowNumber
                    : (int) preg_replace('/\D+/', '', (string) $staffMember->username),
                '_has_valid_assignment' => $hasValidAssignment,
                '_has_transactions' => $rows->isNotEmpty(),
                'tickets_served' => $stats['completed'],
                'completion_rate' => $processed > 0 ? round($stats['completed'] / $processed * 100, 2) : 0,
                'average_waiting_time' => $stats['average_waiting_time'] ?? 0,
                'average_service_time' => $stats['average_service_time'] ?? 0,
            ] + $stats;
        })->filter(fn ($row) => $row['_department_order'] >= 3 || $row['_has_valid_assignment'] || $row['_has_transactions'])
            ->sortBy([
                ['_department_order', 'asc'],
                ['_sort_window', 'asc'],
                ['staff_name', 'asc'],
            ])->map(function ($row) {
                unset($row['_department_order'], $row['_sort_window'], $row['_has_valid_assignment'], $row['_has_transactions'], $row['username']);
                return $row;
            })->values();
        $peak = $hourly->sortByDesc('value')->first();
        $bestWindow = $windows->filter(fn ($r) => $r['completed'] > 0)->sortByDesc('completion_rate')->first();
        $days = (int) $start->diffInDays($end->copy()->startOfDay()) + 1;
        $transactionTotal = $transactions->sum('value');
        $transactionRows = $transactions->map(fn ($r) => ['type' => $r['label'], 'count' => $r['value'],
            'percentage' => $transactionTotal ? round($r['value'] / $transactionTotal * 100, 2) : 0,
            'average_per_day' => round($r['value'] / $days, 2)])->sortByDesc('count')->values();
        $weekdays = $tickets->filter(fn ($t) => self::status($t) === 'Completed')->groupBy(fn ($t) => $t->created_at->format('l'))
            ->map(fn ($rows, $name) => ['day_number' => Carbon::parse($name)->dayOfWeek + 1, 'day_name' => $name, 'count' => $rows->count()])->values();
        $busiest = $weekdays->sortByDesc('count')->first();
        return [
            'period' => $request->query('period', 'today'), 'department' => $department,
            'generated_at' => now()->toIso8601String(), 'timezone' => config('app.timezone'),
            'population' => 'Tickets created within the selected period',
            'date_range' => ['start' => $start->toDateTimeString(), 'end' => $end->toDateTimeString(),
                'formatted' => $start->format('M d, Y').' - '.$end->format('M d, Y')],
            'report_summary' => $summary, 'queue_summary' => $summary,
            'department_summary' => $departments, 'staff_summary' => $staff,
            'kpi_summary' => ['busiest_peak_hour' => $peak['label'] ?? null,
                'busiest_day' => $daily->filter(fn ($r) => $r['tickets_issued'] > 0)->sortByDesc('tickets_issued')->first()['date'] ?? null,
                'top_performing_staff' => $staff->firstWhere('tickets_served', '>', 0)['staff_name'] ?? null,
                'best_performing_window' => $bestWindow['label'] ?? null,
                'average_waiting_time' => $summary['average_waiting_time'], 'average_service_time' => $summary['average_service_time']],
            'analytics' => [
                'ticket_volume' => ['priority' => $priorityCount, 'regular' => $tickets->count() - $priorityCount, 'total' => $tickets->count()],
                'dashboard' => ['customers_served' => $summary['students_served']] + $summary,
                'transactions' => ['total_transactions' => $transactionTotal, 'transactions' => $transactionRows,
                    'most_used_transaction' => $transactionRows->first()],
                'peak_hours' => ['distribution' => $hourly->map(fn ($r) => $r + ['count' => $r['value'], 'total' => $r['value']]),
                    'peak_hour_label' => $peak['label'] ?? 'No Peak Hour', 'peak_hour_count' => $peak['value'] ?? 0],
                'customers' => $daily->map(fn ($r) => ['date' => $r['date'], 'label' => $r['label'], 'customers_served' => $r['completed']]),
                'busiest_day' => ['distribution' => $weekdays, 'busiest_day' => $busiest['day_name'] ?? null,
                    'busiest_day_count' => $busiest['count'] ?? 0, 'total_completed' => $summary['completed']],
            ],
            'charts' => ['daily' => $daily, 'statuses' => $statuses, 'hourly' => $hourly,
                'windows' => $windows, 'transactions' => $transactions,
                'visitors' => [['label' => 'Student', 'value' => $students], ['label' => 'Guest', 'value' => $tickets->count() - $students]]],
        ];
    }
}
