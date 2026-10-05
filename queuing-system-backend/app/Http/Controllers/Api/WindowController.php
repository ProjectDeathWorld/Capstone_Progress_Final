<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServiceWindow;
use App\Models\User;
use Illuminate\Http\Request;

class WindowController extends Controller
{
    private const DEPARTMENT_BY_POSITION = [
        'cashier' => ['department' => 'Cashier', 'service_type' => 'CS', 'max' => 3],
        'registrar' => ['department' => 'registrar', 'service_type' => 'RT', 'max' => 13],
        'itm' => ['department' => 'ITM', 'service_type' => 'ITM', 'max' => 3],
        'admission' => ['department' => 'Admission', 'service_type' => 'ADM', 'max' => 1],
    ];

    private function normalizeDepartment(?string $department): string
    {
        return strtolower(trim((string) $department));
    }

    /**
     * Ensure every configured service window exists in the database.
     */
    protected function seedDefaults()
    {
        $this->seedRegistrarAssignments();
        $this->seedCashierAssignments();

        $windows = [];
        foreach ([
            ['department' => 'Cashier', 'count' => 3, 'service_type' => 'CS'],
            ['department' => 'ITM', 'count' => 3, 'service_type' => 'ITM'],
            ['department' => 'Admission', 'count' => 1, 'service_type' => 'ADM'],
        ] as $group) {
            for ($windowNumber = 1; $windowNumber <= $group['count']; $windowNumber++) {
                $windows[] = [
                    'department' => $group['department'],
                    'window_number' => $windowNumber,
                    'service_type' => $group['service_type'],
                    'is_available' => true,
                    'status' => 'open',
                ];
            }
        }

        foreach ($windows as $row) {
            ServiceWindow::firstOrCreate(
                ['department' => $row['department'], 'window_number' => $row['window_number']],
                ['service_type' => $row['service_type'], 'is_available' => $row['department'] !== 'Admission', 'status' => $row['department'] === 'Admission' ? 'closed' : 'open']
            );
        }
    }

    protected function seedCashierAssignments()
    {
        $mapping = [
            1 => 'cashier1',
            2 => 'cashier2',
            3 => 'cashier3',
        ];

        foreach ($mapping as $windowNumber => $username) {
            $staff = User::where('username', $username)
                ->where('role', 'staff')
                ->where('status', 'active')
                ->first();

            if (!$staff) {
                continue;
            }

            $window = ServiceWindow::firstOrNew([
                'department' => 'Cashier',
                'window_number' => $windowNumber,
            ]);

            $window->department = 'Cashier';
            $window->window_number = $windowNumber;
            $window->service_type = 'CS';

            if ($window->staff_id === null) {
                $alreadyAssigned = ServiceWindow::where('staff_id', $staff->user_id)
                    ->where('id', '<>', $window->id ?? 0)
                    ->exists();
                if (!$alreadyAssigned) {
                    $window->staff_id = $staff->user_id;
                }
            }

            if (!$window->exists) {
                $window->is_available = true;
                $window->status = 'open';
                $window->disabled_reason = null;
            }

            $window->save();
        }
    }

    protected function seedRegistrarAssignments()
    {
        $mapping = [
            9 => 'registrar1',
            10 => 'registrar2',
            11 => 'registrar3',
            12 => 'registrar4',
            13 => 'registrar5',
            14 => 'registrar6',
        ];

        foreach ($mapping as $windowNumber => $username) {
            $staff = User::where('username', $username)
                ->where('role', 'staff')
                ->where('position', 'registrar')
                ->where('status', 'active')
                ->first();

            if (!$staff) {
                continue;
            }

            $window = ServiceWindow::firstOrNew([
                'department' => 'registrar',
                'window_number' => $windowNumber,
            ]);

            $window->department = 'registrar';
            $window->window_number = $windowNumber;
            $window->service_type = 'RT';

            if ($window->staff_id === null) {
                $alreadyAssigned = ServiceWindow::where('staff_id', $staff->user_id)
                    ->where('id', '<>', $window->id ?? 0)
                    ->exists();
                if (!$alreadyAssigned) {
                    $window->staff_id = $staff->user_id;
                }
            }

            if (!$window->exists) {
                $window->is_available = true;
                $window->status = 'open';
                $window->disabled_reason = null;
            }

            $window->save();
        }

        ServiceWindow::whereRaw('LOWER(department) = ?', ['registrar'])
            ->update(['department' => 'registrar']);
    }

