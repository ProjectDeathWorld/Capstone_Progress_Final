<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Departments;
use App\Services\IntelligenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IntelligenceController extends Controller
{
    protected IntelligenceService $intelligenceService;

    public function __construct(IntelligenceService $intelligenceService)
    {
        $this->intelligenceService = $intelligenceService;
    }

    /**
     * Get predicted waiting time intelligence for departments.
     * Enforces server-side department isolation for Department Admins.
     */
    public function getPredictedWaitTime(Request $request): JsonResponse
    {
        $currentUser = $request->user('sanctum') ?? $request->user();

        if ($currentUser?->isDeptAdmin()) {
            $userDept = $currentUser->department;

            if ($request->filled('department')) {
                $requestedDept = Departments::name($request->query('department'));
                abort_unless($requestedDept === $userDept, 403, 'Access denied: You can only view intelligence for your assigned department.');
            }

            $targetDepartments = $userDept ? [$userDept] : [];
        } else {
            // Head Admin can query all active departments or a specific one
            if ($request->filled('department')) {
                $requestedDept = Departments::name($request->query('department'));
                $targetDepartments = $requestedDept ? [$requestedDept] : [];
            } else {
                $targetDepartments = $this->intelligenceService->getActiveDepartments();
            }
        }

        $predictions = $this->intelligenceService->getPredictionsForDepartments($targetDepartments);

        return response()->json([
            'success' => true,
            'predictions' => $predictions,
            'data' => $predictions,
            'is_dept_admin' => (bool) $currentUser?->isDeptAdmin(),
            'user_department' => $currentUser?->department,
        ]);
    }
}
