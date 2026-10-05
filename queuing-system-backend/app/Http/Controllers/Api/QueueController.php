<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\QueueTicket;
use App\Models\ServiceTransaction;
use App\Models\ServiceLog;
use App\Models\ServiceWindow;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\QueryException;

class QueueController extends Controller
{
    /**
     * Normalize incoming service type values to the database enum values.
     *
     * The frontend still submits CS / RT in requests, but the existing MySQL
     * schema stores the shorter C / R values for service_type.
     */
    protected function normalizeServiceType(?string $serviceType)
    {
        if (!is_string($serviceType)) {
            return null;
        }

        $serviceType = strtoupper(trim($serviceType));

        return match ($serviceType) {
            'CS' => 'C',
            'RT' => 'R',
            'ADMISSION', 'ASSESSMENT' => 'ADM',
            default => $serviceType,
        };
    }

    protected function resolveStaffServiceType(?User $staff): ?string
    {
        if (!$staff) {
            return null;
        }

        $position = strtolower((string) ($staff->position ?? ''));

        return match ($position) {
            'cashier' => 'C',
            'registrar' => 'R',
            'itm' => 'ITM',
            'admission' => 'ADM',
            'assessment' => 'ADM',
            default => null,
        };
    }

    protected function resolveStaffServiceTypes(?User $staff): array
    {
        if (!$staff) {
            return [];
        }

        $position = strtolower((string) ($staff->position ?? ''));

        return match ($position) {
            'cashier' => ['C'],
            'registrar' => ['R'],
            'itm' => ['ITM'],
            'admission' => ['ADM'],
            'assessment' => ['ADM'],
            default => [],
        };
    }

    protected function resolveStaffWindowNumber(?User $staff): ?int
    {
        if (!$staff) {
            return null;
        }

        $position = strtolower((string) ($staff->position ?? ''));

        if ($position === 'registrar') {
            return ServiceWindow::whereRaw('LOWER(department) = ?', ['registrar'])
                ->where('staff_id', $staff->user_id)
                ->value('window_number');
        }

        if (in_array($position, ['itm', 'admission', 'assessment'], true)) {
            $department = $position === 'assessment' ? 'admission' : $position;
            $databaseWindow = \App\Models\ServiceWindow::where('staff_id', $staff->user_id)
                ->whereRaw('LOWER(department) = ?', [$department])
                ->value('window_number');

            if ($databaseWindow !== null) {
                return (int) $databaseWindow;
            }

            return $databaseWindow !== null ? (int) $databaseWindow : null;
        }

        if ($position === 'cashier') {
            $databaseWindow = \App\Models\ServiceWindow::whereRaw('LOWER(department) = ?', ['cashier'])
                ->where('staff_id', $staff->user_id)
                ->value('window_number');

            if ($databaseWindow !== null) {
                return (int) $databaseWindow;
            }

            $username = (string) ($staff->username ?? '');
            preg_match('/(\d+)/', $username, $matches);
            $accountWindowNumber = isset($matches[1]) ? (int) $matches[1] : null;

            return $accountWindowNumber !== null ? $accountWindowNumber : null;
        }

        return null;
    }

    // Verify a security code is valid (used by the kiosk before showing priority option)
    public function verifySecurityCode(Request $request)
    {
        $request->validate([
            'security_code' => 'required|string',
        ]);

        $securityUserName = User::where('role', 'security')
            ->where('security_code', $request->security_code)
            ->where('status', 'active')
            ->value('full_name');

        if (!$securityUserName) {
            return response()->json(['valid' => false, 'message' => 'Invalid security code'], 401);
        }

        return response()->json([
            'valid' => true,
            'message' => 'Security code verified',
            'security_user' => $securityUserName
        ]);
    }