    /**
     * Get availability status of all service windows.
     */
    public function index(Request $request)
    {
        $this->seedDefaults();

        $currentUser = $request->user('sanctum') ?? $request->user();
        if ($currentUser?->isDeptAdmin()) {
            $userDept = strtolower((string) $currentUser->position);
            if ($request->filled('department')) {
                $reqDept = strtolower((string) $request->query('department'));
                abort_unless($reqDept === $userDept, 403, 'Access denied to other departments.');
            }
            $department = $userDept;
        } else {
            $department = $request->query('department');
        }

        $query = ServiceWindow::with([
            'staff' => fn ($staffQuery) => $staffQuery->select('user_id', 'username', 'full_name', 'role', 'position', 'status'),
        ])
            ->orderByRaw('LOWER(department)')
            ->orderBy('window_number');

        if ($department !== null && $department !== '') {
            $query->whereRaw('LOWER(department) = ?', [strtolower($department)]);
        }

        $windows = $query->get();

        return response()->json([
            'success' => true,
            'windows' => $windows,
            'enabled_departments' => \App\Services\Departments::enabled(),
        ]);
    }

    /**
     * Toggle availability status of a specific window.
     */
    public function toggleAvailability(Request $request)
    {
        if (strtolower(trim((string) $request->user()?->role)) === 'staff') {
            return response()->json([
                'message' => 'Staff can only update their own assigned Registrar window.',
            ], 403);
        }

        $request->validate([
            'department' => 'required|string',
            'window_number' => 'required|integer|min:1|max:13',
            'is_available' => 'required|boolean',
        ]);

        $normalizedDepartment = $this->normalizeDepartment($request->department);
        abort_unless(in_array($normalizedDepartment, ['cashier', 'registrar', 'itm', 'admission'], true), 422, 'Invalid service department.');

        $currentUser = $request->user();
        if ($currentUser?->isDeptAdmin()) {
            $userDept = strtolower((string) $currentUser->position);
            abort_unless($normalizedDepartment === $userDept, 403, 'You can only toggle windows in your own department.');
        }
        $request->validate([
            'window_number' => 'required|integer|min:1|max:'.self::DEPARTMENT_BY_POSITION[$normalizedDepartment]['max'],
        ]);
        $serviceType = self::DEPARTMENT_BY_POSITION[$normalizedDepartment]['service_type'];
        \App\Services\Departments::assertEnabled($normalizedDepartment);

        $window = ServiceWindow::updateOrCreate(
            [
                'department' => $normalizedDepartment,
                'window_number' => (int) $request->window_number,
            ],
            [
                'service_type' => $serviceType,
                'is_available' => $request->is_available,
                'status' => $request->is_available ? 'open' : 'closed',
                'disabled_reason' => $request->is_available ? null : 'Closed by assigned staff',
            ]
        );

        return response()->json([
            'message' => 'Window availability updated successfully',
            'window' => $window,
        ]);
    }

    /** Get the authenticated staff member's assigned service window. */
    public function assigned(Request $request)
    {
        $this->seedDefaults();
        $staff = $request->user();
        $window = $this->resolveAssignedWindow($staff);

        if (!$window) {
            abort(403, 'This account is not assigned to a service window.');
        }

        return response()->json($window->load('staff'));
    }

