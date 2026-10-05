<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\QueueReport;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function getReport(Request $request, QueueReport $reports)
    {
        return response()->json($reports->build($request));
    }
}
