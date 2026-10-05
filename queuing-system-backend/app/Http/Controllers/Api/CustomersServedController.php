<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\QueueTicket;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomersServedController extends Controller
{
    /**
     * Get customers served data grouped by date for a given period.
     * Supports optional department filtering.
     */
    public function index(Request $request)
    {
        $period = $request->query('period', 'today');
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
        // Match utilization's completion-date scope, including rolling 7/30 day filters.
        [$startDate, $endDate] = \App\Services\WindowUtilization::dateRange($request);

        // Build query with optional department filter
        // Count only completed tickets, grouped by the date they were completed (completed_at)
        $query = QueueTicket::whereIn('status', ['done', 'Completed', 'completed'])
            ->whereNotNull('completed_at')
            ->whereBetween('completed_at', [$startDate, $endDate]);

        if ($department) {
            $query->where(function ($q) use ($department) {
                $q->whereIn('service_type', \App\Services\Departments::types($department));
            });
        }

        // Get daily distribution based on completed_at
        $dailyData = (clone $query)
            ->selectRaw('DATE(completed_at) AS date, COUNT(*) AS total')
            ->groupBy(DB::raw('DATE(completed_at)'))
            ->orderBy('date')
            ->get();

        $totalCustomers = $dailyData->sum('total');
        $busiestDate = null;
        $busiestDateCount = 0;

        $distribution = $dailyData->map(function ($item) use (&$busiestDate, &$busiestDateCount) {
            $count = (int) $item->total;
            if ($count > $busiestDateCount) {
                $busiestDateCount = $count;
                $busiestDate = $item->date;
            }
            return [
                'date' => $item->date,
                'label' => Carbon::parse($item->date)->format('M d, Y'),
                'customers_served' => $count,
            ];
        });

        return response()->json([
            'period' => $period,
            'date_range' => [
                'start' => $startDate->toDateTimeString(),
                'end' => $endDate->toDateTimeString(),
            ],
            'total_customers_served' => $totalCustomers,
            'busiest_date' => $busiestDate,
            'busiest_date_count' => $busiestDateCount,
            'distribution' => $distribution,
        ]);
    }
}