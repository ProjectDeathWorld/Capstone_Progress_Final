<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\ServiceTransaction;
use App\Models\ServiceWindow;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class StaffController extends Controller
{
    
    public function index(Request $request)
    {
        $currentUser = $request->user();
        $isDeptAdmin = $currentUser?->isDeptAdmin();

        $query = User::query()->with('assignedWindow:id,staff_id,department,window_number,service_scope');

        if ($isDeptAdmin) {
            $deptPosition = strtolower((string) $currentUser->position);
            $query->whereRaw("LOWER(TRIM(role)) = ?", ['staff'])
                ->whereRaw("LOWER(TRIM(position)) = ?", [$deptPosition]);
        } else {
            $query->where(function ($q) {
                $q->whereRaw("LOWER(TRIM(role)) = ?", ['staff'])
                    ->orWhereRaw("LOWER(TRIM(role)) = ?", ['security'])
                    ->orWhereRaw("LOWER(TRIM(role)) = ?", ['dept_admin']);
            });
        }

        $staff = $query->select(['user_id', 'username', 'full_name', 'role', 'position', 'status'])
            ->orderBy('full_name')
            ->orderBy('username')
            ->get()
            ->filter(function ($user) {
                $role = strtolower(trim((string) $user->role));
                $position = strtolower(trim((string) $user->position));
                return $role === 'security'
                    || ($role === 'staff' && in_array($position, ['cashier', 'registrar', 'itm', 'admission'], true))
                    || ($role === 'dept_admin' && in_array($position, ['cashier', 'registrar', 'itm', 'admission'], true));
            })
            ->values();

        return response()->json($staff);
    }

    
    public function show($id)
    {
        $currentUser = request()->user();
        if ($currentUser?->isDeptAdmin()) {
            $deptPosition = strtolower((string) $currentUser->position);
            $staff = User::whereRaw('LOWER(TRIM(role)) = ?', ['staff'])
                ->whereRaw('LOWER(TRIM(position)) = ?', [$deptPosition])
                ->select(['user_id', 'username', 'full_name', 'role', 'position', 'status'])
                ->findOrFail($id);
            return response()->json($staff);
        }

        $staff = User::whereIn('role', ['staff', 'security', 'dept_admin'])
            ->select(['user_id', 'username', 'full_name', 'role', 'position', 'status'])
            ->findOrFail($id);
        return response()->json($staff);
    }

    
    public function update(Request $request, $id)
    {
        abort_unless($request->user()?->isAdmin(), 403, 'Only administrators can update staff accounts.');

        $currentUser = $request->user();
        $isDeptAdmin = $currentUser->isDeptAdmin();

        if ($isDeptAdmin) {
            $deptPosition = strtolower((string) $currentUser->position);
            $staff = User::whereRaw('LOWER(TRIM(role)) = ?', ['staff'])
                ->whereRaw('LOWER(TRIM(position)) = ?', [$deptPosition])
                ->findOrFail($id);

            if ($request->has('position')) {
                abort_unless(strtolower((string) $request->position) === $deptPosition, 403, 'Cannot change department.');
            }
            if ($request->has('role')) {
                abort_unless($request->role === 'staff', 403, 'Cannot change role.');
            }
        } else {
            $staff = User::where(function ($query) {
                $query->whereRaw('LOWER(TRIM(role)) = ?', ['staff'])
                    ->orWhereRaw('LOWER(TRIM(role)) = ?', ['security'])
                    ->orWhereRaw('LOWER(TRIM(role)) = ?', ['dept_admin']);
            })->findOrFail($id);
        }

        $rules = [
            'username' => ['sometimes', 'string', 'max:50', Rule::unique('users', 'username')->ignore($staff->user_id, 'user_id')],
            'full_name' => 'sometimes|required|string|max:100',
            'status' => 'sometimes|in:active,inactive',
            'password' => 'nullable|string|min:6|confirmed',
            'assigned_window_id' => 'nullable|integer|exists:service_windows,id',
            'service_scope' => 'nullable|in:department',
        ];

        if ($staff->role === 'security') {
            $rules['security_code'] = 'nullable|string|min:4|max:20|confirmed';
        } elseif ($staff->role === 'dept_admin') {
            $rules['position'] = 'sometimes|required|in:cashier,registrar,itm,admission';
        } else {
            $rules['position'] = 'sometimes|required|in:cashier,registrar,itm,admission';
        }

        $validated = $request->validate($rules, [
            'username.unique' => 'Username already exists.',
            'password.confirmed' => 'New passwords do not match.',
            'security_code.confirmed' => 'Security codes do not match.',
        ]);

        return \Illuminate\Support\Facades\DB::transaction(function () use ($staff, $validated, $request) {
            // Account editing is shared by Cashier, Registrar, and ITM. When the
            // department changes, release the old department's window so queue
            // assignments can never cross department boundaries.
            if (isset($validated['position']) && $validated['position'] !== $staff->position) {
                $newDept = \App\Services\Departments::name($validated['position']);
                ServiceWindow::where('staff_id', $staff->user_id)
                    ->get()
                    ->filter(fn ($w) => \App\Services\Departments::name($w->department) !== $newDept)
                    ->each(fn ($w) => $w->update(['staff_id' => null, 'service_scope' => 'department']));
            }

            if (isset($validated['position']) && $validated['position'] !== $staff->position) {
                $assignedWindow = ServiceWindow::where('staff_id', $staff->user_id)->first();
                if ($assignedWindow && \App\Services\Departments::name($assignedWindow->department) !== \App\Services\Departments::name($validated['position'])) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'position' => 'Remove or update this staff member’s assigned window before changing departments.',
                    ]);
                }
            }

            $data = collect($validated)->only(['username', 'full_name', 'position', 'status'])->all();

            if ($request->filled('password')) {
                $data['password'] = Hash::make($request->password);
            }

            if ($staff->role === 'security' && $request->filled('security_code')) {
                $data['security_code'] = $request->security_code;
            }

            $staff->update($data);

            if (array_key_exists('assigned_window_id', $validated)) {
                ServiceWindow::where('staff_id', $staff->user_id)->update(['staff_id' => null, 'service_scope' => 'department']);
                if ($validated['assigned_window_id']) {
                    $window = ServiceWindow::lockForUpdate()->findOrFail($validated['assigned_window_id']);
                    abort_if($window->staff_id && (int) $window->staff_id !== (int) $staff->user_id, 422, 'That window is already assigned.');
                    abort_unless(\App\Services\Departments::name($window->department) === \App\Services\Departments::name($staff->position), 422, 'The selected window belongs to another department.');
                    $window->update(['staff_id' => $staff->user_id, 'service_scope' => 'department']);
                }
            }

            return response()->json([
                'message' => 'Staff updated successfully',
                'staff' => $staff->fresh()->load('assignedWindow')->only(['user_id', 'username', 'full_name', 'role', 'position', 'status', 'assigned_window'])
            ]);
        });
    }

    
    public function destroy($id)
    {
        $currentUser = request()->user();
        abort_unless($currentUser?->isAdmin(), 403);

        if ($currentUser->isDeptAdmin()) {
            $deptPosition = strtolower((string) $currentUser->position);
            $staff = User::whereRaw('LOWER(TRIM(role)) = ?', ['staff'])
                ->whereRaw('LOWER(TRIM(position)) = ?', [$deptPosition])
                ->findOrFail($id);
        } else {
            $staff = User::whereIn('role', ['staff', 'security', 'dept_admin'])->findOrFail($id);
            abort_if($staff->isHeadAdmin(), 403, 'Cannot delete head administrator.');
        }

        ServiceWindow::where('staff_id', $staff->user_id)->update(['staff_id' => null, 'service_scope' => 'department']);
        $staff->delete();

        return response()->json(['message' => 'Staff deleted successfully']);
    }

    
    public function getPerformance($staffId)
    {
        $currentUser = request()->user();
        if ($currentUser?->isDeptAdmin()) {
            $deptPosition = strtolower((string) $currentUser->position);
            User::whereRaw('LOWER(TRIM(role)) = ?', ['staff'])
                ->whereRaw('LOWER(TRIM(position)) = ?', [$deptPosition])
                ->findOrFail($staffId);
        }

        $transactions = ServiceTransaction::where('staff_id', $staffId)
            ->with('ticket')
            ->get();

        $totalTransactions = $transactions->count();
        $avgDuration = $transactions->avg('duration_seconds');

        $ratingCounts = [
            'Excellent' => $transactions->where('performance_rating', 'Excellent')->count(),
            'Very Good' => $transactions->where('performance_rating', 'Very Good')->count(),
            'Good' => $transactions->where('performance_rating', 'Good')->count(),
            'Fair' => $transactions->where('performance_rating', 'Fair')->count(),
            'Poor' => $transactions->where('performance_rating', 'Poor')->count(),
        ];

        return response()->json([
            'staff_id' => $staffId,
            'total_transactions' => $totalTransactions,
            'avg_duration_seconds' => round($avgDuration, 2),
            'rating_counts' => $ratingCounts,
            'transactions' => $transactions
        ]);
    }
}