    public function generateTicket(Request $request)
    {
        $rules = [
            'service_type' => 'required|in:CS,RT,C,R,ITM,ADM,Admission,Assessment',
            'transaction_type' => 'nullable|string|max:50',
            'student_number' => 'nullable|string|max:30',
        ];

        // If priority_type is provided, validate it
        if ($request->has('priority_type')) {
            $rules['priority_type'] = 'in:R,P';
        }

        // If requesting priority, security_code is required
        if ($request->priority_type === 'P') {
            $rules['security_code'] = 'required|string';
        }

        // Student Registrar tickets are routed from the directory, never from
        // a client-supplied window.  The legacy Guest path remains the sole
        // authorized manual fallback.
        if ($request->service_type === 'RT' || $request->service_type === 'R') {
            $rules['student_number'] = 'required|string|max:30';
        }

        $request->validate($rules);

        // Determine the ticket label letter (R or P) using the current priority schema.
        $requestedPriorityType = $request->priority_type ?? 'R';
        $dbServiceType = $this->normalizeServiceType($request->service_type);
        \App\Services\Departments::assertEnabled($dbServiceType);
        if (in_array($dbServiceType, ['ITM', 'ADM'], true)) {
            $available = ServiceWindow::whereRaw('LOWER(department) = ?', [strtolower(\App\Services\Departments::name($dbServiceType))])
                ->where('is_available', true)->where('status', 'open')
                ->whereHas('staff', fn ($q) => $q->where('role', 'staff')->where('status', 'active')->whereRaw('LOWER(position) = ?', [strtolower(\App\Services\Departments::name($dbServiceType))]))->exists();
            abort_unless($available, 409, 'This department has no available staffed window.');
        }
        $ticketPriorityLetter = $requestedPriorityType === 'P' ? 'P' : (in_array($dbServiceType, ['ITM', 'ADM'], true) ? 'N' : 'R');
        $priorityType = $requestedPriorityType === 'P' ? 'P' : 'R';

        // Validate security code for priority tickets
        if ($request->priority_type === 'P') {
            $securityUserExists = User::where('role', 'security')
                ->where('security_code', $request->security_code)
                ->where('status', 'active')
                ->exists();

            if (!$securityUserExists) {
                return response()->json(['message' => 'Invalid security code. Only security personnel can authorize priority tickets.'], 403);
            }
        }

        $isRegistrar = ($request->service_type === 'RT' || $request->service_type === 'R');
        $student = null;
        $resolvedWindow = null;
        if ($isRegistrar) {
            $studentNumber = trim((string) $request->student_number);
            if (strtolower($studentNumber) === 'guest') {
                $request->validate(['window' => 'required|integer|in:9,10,11,12,13']);
                $resolvedWindow = (int) $request->window;
            } else {
                if (!preg_match('/^\d{4}-23$/', $studentNumber)) {
                    return response()->json(['message' => 'Student not found. Please check your Student Number.'], 404);
                }
                $student = Student::where('student_number', $studentNumber)->first();
                if (!$student) {
                    return response()->json(['message' => 'Student not found. Please check your Student Number.'], 404);
                }
                $resolvedWindow = Student::registrarWindowForCourse($student->course);
                if (!$resolvedWindow || (int) $student->registrar_window !== $resolvedWindow) {
                    return response()->json(['message' => 'Registrar window assignment unavailable. Please proceed to the Registrar/Help Desk.'], 422);
                }
            }

            // Availability is checked after the authoritative routing lookup.
            $winRecord = ServiceWindow::whereRaw('LOWER(department) = ?', ['registrar'])
                ->where('window_number', $resolvedWindow)
                ->first();

            if (!$winRecord || strtolower((string) $winRecord->status) !== 'open' || !$winRecord->is_available) {
                return response()->json([
                    'success' => false,
                    'message' => 'This Registrar window is currently unavailable.'
                ], 409);
            }
        }

        $allowedTransactionTypes = match ($dbServiceType) {
            'C' => ['Payment', 'Clearance', 'Others'],
            'R' => ['Document Request', 'Clearance', 'Others'],
            'ITM' => ['ITM Service'],
            'ADM' => ['Admission Service'],
            default => [],
        };

        if ($request->filled('transaction_type') && !in_array($request->transaction_type, $allowedTransactionTypes, true)) {
            return response()->json(['message' => 'Invalid transaction type for the selected department.'], 422);
        }

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $servicePrefix = $dbServiceType;
            $legacyServicePrefix = $request->service_type;
            $ticketNumberPrefix = $servicePrefix . '-' . $ticketPriorityLetter;

            $ticketQuery = QueueTicket::where(function ($query) use ($servicePrefix, $legacyServicePrefix) {
                $query->where('ticket_number', 'LIKE', $servicePrefix . '-%')
                    ->orWhere('ticket_number', 'LIKE', $legacyServicePrefix . '-%');
            });

            if ($ticketPriorityLetter === 'P') {
                $ticketQuery->where(function ($query) use ($ticketNumberPrefix, $legacyServicePrefix) {
                    $query->where('ticket_number', 'LIKE', $ticketNumberPrefix . '%')
                        ->orWhere('ticket_number', 'LIKE', $legacyServicePrefix . '-' . 'P%');
                });
            } else {
                $ticketQuery->where(function ($query) use ($servicePrefix, $legacyServicePrefix) {
                    $query->where(function ($subQuery) use ($servicePrefix) {
                        $subQuery->where('ticket_number', 'LIKE', $servicePrefix . '-R%')
                            ->orWhere('ticket_number', 'LIKE', $servicePrefix . '-N%');
                    })->orWhere(function ($subQuery) use ($legacyServicePrefix) {
                        $subQuery->where('ticket_number', 'LIKE', $legacyServicePrefix . '-R%')
                            ->orWhere('ticket_number', 'LIKE', $legacyServicePrefix . '-N%');
                    });
                });
            }

            $lastNumber = 0;
            $candidateTickets = $ticketQuery->get(['ticket_number']);
            foreach ($candidateTickets as $candidateTicket) {
                preg_match('/(\d+)$/', $candidateTicket->ticket_number, $suffix);
                $lastNumber = max($lastNumber, (int) ($suffix[1] ?? 0));
            }

            if (in_array($dbServiceType, ['ITM', 'ADM'], true)) {
                $prefix = $dbServiceType.$ticketPriorityLetter.'-';
                foreach (QueueTicket::where('ticket_number', 'like', $prefix.'%')->pluck('ticket_number') as $number) {
                    $lastNumber = max($lastNumber, (int) substr($number, strlen($prefix)));
                }
                $ticketNumberPrefix = $prefix;
            }
            $newNumber = str_pad($lastNumber + 1, in_array($dbServiceType, ['ITM', 'ADM'], true) ? 4 : 3, '0', STR_PAD_LEFT);
            $ticketNumber = $ticketNumberPrefix . $newNumber;
            try {
                $ticket = QueueTicket::create([
                    'ticket_number' => $ticketNumber,
                    'service_type' => $dbServiceType,
                    'transaction_type' => $request->transaction_type ?? (in_array($dbServiceType, ['ITM', 'ADM'], true) ? \App\Services\Departments::name($dbServiceType).' Service' : null),
                    'student_number' => $request->student_number,
                    'student_name' => $student?->student_name,
                    'course' => $student?->course,
                    'priority_type' => $priorityType,
                    'status' => 'waiting',
                    'window' => $isRegistrar ? $resolvedWindow : null,
                    'created_at' => now()
                ]);
                break;
            } catch (QueryException $exception) {
                if ($attempt === 4 || !in_array((string) $exception->getCode(), ['23000', '19'], true)) {
                    throw $exception;
                }
            }
        }

