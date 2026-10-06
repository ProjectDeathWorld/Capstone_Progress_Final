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

    /**
     * Peak Risk Thresholds (expected arrivals in peak hour)
     */
    public const PEAK_RISK_THRESHOLDS = [
        'LOW' => 10,
        'NORMAL' => 20,
        'HIGH' => 30,
    ];

    public const OPERATING_HOURS_START = 7;
    public const OPERATING_HOURS_END = 18; // 6:00 PM - 7:00 PM interval starts at 18

    /**
     * Determine Peak Risk level.
     */
    public static function determinePeakRisk(float $expectedArrivals, ?string $department = null): string
    {
        if ($expectedArrivals <= self::PEAK_RISK_THRESHOLDS['LOW']) {
            return 'LOW';
        }
        if ($expectedArrivals <= self::PEAK_RISK_THRESHOLDS['NORMAL']) {
            return 'NORMAL';
        }
        if ($expectedArrivals <= self::PEAK_RISK_THRESHOLDS['HIGH']) {
            return 'HIGH';
        }
        return 'CRITICAL';
    }

    /**
     * Format hour range into readable AM/PM string (e.g. 10:00 AM – 11:00 AM).
     */
    public static function formatHourRange(int $startHour): string
    {
        $format = fn (int $h) => $h < 12 ? "{$h}:00 AM" : ($h === 12 ? '12:00 PM' : ($h - 12) . ':00 PM');
        return $format($startHour) . ' – ' . $format($startHour + 1);
    }

    /**
     * Predict Peak Hour for a department using historical arrival patterns,
     * same-day-of-week weighted averages, and upcoming time horizon.
     */
    public function getDepartmentPeakPrediction(string $departmentName, ?Carbon $now = null): array
    {
        $now = $now ? $now->copy() : Carbon::now();
        $normalizedName = Departments::name($departmentName) ?? $departmentName;
        $types = Departments::types($normalizedName);

        if (empty($types)) {
            return $this->emptyPeakPayload($normalizedName, 'Invalid department');
        }

        $isSqlite = DB::connection()->getDriverName() === 'sqlite';
        $hourSql = $isSqlite ? "CAST(strftime('%H', created_at) AS INTEGER)" : 'HOUR(created_at)';
        $dateSql = $isSqlite ? 'date(created_at)' : 'DATE(created_at)';
        $dayOfWeekSql = $isSqlite ? '(CAST(strftime(\'%w\', created_at) AS INTEGER) + 1)' : 'DAYOFWEEK(created_at)';

        $ticketsQuery = QueueTicket::query()
            ->whereIn('service_type', $types)
            ->whereNotNull('created_at')
            ->whereRaw("{$hourSql} BETWEEN ? AND ?", [self::OPERATING_HOURS_START, self::OPERATING_HOURS_END]);

        $totalTicketCount = (int) (clone $ticketsQuery)->count();

        // Insufficient historical records check (< 3 records)
        if ($totalTicketCount < 3) {
            return $this->emptyPeakPayload($normalizedName, 'Not enough records to establish an arrival trend', $totalTicketCount);
        }

        $currentHour = (int) $now->format('G');
        // In MySQL DAYOFWEEK: 1=Sun, 2=Mon... Carbon $now->dayOfWeek + 1 matches this.
        $currentDayOfWeekNum = $now->dayOfWeek + 1;
        $dayName = $now->format('l');

        // Look for historical operating dates prior to today
        $historicalDates = (clone $ticketsQuery)
            ->where('created_at', '<', $now->copy()->startOfDay())
            ->selectRaw("{$dateSql} as op_date, {$dayOfWeekSql} as dow, COUNT(*) as cnt")
            ->groupByRaw("{$dateSql}, {$dayOfWeekSql}")
            ->orderByDesc('op_date')
            ->get();

        // If no prior dates exist (e.g. initial deployment with all tickets today), evaluate all dates
        if ($historicalDates->isEmpty()) {
            $historicalDates = (clone $ticketsQuery)
                ->selectRaw("{$dateSql} as op_date, {$dayOfWeekSql} as dow, COUNT(*) as cnt")
                ->groupByRaw("{$dateSql}, {$dayOfWeekSql}")
                ->orderByDesc('op_date')
                ->get();
        }

        // Compare same day of week when possible
        $sameWeekdayDates = $historicalDates->filter(fn ($d) => (int) $d->dow === $currentDayOfWeekNum)->values();

        if ($sameWeekdayDates->isNotEmpty()) {
            $selectedDates = $sameWeekdayDates->take(4);
            $pattern = "Based on recent {$dayName}s and current queue activity";
            $source = 'recent_same_weekday_history';
        } else {
            $selectedDates = $historicalDates->take(4);
            $pattern = 'Based on recent operating days and current queue activity';
            $source = 'recent_operating_history';
        }

        $baseWeights = [0.40, 0.30, 0.20, 0.10];
        $numDates = $selectedDates->count();
        $sliceWeights = array_slice($baseWeights, 0, $numDates);
        $weightSum = array_sum($sliceWeights);
        $normalizedWeights = array_map(fn ($w) => $w / $weightSum, $sliceWeights);

        $hourlyArrivals = [];
        for ($h = self::OPERATING_HOURS_START; $h <= self::OPERATING_HOURS_END; $h++) {
            $hourlyArrivals[$h] = 0.0;
        }

        foreach ($selectedDates as $i => $dateRow) {
            $dateTickets = (clone $ticketsQuery)
                ->whereRaw("{$dateSql} = ?", [$dateRow->op_date])
                ->selectRaw("{$hourSql} as hr, COUNT(*) as cnt")
                ->groupByRaw("{$hourSql}")
                ->pluck('cnt', 'hr');

            $weight = $normalizedWeights[$i] ?? 0.25;
            foreach ($hourlyArrivals as $hour => &$val) {
                $val += ((int) ($dateTickets[$hour] ?? 0)) * $weight;
            }
            unset($val);
        }

        // Incorporate today's real-time queue activity if available
        $todayTicketsCount = (int) (clone $ticketsQuery)
            ->where('created_at', '>=', $now->copy()->startOfDay())
            ->where('created_at', '<=', $now)
            ->count();

        if ($todayTicketsCount > 0 && $currentHour > self::OPERATING_HOURS_START) {
            $expectedSoFar = 0.0;
            for ($h = self::OPERATING_HOURS_START; $h < $currentHour; $h++) {
                $expectedSoFar += ($hourlyArrivals[$h] ?? 0);
            }
            if ($expectedSoFar >= 1.0) {
                $paceRatio = $todayTicketsCount / $expectedSoFar;
                $paceFactor = max(0.8, min(1.3, $paceRatio));
                for ($h = max(self::OPERATING_HOURS_START, $currentHour); $h <= self::OPERATING_HOURS_END; $h++) {
                    $hourlyArrivals[$h] *= $paceFactor;
                }
            }
        }

        // Determine upcoming peak vs finished period
        $isUpcoming = true;
        $statusReason = null;

        if ($currentHour > self::OPERATING_HOURS_END) {
            // Outside today's operating hours
            $isUpcoming = false;
            $peakHour = array_keys($hourlyArrivals, max($hourlyArrivals))[0];
            $statusReason = 'No additional peak period predicted for today';
        } else {
            // Evaluate remaining operating hours for today
            $remainingHours = [];
            for ($h = max(self::OPERATING_HOURS_START, $currentHour); $h <= self::OPERATING_HOURS_END; $h++) {
                $remainingHours[$h] = $hourlyArrivals[$h];
            }

            if (empty($remainingHours)) {
                $isUpcoming = false;
                $peakHour = array_keys($hourlyArrivals, max($hourlyArrivals))[0];
                $statusReason = 'No additional peak period predicted for today';
            } else {
                $maxVal = max($remainingHours);
                $peakHour = array_keys($remainingHours, $maxVal)[0];
                $isUpcoming = true;
                $statusReason = null;
            }
        }

        // Expected Arrivals and Range calculation
        $predictedArrivals = round($hourlyArrivals[$peakHour], 1);
        $intPredicted = max(1, (int) round($predictedArrivals));
        $spread = max(2, (int) round($intPredicted * 0.12));
        $minArrivals = max(1, $intPredicted - $spread);
        $maxArrivals = $intPredicted + $spread;
        if ($minArrivals === $maxArrivals) {
            $maxArrivals = $minArrivals + 1;
        }

        $expectedArrivalsFormatted = "{$minArrivals}–{$maxArrivals} students";
        $peakRisk = self::determinePeakRisk($intPredicted, $normalizedName);

        // Confidence calculation
        $matchingDaysCount = $selectedDates->count();
        $confidenceScore = 52;
        if ($matchingDaysCount >= 4) {
            $confidenceScore += 18;
        } elseif ($matchingDaysCount >= 2) {
            $confidenceScore += 10;
        }
        if ($totalTicketCount >= 30) {
            $confidenceScore += 14;
        } elseif ($totalTicketCount >= 10) {
            $confidenceScore += 8;
        }
        if ($source === 'recent_same_weekday_history') {
            $confidenceScore += 8;
        }
        $confidenceScore = min(92, max(55, $confidenceScore));
        $confidenceText = "{$confidenceScore}%";

        $peakTimeFormatted = self::formatHourRange($peakHour);
        $peakStart = sprintf('%02d:00', $peakHour);
        $peakEnd = sprintf('%02d:00', $peakHour + 1);

        return [
            'department_key' => strtolower($normalizedName),
            'department_name' => $normalizedName,
            'predicted_peak_start' => $peakStart,
            'predicted_peak_end' => $peakEnd,
            'predicted_peak_formatted' => $peakTimeFormatted,
            'expected_arrivals' => $intPredicted,
            'expected_arrivals_min' => $minArrivals,
            'expected_arrivals_max' => $maxArrivals,
            'expected_arrivals_formatted' => $expectedArrivalsFormatted,
            'peak_risk' => $peakRisk,
            'confidence' => $confidenceScore,
            'confidence_text' => $confidenceText,
            'historical_pattern' => $pattern,
            'is_upcoming' => $isUpcoming,
            'status_reason' => $statusReason,
            'data_points_used' => $totalTicketCount,
            'prediction_source' => $source,
            'is_available' => true,
        ];
    }

    /**
     * Get Peak Hour Predictions for multiple departments.
     */
    public function getAllDepartmentPeakPredictions(?array $departmentNames = null, ?Carbon $now = null): array
    {
        $departments = $departmentNames ?: $this->getActiveDepartments();
        $predictions = [];
        foreach ($departments as $dept) {
            $predictions[] = $this->getDepartmentPeakPrediction($dept, $now);
        }
        return $predictions;
    }

    /**
     * Fallback payload for insufficient historical data.
     */
    protected function emptyPeakPayload(string $departmentName, string $reason, int $dataPoints = 0): array
    {
        return [
            'department_key' => strtolower($departmentName),
            'department_name' => $departmentName,
            'predicted_peak_start' => null,
            'predicted_peak_end' => null,
            'predicted_peak_formatted' => 'Peak prediction unavailable — insufficient historical data',
            'expected_arrivals' => null,
            'expected_arrivals_min' => null,
            'expected_arrivals_max' => null,
            'expected_arrivals_formatted' => 'Unavailable',
            'peak_risk' => 'LOW',
            'confidence' => null,
            'confidence_text' => 'Limited data',
            'historical_pattern' => $reason,
            'is_upcoming' => false,
            'status_reason' => $reason,
            'data_points_used' => $dataPoints,
            'prediction_source' => 'insufficient_data',
            'is_available' => false,
        ];
    }
}
