<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Throwable $exception, $request) {
            if (! $request->expectsJson() && ! str_starts_with($request->path(), 'api/')) {
                return null;
            }

            if ($exception instanceof \PDOException || $exception instanceof \Illuminate\Database\QueryException) {
                return response()->json([
                    'database' => env('DB_DATABASE', 'laravel'),
                    'status' => 'Disconnected',
                    'message' => 'Database connection unavailable. Please make sure MySQL is running.',
                ], 503);
            }

            return null;
        });
    })->create();
