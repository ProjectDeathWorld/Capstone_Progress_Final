<?php

namespace App\Services;

use App\Models\QueueTicket;
use App\Models\ServiceWindow;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WindowUtilization
{
    public static function dateRange(Request $request, ?string $timezone = null): array
    {
        $request->validate([
            'period' => 'nullable|in:today,week,weekly,month,monthly,semester,custom',
            'start_date' => 'nullable|date|required_if:period,custom',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);
        $timezone ??= config('app.timezone');
        $today = Carbon::today($timezone);
        return match ($request->query('period', 'today')) {
            'week', 'weekly' => [$today->copy()->subDays(6), $today->copy()->endOfDay()],
            'month', 'monthly' => [$today->copy()->subDays(29), $today->copy()->endOfDay()],
            'semester' => [$today->copy()->subMonths(6), $today->copy()->endOfDay()],
            'custom' => [Carbon::parse($request->query('start_date'), $timezone)->startOfDay(),
                Carbon::parse($request->query('end_date') ?: $request->query('start_date'), $timezone)->endOfDay()],
            default => [$today, $today->copy()->endOfDay()],
        };
    }

    public function summarize(Request $request, string $department): array
    {
        [$start, $end] = self::dateRange($request);
        $registrar = strtolower($department) === 'registrar';
        $types = Departments::types($department);
        $windowColumn = DB::connection()->getQueryGrammar()->wrap('window');
        $windowSql = $registrar ? "CASE WHEN {$windowColumn} BETWEEN 1 AND 5 THEN {$windowColumn} + 8 ELSE {$windowColumn} END" : $windowColumn;
        $duration = DB::connection()->getDriverName() === 'sqlite'
            ? '((julianday(completed_at) - julianday(called_at)) * 1440.0)'
            : '(TIMESTAMPDIFF(SECOND, called_at, completed_at) / 60.0)';
        $valid = 'called_at IS NOT NULL AND completed_at >= called_at AND created_at IS NOT NULL AND called_at >= created_at';
        // One row per ticket, no joins to logs/transactions that could multiply the aggregate.
        $groups = QueueTicket::whereIn('service_type', $types)
            ->whereIn('status', ['done', 'Completed', 'completed'])
            ->whereBetween('completed_at', [$start, $end])
            ->selectRaw("{$windowSql} as served_window")
            ->selectRaw('SUM(CASE WHEN called_at IS NOT NULL THEN 1 ELSE 0 END) as handled')
            ->selectRaw("SUM(CASE WHEN {$valid} THEN 1 ELSE 0 END) as valid_count")
            ->selectRaw("SUM(CASE WHEN {$valid} THEN {$duration} ELSE 0 END) as active_minutes")
            ->selectRaw("SUM(CASE WHEN {$valid} THEN 0 ELSE 1 END) as invalid_count")
            ->groupByRaw($windowSql)->get()->keyBy('served_window');

        $invalidCount = (int) $groups->sum('invalid_count');
        if ($invalidCount) {
            // Aggregate diagnostics only: no names, ticket numbers, or student information.
            Log::debug('Window utilization excluded invalid service timestamps', [
                'department' => $department, 'start' => $start->toDateString(),
                'end' => $end->toDateString(), 'count' => $invalidCount,
            ]);
        }
        return ServiceWindow::whereRaw('LOWER(department) = ?', [strtolower($department)])
            ->orderBy('window_number')->get(['id', 'window_number'])
            ->map(function ($window) use ($registrar, $groups, $department, $start, $end) {
                $number = $window->window_number;
                if ($registrar && $number >= 1 && $number <= 5) $number += 8;
                $stats = $groups->get($number);
                $active = (float) ($stats->active_minutes ?? 0);
                $validCount = (int) ($stats->valid_count ?? 0);
                return [
                    'window_id' => $window->id, 'window_number' => $number,
                    'window_name' => 'Window '.$number, 'department' => $department,
                    'tickets_handled' => (int) ($stats->handled ?? 0),
                    'valid_service_tickets' => $validCount,
                    'invalid_duration_tickets' => (int) ($stats->invalid_count ?? 0),
                    'active_minutes' => round($active, 2),
                    'avg_service_minutes' => $validCount ? round($active / $validCount, 2) : 0,
                    // Current status and login logs do not establish historical operating sessions.
                    'idle_minutes' => null, 'utilization_rate' => null, 'operating_minutes' => null,
                    'unavailable_reason' => 'Window operating-session history is not recorded.',
                    'timezone' => config('app.timezone'),
                    'date_range' => ['start' => $start->toDateTimeString(), 'end' => $end->toDateTimeString()],
                ];
            })
            ->filter(fn ($row) => $registrar ? $row['window_number'] >= 9 && $row['window_number'] <= 13
                : $row['window_number'] >= 1 && $row['window_number'] <= 3)
            ->unique('window_number')->values()->all();
    }
}
