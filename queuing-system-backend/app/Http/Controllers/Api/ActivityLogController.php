<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServiceLog;
use App\Models\QueueTicket;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    /**
     * Get live activity logs joined with staff/user information.
     */
    public function getActivityLogs(Request $request)
    {
        $request->validate([
            'date' => 'nullable|date_format:Y-m-d',
            'start_date' => 'nullable|date_format:Y-m-d',
            'end_date' => 'nullable|date_format:Y-m-d|after_or_equal:start_date',
        ]);
        $startDate = $request->filled('start_date')
            ? Carbon::parse($request->query('start_date'), 'Asia/Manila')->startOfDay()
            : ($request->filled('date')
                ? Carbon::parse($request->query('date'), 'Asia/Manila')->startOfDay()
                : Carbon::today('Asia/Manila')->startOfDay());
        $endDate = $request->filled('start_date')
            ? Carbon::parse($request->query('end_date', $request->query('start_date')), 'Asia/Manila')->addDay()->startOfDay()
            : $startDate->copy()->addDay();
        $logs = ServiceLog::with('user')
            ->where('created_at', '>=', $startDate->copy()->utc())
            ->where('created_at', '<', $endDate->copy()->utc())
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($log) {
                $user = $log->user;
                $staffName = $user ? ($user->full_name ?: $user->username) : 'System';

                $department = 'Admin';
                $window = 'N/A';

                if ($user) {
                    $pos = strtolower($user->position ?? $user->role);
                    if ($pos === 'cashier') {
                        $department = 'Cashier';
                    } elseif ($pos === 'registrar') {
                        $department = 'Registrar';
                    } elseif (in_array($pos, ['itm', 'admission'], true)) {
                        $department = \App\Services\Departments::name($pos);
                    } elseif ($pos === 'security') {
                        $department = 'Security';
                    } else {
                        $department = ucfirst($user->role);
                    }

                    preg_match('/(\d+)/', $user->username, $matches);
                    $winNum = isset($matches[1]) ? (int) $matches[1] : 1;

                    if ($department === 'Cashier') {
                        $window = "Cashier {$winNum}";
                    } elseif ($department === 'Registrar') {
                        $window = "Registrar {$winNum}";
                    } elseif (in_array($department, ['ITM', 'Admission'], true)) {
                        $winNum = $user->assignedWindow?->window_number ?? $winNum;
                        $window = "{$department} {$winNum}";
                    } elseif ($department === 'Security') {
                        $window = "Gate {$winNum}";
                    } else {
                        $window = "Window {$winNum}";
                    }
                }

                return [
                    'log_id' => $log->log_id,
                    'staff_name' => $staffName,
                    'username' => $user ? $user->username : '',
                    'department' => $department,
                    'assigned_window' => $window,
                    'action' => $log->action,
                    'created_at' => $log->created_at ? $log->created_at->copy()->setTimezone('Asia/Manila')->format('Y-m-d H:i:s') : '',
                ];
            });

        $currentUser = $request->user('sanctum') ?? $request->user();
        if ($currentUser?->isDeptAdmin()) {
            $logs = $logs->filter(fn ($item) => $item['department'] === $currentUser->department)->values();
        }

        return response()->json($logs);
    }

    /**
     * Get live queue history records from queue_tickets table.
     */
    public function getQueueHistory(Request $request)
    {
        $request->validate([
            'period' => 'nullable|string',
            'start_date' => 'nullable|date_format:Y-m-d',
            'end_date' => 'nullable|date_format:Y-m-d|after_or_equal:start_date',
        ]);
        $period = strtolower($request->query('period', 'today'));
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        $baseQuery = QueueTicket::with('serviceTransaction.staff')->orderBy('created_at', 'desc');
        $currentUser = $request->user('sanctum') ?? $request->user();
        if ($currentUser?->isDeptAdmin()) {
            $baseQuery->whereIn('service_type', \App\Services\Departments::types($currentUser->department));
        }

        if ($period === 'custom' && $startDate) {
            $start = Carbon::parse($startDate, 'Asia/Manila')->startOfDay();
            $end = Carbon::parse($endDate ?: $startDate, 'Asia/Manila')->addDay()->startOfDay();
            $baseQuery
                ->where('created_at', '>=', $start->copy()->utc())
                ->where('created_at', '<', $end->copy()->utc());
        } elseif ($period !== 'all') {
            $start = Carbon::today('Asia/Manila')->startOfDay();
            $end = Carbon::today('Asia/Manila')->endOfDay();

            if ($period === 'week' || $period === 'weekly') {
                $start = Carbon::now('Asia/Manila')->startOfWeek()->startOfDay();
                $end = Carbon::now('Asia/Manila')->endOfWeek()->endOfDay();
            } elseif ($period === 'month' || $period === 'monthly') {
                $start = Carbon::now('Asia/Manila')->startOfMonth()->startOfDay();
                $end = Carbon::now('Asia/Manila')->endOfMonth()->endOfDay();
            } elseif ($period === 'semester') {
                $start = Carbon::now('Asia/Manila')->subMonths(6)->startOfDay();
                $end = Carbon::now('Asia/Manila')->endOfDay();
            }

            $baseQuery->whereBetween('created_at', [$start->copy()->utc(), $end->copy()->utc()]);
        }

        $tickets = $baseQuery->get()->map(function ($ticket) {
                // Department determination
                $dept = 'Cashier';
                if (in_array($ticket->service_type, ['ITM', 'ADM'], true)) {
                    $dept = \App\Services\Departments::name($ticket->service_type);
                } elseif (in_array($ticket->service_type, ['R', 'RT'])) {
                    $dept = 'Registrar';
                }

                // Service Type (Regular vs Priority)
                $isPriority = ($ticket->priority_type === 'P' || str_contains(strtoupper($ticket->ticket_number), 'P'));
                $serviceTypeLabel = $isPriority ? 'Priority' : 'Regular';

                // Assigned Window determination
                $windowLabel = 'N/A';
                if ($ticket->window) {
                    $windowLabel = "{$dept} {$ticket->window}";
                } elseif ($ticket->serviceTransaction && $ticket->serviceTransaction->staff) {
                    $staffUser = $ticket->serviceTransaction->staff;
                    preg_match('/(\d+)/', $staffUser->username, $matches);
                    $winNum = isset($matches[1]) ? (int) $matches[1] : 1;
                    $windowLabel = "{$dept} {$winNum}";
                }

                return [
                    'ticket_id' => $ticket->ticket_id,
                    'student_number' => $ticket->student_number ?: 'Guest',
                    'ticket_number' => $ticket->ticket_number,
                    'department' => $dept,
                    'service_type' => $serviceTypeLabel,
                    'status' => ucfirst($ticket->status),
                    'created_at' => $ticket->created_at ? $ticket->created_at->copy()->setTimezone('Asia/Manila')->format('Y-m-d H:i:s') : '—',
                    'called_at' => $ticket->called_at ? $ticket->called_at->copy()->setTimezone('Asia/Manila')->format('Y-m-d H:i:s') : '—',
                    'completed_at' => $ticket->completed_at ? $ticket->completed_at->copy()->setTimezone('Asia/Manila')->format('Y-m-d H:i:s') : '—',
                    'window' => $windowLabel,
                ];
            });

        return response()->json($tickets);
    }
}