    /** Get the authenticated staff member's assigned service window, returning a simplified payload. */
    public function currentWindow(Request $request)
    {
        $this->seedDefaults();
        $staff = $request->user();
        $window = $this->resolveAssignedWindow($staff);

        if (!$window) {
            abort(403, 'This account is not assigned to a service window.');
        }

        return response()->json([
            'window_number' => $window->window_number,
            'department' => $window->department,
            'status' => $window->status,
            'service_scope' => $window->service_scope ?? 'department',
            'department_enabled' => in_array(\App\Services\Departments::name($window->department), \App\Services\Departments::enabled(), true),
            'recent_activity' => \App\Models\ServiceLog::where('user_id', $staff->user_id)
                ->orderByDesc('created_at')->orderByDesc('log_id')->limit(10)->get(['log_id', 'action', 'created_at']),
        ]);
    }

    /** Open or close only the authenticated staff member's assigned window. */
    public function updateAssigned(Request $request)
    {
        return $this->updateAssignedStatus($request);
    }

    public function updateAssignedStatus(Request $request)
    {
        $request->validate(['status' => 'required|in:open,closed']);
        $staff = $request->user();

        if (!$staff || strtolower(trim((string) $staff->role)) !== 'staff' || strtolower(trim((string) $staff->position)) !== 'registrar') {
            return response()->json([
                'message' => 'Only Registrar staff can open or close a service window.',
            ], 403);
        }

        $window = $this->resolveAssignedWindow($staff);

        if (!$window) {
            abort(403, 'This account is not assigned to a service window.');
        }

        $isOpen = $request->status === 'open';
        $window->is_available = $isOpen;
        $window->status = $request->status;
        $window->disabled_reason = $isOpen ? null : 'Closed by assigned staff';
        $window->save();
        \App\Models\ServiceLog::create(['user_id' => $staff->user_id, 'action' => $window->department.' Window '.$window->window_number.' '.$request->status, 'created_at' => now()]);

        return response()->json([
            'message' => "Window {$window->window_number} is now {$request->status}.",
            'window' => $window->fresh()->load('staff'),
        ]);
    }

    private function resolveAssignedWindow(?User $staff): ?ServiceWindow
    {
        if (!$staff || $staff->role !== 'staff') {
            return null;
        }

        $position = strtolower((string) ($staff->position ?? ''));

        $deptName = \App\Services\Departments::name($position);
        $window = ServiceWindow::where('staff_id', $staff->user_id)
            ->where(function ($q) use ($position, $deptName) {
                $q->whereRaw('LOWER(department) = ?', [$position]);
                if ($deptName) {
                    $q->orWhereRaw('LOWER(department) = ?', [strtolower($deptName)]);
                }
            })->first();

        if ($window) {
            return $window;
        }

        if (in_array($position, ['itm', 'admission'], true)) return null;

        $assignment = self::DEPARTMENT_BY_POSITION[$position] ?? null;
        if (!$assignment) {
            return null;
        }

        preg_match('/(\d+)/', (string) $staff->username, $matches);
        $windowNumber = isset($matches[1]) ? (int) $matches[1] : 0;

        $department = $assignment['department'];
        if ($position === 'registrar' && $windowNumber >= 9 && $windowNumber <= 14) {
            $windowNumber -= 8;
        }

        if ($windowNumber < 1 || $windowNumber > $assignment['max']) {
            return null;
        }

        $resolved = ServiceWindow::whereRaw('LOWER(department) = ?', [strtolower((string) $department)])
            ->where('window_number', $windowNumber)
            ->first();

        if ($resolved) {
            if ($resolved->staff_id === null) {
                $alreadyAssigned = ServiceWindow::where('staff_id', $staff->user_id)
                    ->where('id', '<>', $resolved->id)
                    ->exists();
                if (!$alreadyAssigned) {
                    $resolved->update(['staff_id' => $staff->user_id]);
                }
            }
            return $resolved;
        }

        return null;
    }
}
