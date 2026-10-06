<?php

namespace App\Services;

use App\Models\QueueTicket;
use App\Models\ServiceWindow;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class IntelligenceService
{
    /**
     * Queue Status Thresholds (in minutes)
     */
    public const THRESHOLDS = [
        'LOW' => 10,
        'NORMAL' => 20,
        'HIGH' => 30,
    ];

    /**
     * Get list of active/existing departments in the system.
     */
    public function getActiveDepartments(): array
    {
        $dbDepartments = ServiceWindow::query()
            ->select('department')
            ->distinct()
            ->pluck('department')
            ->map(fn ($d) => Departments::name($d))
            ->filter()
            ->unique()
            ->values()
            ->all();

        $allKnown = ['Cashier', 'Registrar', 'ITM', 'Admission'];

        if (empty($dbDepartments)) {
            return $allKnown;
        }

        // Return sorted according to standard order, followed by any custom ones
        $ordered = [];
        foreach ($allKnown as $known) {
            if (in_array($known, $dbDepartments, true)) {
                $ordered[] = $known;
            }
        }

        foreach ($dbDepartments as $d) {
            if (!in_array($d, $ordered, true)) {
                $ordered[] = $d;
            }
        }

        return $ordered;
    }

    /**
     * Calculate Average Service Time for a given department.
     * Service duration = completed_at - called_at (or service transaction duration)
     * Prioritizes today's completed transactions; falls back to recent history (past 30 days)
     * or all historical data if today's samples are insufficient (< 3).
     */
    public function calculateAverageServiceTime(string $department): array
    {
        $types = Departments::types($department);
        if (empty($types)) {
            return [
                'average_minutes' => null,
                'sample_count' => 0,
                'data_source' => 'none',
                'std_dev' => 0.0,
            ];
        }

        $isSqlite = DB::connection()->getDriverName() === 'sqlite';
        $durationSecondsSql = $isSqlite
            ? '((julianday(completed_at) - julianday(called_at)) * 86400.0)'
            : 'TIMESTAMPDIFF(SECOND, called_at, completed_at)';

        $baseQuery = QueueTicket::query()
            ->whereIn('service_type', $types)
            ->whereIn('status', ['done', 'Completed', 'completed'])
            ->whereNotNull('called_at')
            ->whereNotNull('completed_at')
            ->whereColumn('completed_at', '>=', 'called_at')
            ->whereRaw("{$durationSecondsSql} BETWEEN 10 AND 7200");

        // 1. Check today's completed transactions
        $todayQuery = (clone $baseQuery)->where('completed_at', '>=', Carbon::today()->startOfDay());
        $todayCount = (int) $todayQuery->count();

        if ($todayCount >= 3) {
            $avgSeconds = (float) $todayQuery->avg(DB::raw($durationSecondsSql));
            return [
                'average_minutes' => round($avgSeconds / 60.0, 2),
                'sample_count' => $todayCount,
                'data_source' => 'today',
                'std_dev' => 0.0,
            ];
        }

        // 2. Fall back to recent history (past 30 days)
        $recentQuery = (clone $baseQuery)->where('completed_at', '>=', Carbon::today()->subDays(30)->startOfDay());
        $recentCount = (int) $recentQuery->count();

        if ($recentCount > 0) {
            $avgSeconds = (float) $recentQuery->avg(DB::raw($durationSecondsSql));
            return [
                'average_minutes' => round($avgSeconds / 60.0, 2),
                'sample_count' => $recentCount,
                'data_source' => 'recent_history',
                'std_dev' => 0.0,
            ];
        }

        // 3. Fall back to all-time completed records
        $allCount = (int) $baseQuery->count();
        if ($allCount > 0) {
            $avgSeconds = (float) $baseQuery->avg(DB::raw($durationSecondsSql));
            return [
                'average_minutes' => round($avgSeconds / 60.0, 2),
                'sample_count' => $allCount,
                'data_source' => 'all_history',
                'std_dev' => 0.0,
            ];
        }

        return [
            'average_minutes' => null,
            'sample_count' => 0,
            'data_source' => 'none',
            'std_dev' => 0.0,
        ];
    }

    /**
     * Count currently active windows for a department.
     */
    public function getActiveWindowsCount(string $department): int
    {
        return ServiceWindow::query()
            ->whereRaw('LOWER(department) = ?', [strtolower($department)])
            ->where('is_available', true)
            ->where('status', 'open')
            ->count();
    }

    /**
     * Count currently waiting tickets for a department.
     */
    public function getWaitingQueueCount(string $department): int
    {
        $types = Departments::types($department);
        if (empty($types)) {
            return 0;
        }

        return QueueTicket::query()
            ->whereIn('service_type', $types)
            ->whereIn('status', ['waiting', 'Waiting'])
            ->count();
    }

    /**
     * Determine Queue Status based on predicted wait time and current conditions.
     */
    public function determineQueueStatus(?float $predictedWaitMinutes, int $waitingCount, int $activeWindows): string
    {
        if ($waitingCount > 0 && $activeWindows === 0) {
            return 'CRITICAL';
        }

        if ($predictedWaitMinutes === null || $predictedWaitMinutes < self::THRESHOLDS['LOW']) {
            return 'LOW';
        }

        if ($predictedWaitMinutes <= self::THRESHOLDS['NORMAL']) {
            return 'NORMAL';
        }

        if ($predictedWaitMinutes <= self::THRESHOLDS['HIGH']) {
            return 'HIGH';
        }

        return 'CRITICAL';
    }

    /**
     * Calculate Predicted Waiting Time and associated intelligence metrics for a department.
     */
    public function getDepartmentPrediction(string $departmentName): array
    {
        $normalizedName = Departments::name($departmentName) ?? $departmentName;
        $waitingCount = $this->getWaitingQueueCount($normalizedName);
        $activeWindows = $this->getActiveWindowsCount($normalizedName);
        $serviceData = $this->calculateAverageServiceTime($normalizedName);
        $avgServiceMinutes = $serviceData['average_minutes'];
        $dataSource = $serviceData['data_source'];

        // Case 1: No queue waiting
        if ($waitingCount === 0) {
            return [
                'department_key' => strtolower($normalizedName),
                'department_name' => $normalizedName,
                'waiting_count' => 0,
                'active_windows' => $activeWindows,
                'average_service_time_minutes' => $avgServiceMinutes !== null ? (float) $avgServiceMinutes : null,
                'predicted_wait_minutes' => 0.0,
                'predicted_wait_min' => 0,
                'predicted_wait_max' => 0,
                'predicted_wait_formatted' => 'No waiting time',
                'queue_status' => 'LOW',
                'data_source' => $dataSource,
                'status_reason' => 'No students currently waiting',
                'is_available' => true,
            ];
        }

        // Case 2: Waiting queue exists but zero active windows
        if ($activeWindows === 0) {
            return [
                'department_key' => strtolower($normalizedName),
                'department_name' => $normalizedName,
                'waiting_count' => $waitingCount,
                'active_windows' => 0,
                'average_service_time_minutes' => $avgServiceMinutes !== null ? (float) $avgServiceMinutes : null,
                'predicted_wait_minutes' => null,
                'predicted_wait_min' => null,
                'predicted_wait_max' => null,
                'predicted_wait_formatted' => 'Unavailable',
                'queue_status' => 'CRITICAL',
                'data_source' => $dataSource,
                'status_reason' => 'No active service window',
                'is_available' => false,
            ];
        }

        // Case 3: Insufficient historical service data
        if ($avgServiceMinutes === null || $avgServiceMinutes <= 0) {
            return [
                'department_key' => strtolower($normalizedName),
                'department_name' => $normalizedName,
                'waiting_count' => $waitingCount,
                'active_windows' => $activeWindows,
                'average_service_time_minutes' => null,
                'predicted_wait_minutes' => null,
                'predicted_wait_min' => null,
                'predicted_wait_max' => null,
                'predicted_wait_formatted' => 'Prediction unavailable — insufficient service data',
                'queue_status' => 'NORMAL',
                'data_source' => 'none',
                'status_reason' => 'Insufficient service data',
                'is_available' => false,
            ];
        }

        // Case 4: Standard calculation
        // Predicted Waiting Time = (Current Waiting Customers × Average Service Time) ÷ Active Windows
        $baseWaitMinutes = ($waitingCount * $avgServiceMinutes) / $activeWindows;
        $roundedBase = round($baseWaitMinutes, 1);

        if ($baseWaitMinutes < 1.0) {
            $minWait = 0;
            $maxWait = 1;
            $formattedWait = 'Less than 1 minute';
        } else {
            // Variation of ±10% to ±15% (e.g. ~12% with minimum spread of 1 minute)
            $spread = max(1, (int) round($baseWaitMinutes * 0.12));
            $minWait = max(1, (int) round($baseWaitMinutes - $spread));
            $maxWait = (int) round($baseWaitMinutes + $spread);
            if ($minWait === $maxWait) {
                $maxWait = $minWait + 1;
            }
            $formattedWait = "{$minWait}–{$maxWait} minutes";
        }

        $queueStatus = $this->determineQueueStatus($baseWaitMinutes, $waitingCount, $activeWindows);

        return [
            'department_key' => strtolower($normalizedName),
            'department_name' => $normalizedName,
            'waiting_count' => $waitingCount,
            'active_windows' => $activeWindows,
            'average_service_time_minutes' => (float) $avgServiceMinutes,
            'predicted_wait_minutes' => (float) $roundedBase,
            'predicted_wait_min' => $minWait,
            'predicted_wait_max' => $maxWait,
            'predicted_wait_formatted' => $formattedWait,
            'queue_status' => $queueStatus,
            'data_source' => $dataSource,
            'status_reason' => null,
            'is_available' => true,
        ];
    }

    /**
     * Get predictions for multiple departments.
     */
    public function getPredictionsForDepartments(array $departments): array
    {
        $predictions = [];
        foreach ($departments as $dept) {
            $predictions[] = $this->getDepartmentPrediction($dept);
        }
        return $predictions;
    }
}