        $printResult = ['success' => false];
        try {
            $printResult = \App\Services\ThermalPrinterService::printTicket($ticket);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::info('Thermal print error: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'Ticket generated successfully',
            'ticket' => $ticket,
            'print' => $printResult,
        ], 201);
    }

    public function printTicket($ticketId)
    {
        $ticket = QueueTicket::findOrFail($ticketId);
        $printResult = \App\Services\ThermalPrinterService::printTicket($ticket);

        return response()->json([
            'message' => 'Thermal print dispatched',
            'ticket' => $ticket,
            'print' => $printResult,
        ]);
    }


    public function getAllTickets()
    {
        $currentUser = request()->user('sanctum') ?? request()->user();
        $query = QueueTicket::with('serviceTransaction.staff')->orderBy('created_at', 'desc');
        if ($currentUser?->isDeptAdmin()) {
            $query->whereIn('service_type', \App\Services\Departments::types($currentUser->department));
        }
        $tickets = $query->get();

        return response()->json($tickets);
    }


    public function getWaitingTickets(Request $request)
    {
        $serviceType = $request->query('service_type');
        $window = $request->query('window');
        $dbServiceType = $this->normalizeServiceType($serviceType);

        $query = QueueTicket::whereIn('status', ['waiting', 'Waiting'])
            ->whereIn('service_type', \App\Services\Departments::enabledTypes());

        if ($serviceType) {
            $query->where('service_type', $dbServiceType);
        }

        // Registrar queues are isolated to the exact selected kiosk window.
        if (($serviceType === 'RT' || $serviceType === 'R') && $window) {
            $query->where('window', (int) $window);
        }

        $tickets = $query->orderByRaw("CASE
                WHEN priority_type = 'P' THEN 1
                WHEN priority_type = 'R' THEN 2
                ELSE 3
            END")
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json($tickets);
    }

    /** Waiting queue for the authenticated staff member, restricted by role and ITM scope. */
    public function getStaffWaitingTickets(Request $request)
    {
        $staff = $request->user();
        abort_unless($staff && strtolower((string) $staff->role) === 'staff', 403);

        $position = strtolower((string) $staff->position);
        $allowed = $this->resolveStaffServiceTypes($staff);

        $query = QueueTicket::whereRaw('LOWER(status) = ?', ['waiting'])->whereIn('service_type', $allowed);
        $window = $this->resolveStaffWindowNumber($staff);
        if ($position === 'registrar') {
            if (!$window) {
                return response()->json([
                    'message' => 'This Registrar account is not assigned to a service window.',
                ], 422);
            }
            $query->where('window', $window);
        }

        return response()->json($query
            ->orderByRaw("CASE WHEN priority_type = 'P' THEN 1 WHEN priority_type = 'R' THEN 2 ELSE 3 END")
            ->orderBy('created_at')->orderBy('ticket_id')->get());
    }

    public function getServingTickets(Request $request)
    {
        $serviceType = $request->query('service_type');
        $dbServiceType = $this->normalizeServiceType($serviceType);

        // A ticket is currently serving only while both the ticket and its
        // latest service transaction are active. Historical transactions are
        // deliberately excluded without deleting them.
        $query = QueueTicket::query()
            ->join('service_transactions', 'queue_tickets.ticket_id', '=', 'service_transactions.ticket_id')
            ->whereIn('queue_tickets.service_type', \App\Services\Departments::enabledTypes())
            ->whereRaw('LOWER(queue_tickets.status) = ?', ['serving'])
            ->whereNull('service_transactions.end_time')
            ->where(function ($windowQuery) {
                $windowQuery->whereNotNull('queue_tickets.window')
                    ->orWhereIn('queue_tickets.service_type', ['ITM', 'ADM']);
            });

        if ($serviceType) {
            $query->where('queue_tickets.service_type', $dbServiceType);
        }

        $tickets = $query
            ->orderByDesc('service_transactions.start_time')
            ->orderByDesc('service_transactions.transaction_id')
            ->select('queue_tickets.*', 'service_transactions.start_time as serving_started_at')
            ->get()
            // Numbered windows retain one current ticket per window; unnumbered
            // department tickets are grouped together by service type.
            ->unique(function ($ticket) {
                return $ticket->service_type.':'.(int) $ticket->window;
            })
            ->values();

        return response()->json($tickets);
    }

    public function getCurrentTicket(Request $request)
    {
        abort_unless($request->user()?->role === 'staff', 403);
        $allowedServiceTypes = $this->resolveStaffServiceTypes($request->user());
        $staffWindowNumber = $this->resolveStaffWindowNumber($request->user());
        $transaction = ServiceTransaction::with('ticket')
            ->where('staff_id', $request->user()->user_id)
            ->whereNull('end_time')
            ->whereHas('ticket', function ($query) use ($allowedServiceTypes) {
                $query->whereRaw('LOWER(status) = ?', ['serving'])
                    ->whereIn('service_type', $allowedServiceTypes);
            })
            ->when(
                strtolower((string) ($request->user()->position ?? '')) === 'registrar',
                fn ($query) => $query->whereHas('ticket', fn ($ticketQuery) => $ticketQuery->where('window', $staffWindowNumber))
            )
            ->latest('start_time')
            ->latest('transaction_id')
            ->first();

        return response()->json([
            'success' => true,
            'ticket' => $transaction?->ticket,
            'transaction' => $transaction,
        ]);
    }


    public function callNextTicket(Request $request)
    {
        abort_unless($request->user()?->role === 'staff', 403);
        $staff = $request->user();
        if (in_array(strtolower((string) $staff->position), ['itm', 'admission', 'assessment'], true)) {
            $department = strtolower((string) $staff->position) === 'assessment' ? 'admission' : strtolower((string) $staff->position);
            $available = ServiceWindow::where('staff_id', $staff->user_id)
                ->whereRaw('LOWER(department) = ?', [$department])
                ->where('is_available', true)->where('status', 'open')->exists();
            abort_unless($available, 409, 'Open your assigned window before calling a ticket.');
        }
        try {
            $staff = $request->user();

            if (!$staff) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            $serviceTypes = $this->resolveStaffServiceTypes($staff);
            $staffPosition = strtolower((string) ($staff->position ?? ''));

            if (empty($serviceTypes)) {
                return response()->json([
                    'message' => 'This staff account is not assigned to a valid service.'
                ], 422);
            }

            $staffWindowNumber = $this->resolveStaffWindowNumber($staff);
            if (in_array($staffPosition, ['cashier', 'registrar', 'itm', 'admission', 'assessment'], true) && !$staffWindowNumber) {
                return response()->json([
                    'message' => "This {$staffPosition} account is not assigned to a service window."
                ], 422);
            }

            $result = DB::transaction(function () use ($serviceTypes, $staffWindowNumber, $staff, $staffPosition) {
                // Serialize call-next requests for this staff account. This
                // prevents two concurrent requests from both observing that
                // the staff member has no active transaction.
                User::where('user_id', $staff->user_id)->lockForUpdate()->firstOrFail();

                $activeTransaction = ServiceTransaction::with('ticket')
                    ->where('staff_id', $staff->user_id)
                    ->whereNull('end_time')
                    ->whereHas('ticket', function ($query) use ($serviceTypes) {
                        $query->whereRaw('LOWER(status) = ?', ['serving'])
                            ->whereIn('service_type', $serviceTypes);
                    })
                    ->when($staffPosition === 'registrar', fn ($query) =>
                        $query->whereHas('ticket', fn ($ticket) => $ticket->where('window', $staffWindowNumber)))
                    ->latest('start_time')
                    ->latest('transaction_id')
                    ->first();

                if ($activeTransaction) {
                    return [
                        'ticket' => $activeTransaction->ticket,
                        'transaction' => $activeTransaction,
                        'already_active' => true,
                    ];
                }

                $query = QueueTicket::whereIn('status', ['waiting', 'Waiting'])
                    ->whereIn('service_type', $serviceTypes)
                    ->whereNotExists(function ($subQuery) {
                        $subQuery->from('service_transactions')
                            ->whereColumn('service_transactions.ticket_id', 'queue_tickets.ticket_id')
                            ->whereNull('service_transactions.end_time');
                    });

                if ($staffPosition === 'registrar' && $staffWindowNumber) {
                    $query->where('window', $staffWindowNumber);
                }

                // Check what tickets are currently waiting for this queue
                $hasPriorityWaiting = (clone $query)->where('priority_type', 'P')->exists();
                $hasRegularWaiting = (clone $query)->where('priority_type', 'R')->exists();

                if (!$hasPriorityWaiting && !$hasRegularWaiting) {
                    return null;
                }

                // Query recently called tickets for this department / window to determine pattern position
                $recentQuery = QueueTicket::leftJoin('service_transactions', 'queue_tickets.ticket_id', '=', 'service_transactions.ticket_id')
                    ->whereIn('queue_tickets.service_type', $serviceTypes)
                    ->where(function ($sub) {
                        $sub->whereNotNull('queue_tickets.called_at')
                            ->orWhereNotNull('service_transactions.start_time');
                    });

                if ($staffPosition === 'registrar' && $staffWindowNumber) {
                    $recentQuery->where('queue_tickets.window', $staffWindowNumber);
                }

                $recentTickets = $recentQuery
                    ->orderByDesc('service_transactions.transaction_id')
                    ->orderByDesc('queue_tickets.called_at')
                    ->orderByDesc('queue_tickets.ticket_id')
                    ->limit(20)
                    ->lockForUpdate()
                    ->get(['queue_tickets.ticket_id', 'queue_tickets.priority_type']);

                $lastCalledType = null;
                $consecutiveCount = 0;

                if ($recentTickets->isNotEmpty()) {
                    $lastCalledType = strtoupper((string) $recentTickets->first()->priority_type);
                    foreach ($recentTickets as $recent) {
                        if (strtoupper((string) $recent->priority_type) === $lastCalledType) {
                            $consecutiveCount++;
                        } else {
                            break;
                        }
                    }
                }

                // 4 Priority : 2 Regular serving pattern:
                // 1. Serve 4 Priority customers first.
                // 2. Then serve 2 Regular customers.
                // 3. Repeat continuously.
                if ($lastCalledType === 'P') {
                    $desiredType = ($consecutiveCount < 4) ? 'P' : 'R';
                } elseif ($lastCalledType === 'R') {
                    $desiredType = ($consecutiveCount < 2) ? 'R' : 'P';
                } else {
                    $desiredType = 'P';
                }

                // Starvation prevention & fallback logic:
                // If desired type is available, serve it.
                // If not available, serve the other type instead of waiting unnecessarily.
                $selectedType = null;
                if ($desiredType === 'P') {
                    $selectedType = $hasPriorityWaiting ? 'P' : 'R';
                } else {
                    $selectedType = $hasRegularWaiting ? 'R' : 'P';
                }

                $ticket = (clone $query)
                    ->where('priority_type', $selectedType)
                    ->orderBy('created_at', 'asc')
                    ->orderBy('ticket_id', 'asc')
                    ->lockForUpdate()
                    ->first();

                // Fallback in the rare event the selected ticket was claimed concurrently
                if (!$ticket) {
                    $otherType = ($selectedType === 'P') ? 'R' : 'P';
                    $ticket = (clone $query)
                        ->where('priority_type', $otherType)
                        ->orderBy('created_at', 'asc')
                        ->orderBy('ticket_id', 'asc')
                        ->lockForUpdate()
                        ->first();
                }

                if (!$ticket) {
                    $ticket = $query
                        ->orderBy('created_at', 'asc')
                        ->orderBy('ticket_id', 'asc')
                        ->lockForUpdate()
                        ->first();
                }

                if (!$ticket) return null;

                $ticketUpdateData = [
                    'status' => 'serving',
                    'called_at' => now(),
                ];

                if (in_array($ticket->service_type, ['C', 'ITM', 'ADM'], true) && $staffWindowNumber) {
                    $ticketUpdateData['window'] = $staffWindowNumber;
                }

                $ticket->update($ticketUpdateData);

                $transaction = ServiceTransaction::create([
                    'ticket_id' => $ticket->ticket_id,
                    'staff_id' => $staff->user_id,
                    'start_time' => now(),
                ]);

                ServiceLog::create([
                    'user_id' => $staff->user_id,
                    'action' => 'Called ticket: ' . $ticket->ticket_number,
                    'created_at' => now(),
                ]);

                return [
                    'ticket' => $ticket->fresh(),
                    'transaction' => $transaction,
                    'already_active' => false,
                ];
            }, 3);

            if (!$result) {
                return response()->json(['message' => 'No waiting tickets'], 404);
            }

            return response()->json([
                'message' => $result['already_active']
                    ? 'Existing active ticket restored'
                    : 'Ticket called successfully',
                'ticket' => $result['ticket'],
                'transaction' => $result['transaction'],
                'already_active' => $result['already_active'],
            ]);
        } catch (\Throwable $e) {
            Log::error('Unable to call the next ticket', [
                'staff_id' => $staff?->user_id,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'message' => 'Unable to call the next ticket. Please try again.'
            ], 500);
        }
    }


    public function completeTicket(Request $request, $ticketId)
    {
        $request->validate([
            'performance_rating' => 'nullable|in:Excellent,Very Good,Good,Fair,Poor',
            'remarks' => 'nullable|string'
        ]);

        abort_unless($request->user()?->role === 'staff', 403);
        return DB::transaction(function () use ($request, $ticketId) {
            $ticket = QueueTicket::lockForUpdate()->findOrFail($ticketId);
            abort_unless(in_array($ticket->service_type, $this->resolveStaffServiceTypes($request->user()), true), 403, 'This ticket belongs to another department.');
            $this->assertRegistrarTicketOwnership($request->user(), $ticket);
            abort_unless(strtolower($ticket->status) === 'serving', 409, 'Ticket is not serving.');
            $transaction = ServiceTransaction::where('ticket_id', $ticketId)
                ->whereNull('end_time')
                ->first();

            if (!$transaction) {
                return response()->json(['message' => 'No active transaction found'], 404);
            }
            abort_unless((int) $transaction->staff_id === (int) $request->user()->user_id, 403, 'This ticket is assigned to another staff member.');

            $endTime = now();
            $duration = $endTime->diffInSeconds($transaction->start_time);

            $transaction->update([
                'end_time' => $endTime,
                'duration_seconds' => $duration,
                'performance_rating' => $request->performance_rating,
                'remarks' => $request->remarks
            ]);

            $ticket->update([
                'status' => 'done',
                'completed_at' => $endTime,
            ]);


            ServiceLog::create([
                'user_id' => $transaction->staff_id,
                'action' => 'Completed ticket: ' . $ticket->ticket_number . ' (Duration: ' . $duration . 's)',
                'created_at' => now()
            ]);

            return response()->json([
                'message' => 'Ticket completed successfully',
                'ticket' => $ticket,
                'transaction' => $transaction
            ]);
        }, 3);
    }


    public function cancelTicket(Request $request, $ticketId)
    {
        abort_unless($request->user()?->role === 'staff', 403);
        $ticket = DB::transaction(function () use ($request, $ticketId) {
            $ticket = QueueTicket::lockForUpdate()->findOrFail($ticketId);
            abort_unless(in_array($ticket->service_type, $this->resolveStaffServiceTypes($request->user()), true), 403, 'This ticket belongs to another department.');
            $this->assertRegistrarTicketOwnership($request->user(), $ticket);
            abort_unless(strtolower($ticket->status) === 'serving', 409, 'Ticket is not serving.');
            $transaction = ServiceTransaction::where('ticket_id', $ticketId)
                ->whereNull('end_time')
                ->latest('start_time')
                ->first();

            abort_unless($transaction && (int) $transaction->staff_id === (int) $request->user()->user_id, 403, 'This ticket is assigned to another staff member.');

            if ($transaction) {
                $endTime = now();
                $transaction->update([
                    'end_time' => $endTime,
                    'duration_seconds' => $endTime->diffInSeconds($transaction->start_time),
                    'remarks' => 'Skip / No Show',
                ]);
            }

            $ticket->update(['status' => 'cancelled']);

            ServiceLog::create([
                'user_id' => $request->user()?->user_id ?? $transaction?->staff_id,
                'action' => 'Skipped / no show: ' . $ticket->ticket_number,
                'created_at' => now(),
            ]);

            return $ticket->fresh();
        });

        return response()->json([
            'message' => 'Ticket marked as skipped / no show',
            'ticket' => $ticket
        ]);
    }

    protected function assertRegistrarTicketOwnership(?User $staff, QueueTicket $ticket): void
    {
        if (strtolower((string) ($staff?->position ?? '')) !== 'registrar') {
            return;
        }

        $assignedWindow = $this->resolveStaffWindowNumber($staff);
        abort_unless(
            $assignedWindow !== null && (int) $ticket->window === (int) $assignedWindow,
            403,
            'This ticket belongs to another Registrar window.'
        );
    }

    public function getMonitoring(Request $request)
    {
        $windowQuery = \App\Models\ServiceWindow::with(['staff' => function ($q) {
            $q->select('user_id', 'username', 'full_name', 'status', 'role', 'position');
        }])
            ->orderBy('department')->orderBy('window_number');
        $currentUser = $request->user('sanctum') ?? $request->user();
        $requestedDept = $request->query('department');
        $scopedTypes = [];

        if ($currentUser?->isDeptAdmin()) {
            $userDept = \App\Services\Departments::name($currentUser->position ?? $currentUser->department);
            if ($requestedDept && !in_array(strtolower($requestedDept), ['all', ''], true)) {
                $reqDeptName = \App\Services\Departments::name($requestedDept);
                if ($reqDeptName !== $userDept) {
                    abort(403, 'Unauthorized department access.');
                }
            }
            $deptNames = match ($userDept) {
                'Cashier' => ['cashier', 'accounting'],
                default => [strtolower((string) $userDept)],
            };
            $scopedTypes = \App\Services\Departments::types((string) $userDept);
            $windowQuery->where(function ($q) use ($deptNames, $scopedTypes) {
                $q->whereIn(DB::raw('LOWER(department)'), $deptNames);
                if (!empty($scopedTypes)) {
                    $q->orWhereIn('service_type', $scopedTypes);
                }
            });
        } elseif ($requestedDept && !in_array(strtolower($requestedDept), ['all', ''], true)) {
            $reqDeptName = \App\Services\Departments::name($requestedDept);
            if ($reqDeptName) {
                $deptNames = match ($reqDeptName) {
                    'Cashier' => ['cashier', 'accounting'],
                    default => [strtolower($reqDeptName)],
                };
                $scopedTypes = \App\Services\Departments::types($reqDeptName);
                $windowQuery->where(function ($q) use ($deptNames, $scopedTypes) {
                    $q->whereIn(DB::raw('LOWER(department)'), $deptNames);
                    if (!empty($scopedTypes)) {
                        $q->orWhereIn('service_type', $scopedTypes);
                    }
                });
            }
        }

        $windows = $windowQuery->get();

        $activeQuery = QueueTicket::whereIn('status', ['serving', 'Serving', 'called', 'Called'])
            ->orderBy('created_at');
        $waitingQuery = QueueTicket::whereIn('status', ['waiting', 'Waiting'])
            ->selectRaw('service_type, window, COUNT(*) as total')
            ->groupBy('service_type', 'window');

        if (!empty($scopedTypes)) {
            $activeQuery->whereIn('service_type', $scopedTypes);
            $waitingQuery->whereIn('service_type', $scopedTypes);
        }

        $active = $activeQuery->get(['ticket_id', 'ticket_number', 'service_type', 'window', 'created_at']);
        $waiting = $waitingQuery->get();
        $normalizeType = fn ($type) => match (strtoupper($type)) {
            'CS', 'C' => 'C', 'RT', 'R' => 'R', default => strtoupper($type),
        };
        $normalizeWindow = fn ($type, $number) => $type === 'R' && (int) $number < 9
            ? (int) $number + 8 : (int) $number;
        $result = $windows->map(function ($window) use ($active, $waiting, $normalizeType, $normalizeWindow) {
            $type = $normalizeType($window->service_type);
            $number = $normalizeWindow($type, $window->window_number);
            $ticket = $active->first(fn ($ticket) => $normalizeType($ticket->service_type) === $type
                && $normalizeWindow($type, $ticket->window) === $number);
            $departmentWaiting = $waiting->filter(fn ($row) => $normalizeType($row->service_type) === $type);
            $queue = $departmentWaiting->filter(fn ($row) => $type !== 'R'
                || $normalizeWindow($type, $row->window) === $number)->sum('total');
            $enabled = in_array(\App\Services\Departments::name($type), \App\Services\Departments::enabled(), true);
            $closed = !$enabled || !$window->is_available || strtolower($window->status ?? '') === 'closed';

            $staffMember = $window->staff;
            $staffName = 'Unassigned';

            if ($staffMember && strtolower((string) $staffMember->status) === 'active') {
                $fullName = trim((string) $staffMember->full_name);
                $staffName = $fullName !== '' ? $fullName : ($staffMember->username ?: 'Unassigned');
            } elseif (!$staffMember && $window->staff_id === null) {
                $defaultStaff = $this->resolveWindowDefaultStaff($window);
                if ($defaultStaff && strtolower((string) $defaultStaff->status) === 'active') {
                    $fullName = trim((string) $defaultStaff->full_name);
                    $staffName = $fullName !== '' ? $fullName : ($defaultStaff->username ?: 'Unassigned');
                    $staffMember = $defaultStaff;
                    $window->update(['staff_id' => $defaultStaff->user_id]);
                }
            }

            return [
                'id' => $window->id,
                'department' => \App\Services\Departments::name($type),
                'department_enabled' => $enabled,
                'window' => 'Window '.$number,
                'ticket' => $ticket?->ticket_number ?? 'None',
                'status' => $closed ? 'Closed' : ($ticket ? 'Serving' : 'Idle'),
                'busy' => (bool) $ticket && !$closed,
                'staffName' => $staffName,
                'staff' => $staffMember && strtolower((string) $staffMember->status) === 'active' ? [
                    'id' => $staffMember->user_id,
                    'name' => $staffName,
                    'username' => $staffMember->username,
                ] : null,
                'queue' => (int) $queue,
                'department_waiting' => (int) $departmentWaiting->sum('total'),
                'wait' => $ticket ? max(0, (int) $ticket->created_at->diffInMinutes(now())).' min' : '-',
                'queue_time' => $ticket?->created_at?->format('h:i A') ?? '-',
            ];
        });
        return response()->json($result);
    }

    protected function resolveWindowDefaultStaff(ServiceWindow $window): ?User
    {
        $dept = strtolower((string) $window->department);
        $number = (int) $window->window_number;

        $targetUsername = match ($dept) {
            'cashier', 'accounting' => in_array($number, [1, 2, 3], true) ? "cashier{$number}" : null,
            'registrar' => match ($number) {
                1, 9 => 'registrar1',
                2, 10 => 'registrar2',
                3, 11 => 'registrar3',
                4, 12 => 'registrar4',
                5, 13 => 'registrar5',
                6, 14 => 'registrar6',
                default => null,
            },
            'itm' => in_array($number, [1, 2, 3], true) ? ($number === 1 ? 'itm' : "itm{$number}") : null,
            'admission' => $number === 1 ? 'admission1' : null,
            default => null,
        };

        if (!$targetUsername) {
            return null;
        }

        $user = User::where('role', 'staff')
            ->where(function ($q) use ($targetUsername) {
                $q->where('username', $targetUsername)
                  ->orWhere('username', str_replace('_', '', $targetUsername));
            })
            ->where('status', 'active')
            ->first();

        if (!$user) {
            return null;
        }

        $alreadyAssigned = ServiceWindow::where('staff_id', $user->user_id)
            ->where('id', '<>', $window->id)
            ->exists();

        if ($alreadyAssigned) {
            return null;
        }

        return $user;
    }
}
