<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\ServiceLog;
use App\Models\ServiceWindow;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        abort_unless($request->user()?->isAdmin(), 403, 'Only administrators can create staff accounts.');

        $isDeptAdmin = $request->user()->isDeptAdmin();
        if ($isDeptAdmin) {
            abort_if($request->role !== 'staff', 403, 'Department administrators can only create staff accounts.');
            $deptPosition = strtolower((string) $request->user()->position);
            abort_unless(strtolower((string) $request->position) === $deptPosition, 403, 'You can only create staff for your assigned department.');
        }

        $validator = Validator::make($request->all(), [
            'username' => 'required|string|max:50|unique:users',
            'password' => 'required|string|min:6|confirmed',
            'full_name' => 'required|string|max:100',
            'role' => 'required|in:admin,dept_admin,staff,security',
            'position' => 'nullable|required_if:role,dept_admin|in:cashier,registrar,itm,admission',
            'security_code' => 'nullable|required_if:role,security|string|min:4|max:20|confirmed',
            'security_code_confirmation' => 'nullable|string|max:20',
            'status' => 'nullable|in:active,inactive',
            'assigned_window_id' => 'nullable|integer|exists:service_windows,id',
            'service_scope' => 'nullable|in:department',
        ], [
            'username.unique' => 'Username already exists.',
            'password.confirmed' => 'Passwords do not match.',
            'security_code.confirmed' => 'Security codes do not match.',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = [
            'username' => $request->username,
            'password' => $request->password,
            'full_name' => $request->full_name,
            'role' => $request->role,
            'position' => $request->position,
            'status' => $request->status ?? 'active'
        ];

        // Security users get a security_code (PIN for kiosk priority authorization)
        if ($request->role === 'security' && $request->security_code) {
            $data['security_code'] = $request->security_code;
        }

        return \Illuminate\Support\Facades\DB::transaction(function () use ($data, $request) {
            $user = User::create($data);

            if ($user->role === 'staff' && $request->filled('assigned_window_id')) {
                $window = ServiceWindow::lockForUpdate()->findOrFail($request->assigned_window_id);
                abort_if($window->staff_id, 422, 'That window is already assigned.');
                abort_unless(\App\Services\Departments::name($window->department) === \App\Services\Departments::name($user->position), 422, 'The selected window belongs to another department.');
                $scope = 'department';
                $window->update(['staff_id' => $user->user_id, 'service_scope' => $scope]);
            }

            // Log the action
            ServiceLog::create([
                'user_id' => $user->user_id,
                'action' => 'User registered: ' . $user->username,
                'created_at' => now()
            ]);

            return response()->json([
                'message' => 'User registered successfully',
                'user' => $user
            ], 201);
        });
    }

    // Login
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $username = trim($request->username);

        try {
            $user = User::where('username', $username)->first();
            if (!$user) {
                $candidates = User::whereRaw('LOWER(username) = ?', [strtolower($username)])->get();
                if ($candidates->count() === 1) {
                    $user = $candidates->first();
                }
            }
        } catch (\Throwable $exception) {
            Log::error('Login database lookup failed', [
                'username' => $username,
                'exception' => $exception::class,
            ]);

            return response()->json(['message' => 'Database connection unavailable.'], 503);
        }

        if (!$user) {
            return response()->json(['message' => 'Invalid username or password.'], 401);
        }

        $passwordInfo = password_get_info((string) $user->password);
        $passwordIsHashed = ($passwordInfo['algoName'] ?? 'unknown') !== 'unknown';
        $passwordMatches = $passwordIsHashed
            ? Hash::check($request->password, $user->password)
            : hash_equals((string) $user->password, (string) $request->password);

        if (!$passwordMatches) {
            return response()->json(['message' => 'Invalid username or password.'], 401);
        }

        if (strtolower(trim((string) $user->status)) !== 'active') {
            return response()->json(['message' => 'This account is inactive.'], 403);
        }

        if ($user->role === 'staff' || $user->isDeptAdmin()) {
            \App\Services\Departments::assertEnabled($user->position);
        }

        try {
            if ($passwordIsHashed) {
                $user->password = $request->password;
                $user->save();
            }

            $token = $user->createToken('auth_token')->plainTextToken;

            ServiceLog::create([
                'user_id' => $user->user_id,
                'action' => 'User logged in: ' . $user->username,
                'created_at' => now()
            ]);
        } catch (\Throwable $exception) {
            Log::error('Login token creation failed', [
                'user_id' => $user->user_id,
                'username' => $user->username,
                'exception' => $exception::class,
            ]);

            return response()->json(['message' => 'Unable to process login. Please try again.'], 500);
        }

        return response()->json([
            'message' => 'Login successful',
            'user' => $user,
            'token' => $token
        ], 200);
    }

    // Logout
    public function logout(Request $request)
    {
        $user = $request->user();
        
        // Log the action
        ServiceLog::create([
            'user_id' => $user->user_id,
            'action' => 'User logged out: ' . $user->username,
            'created_at' => now()
        ]);

        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logout successful'], 200);
    }

    // Get current user
    public function me(Request $request)
    {
        return response()->json($request->user());
    }
}
