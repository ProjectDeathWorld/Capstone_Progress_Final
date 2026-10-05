<?php

namespace App\Http\Middleware;

use App\Services\Departments;
use Closure;
use Illuminate\Http\Request;

class EnsureDepartmentEnabled
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if (($user?->role === 'staff' || $user?->isDeptAdmin()) && !$request->is('api/logout', 'api/me')) {
            abort_unless(strtolower((string) $user->status) === 'active', 403, 'This account is inactive.');
            Departments::assertEnabled($user->position);
        }
        return $next($request);
    }
}
