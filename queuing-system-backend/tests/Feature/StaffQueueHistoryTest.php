<?php

namespace Tests\Feature;

use App\Models\QueueTicket;
use App\Models\ServiceTransaction;
use App\Models\ServiceWindow;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StaffQueueHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_can_only_view_their_own_queue_history_and_not_other_staff(): void
    {
        $staff1 = User::create([
            'username' => 'cashier1',
            'password' => 'staff123',
            'full_name' => 'Cashier One',
            'role' => 'staff',
            'position' => 'cashier',
            'status' => 'active',
        ]);

        $staff2 = User::create([
            'username' => 'cashier2',
            'password' => 'staff123',
            'full_name' => 'Cashier Two',
            'role' => 'staff',
            'position' => 'cashier',
            'status' => 'active',
        ]);

        $ticket1 = QueueTicket::create([
            'ticket_number' => 'C-001',
            'service_type' => 'C',
            'transaction_type' => 'Tuition Payment',
            'student_number' => '2023-0001',
            'student_name' => 'Juan Dela Cruz',
            'status' => 'done',
            'window' => 1,
            'created_at' => Carbon::now('Asia/Manila')->subMinutes(20)->utc(),
            'called_at' => Carbon::now('Asia/Manila')->subMinutes(15)->utc(),
            'completed_at' => Carbon::now('Asia/Manila')->subMinutes(10)->utc(),
        ]);

        ServiceTransaction::create([
            'ticket_id' => $ticket1->ticket_id,
            'staff_id' => $staff1->user_id,
            'start_time' => Carbon::now('Asia/Manila')->subMinutes(15)->utc(),
            'end_time' => Carbon::now('Asia/Manila')->subMinutes(10)->utc(),
            'duration_seconds' => 300,
        ]);

        $ticket2 = QueueTicket::create([
            'ticket_number' => 'C-002',
            'service_type' => 'C',
            'transaction_type' => 'Tuition Payment',
            'student_number' => '2023-0002',
            'student_name' => 'Maria Clara',
            'status' => 'done',
            'window' => 2,
            'created_at' => Carbon::now('Asia/Manila')->subMinutes(15)->utc(),
            'called_at' => Carbon::now('Asia/Manila')->subMinutes(12)->utc(),
            'completed_at' => Carbon::now('Asia/Manila')->subMinutes(5)->utc(),
        ]);

        ServiceTransaction::create([
            'ticket_id' => $ticket2->ticket_id,
            'staff_id' => $staff2->user_id,
            'start_time' => Carbon::now('Asia/Manila')->subMinutes(12)->utc(),
            'end_time' => Carbon::now('Asia/Manila')->subMinutes(5)->utc(),
            'duration_seconds' => 420,
        ]);

        Sanctum::actingAs($staff1);

        $response = $this->getJson('/api/staff/queue/history?period=all');
        $response->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.queue_number', 'C-001')
            ->assertJsonPath('data.0.student_name', 'Juan Dela Cruz')
            ->assertJsonPath('data.0.department', 'Cashier')
            ->assertJsonPath('data.0.service', 'Tuition Payment')
            ->assertJsonPath('data.0.window_number', '1')
            ->assertJsonPath('data.0.status', 'Completed');

        // Staff 1 must not see Staff 2's ticket
        $this->assertStringNotContainsString('C-002', $response->getContent());
        $this->assertStringNotContainsString('Maria Clara', $response->getContent());
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/staff/queue/history');
        $response->assertUnauthorized();
    }

    public function test_queue_history_is_ordered_newest_first_with_waiting_and_service_time(): void
    {
        $staff = User::create([
            'username' => 'registrar1',
            'password' => 'staff123',
            'full_name' => 'Registrar One',
            'role' => 'staff',
            'position' => 'registrar',
            'status' => 'active',
        ]);

        ServiceWindow::create([
            'department' => 'Registrar',
            'window_number' => 1,
            'staff_id' => $staff->user_id,
            'service_type' => 'REG',
            'is_available' => true,
            'status' => 'open',
        ]);

        $ticketEarly = QueueTicket::create([
            'ticket_number' => 'R-001',
            'service_type' => 'R',
            'transaction_type' => 'Enrollment',
            'student_number' => '2023-1001',
            'student_name' => 'Student Early',
            'status' => 'done',
            'window' => 1,
            'created_at' => Carbon::now('Asia/Manila')->subMinutes(60)->utc(),
            'called_at' => Carbon::now('Asia/Manila')->subMinutes(50)->utc(),
            'completed_at' => Carbon::now('Asia/Manila')->subMinutes(40)->utc(),
        ]);

        ServiceTransaction::create([
            'ticket_id' => $ticketEarly->ticket_id,
            'staff_id' => $staff->user_id,
            'start_time' => Carbon::now('Asia/Manila')->subMinutes(50)->utc(),
            'end_time' => Carbon::now('Asia/Manila')->subMinutes(40)->utc(),
            'duration_seconds' => 600,
        ]);

        $ticketLate = QueueTicket::create([
            'ticket_number' => 'R-002',
            'service_type' => 'R',
            'transaction_type' => 'Records',
            'student_number' => '2023-1002',
            'student_name' => 'Student Late',
            'status' => 'done',
            'window' => 1,
            'created_at' => Carbon::now('Asia/Manila')->subMinutes(20)->utc(),
            'called_at' => Carbon::now('Asia/Manila')->subMinutes(16)->utc(),
            'completed_at' => Carbon::now('Asia/Manila')->subMinutes(10)->utc(),
        ]);

        ServiceTransaction::create([
            'ticket_id' => $ticketLate->ticket_id,
            'staff_id' => $staff->user_id,
            'start_time' => Carbon::now('Asia/Manila')->subMinutes(16)->utc(),
            'end_time' => Carbon::now('Asia/Manila')->subMinutes(10)->utc(),
            'duration_seconds' => 360,
        ]);

        Sanctum::actingAs($staff);

        $response = $this->getJson('/api/staff/queue/history?period=all');
        $response->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonPath('data.0.queue_number', 'R-002') // Newest first
            ->assertJsonPath('data.0.service', 'Records')
            ->assertJsonPath('data.0.waiting_time', '4 mins')
            ->assertJsonPath('data.0.service_time', '6 mins')
            ->assertJsonPath('data.1.queue_number', 'R-001')
            ->assertJsonPath('data.1.waiting_time', '10 mins')
            ->assertJsonPath('data.1.service_time', '10 mins');
    }

    public function test_search_and_pagination_and_date_filtering(): void
    {
        $staff = User::create([
            'username' => 'cashier1',
            'password' => 'staff123',
            'full_name' => 'Cashier One',
            'role' => 'staff',
            'position' => 'cashier',
            'status' => 'active',
        ]);

        // Ticket 1: Today
        $t1 = QueueTicket::create([
            'ticket_number' => 'C-010',
            'service_type' => 'C',
            'student_number' => '2023-5001',
            'student_name' => 'Alice Guo',
            'status' => 'done',
            'window' => 1,
            'created_at' => Carbon::now('Asia/Manila')->subMinutes(10)->utc(),
        ]);
        ServiceTransaction::create([
            'ticket_id' => $t1->ticket_id,
            'staff_id' => $staff->user_id,
            'start_time' => Carbon::now('Asia/Manila')->subMinutes(8)->utc(),
            'end_time' => Carbon::now('Asia/Manila')->subMinutes(2)->utc(),
            'duration_seconds' => 360,
        ]);

        // Ticket 2: Today
        $t2 = QueueTicket::create([
            'ticket_number' => 'C-020',
            'service_type' => 'C',
            'student_number' => '2023-5002',
            'student_name' => 'Bob Smith',
            'status' => 'done',
            'window' => 1,
            'created_at' => Carbon::now('Asia/Manila')->subMinutes(30)->utc(),
        ]);
        ServiceTransaction::create([
            'ticket_id' => $t2->ticket_id,
            'staff_id' => $staff->user_id,
            'start_time' => Carbon::now('Asia/Manila')->subMinutes(25)->utc(),
            'end_time' => Carbon::now('Asia/Manila')->subMinutes(15)->utc(),
            'duration_seconds' => 600,
        ]);

        // Ticket 3: 10 days ago
        $t3 = QueueTicket::create([
            'ticket_number' => 'C-030',
            'service_type' => 'C',
            'student_number' => '2023-5003',
            'student_name' => 'Charlie Day',
            'status' => 'done',
            'window' => 1,
            'created_at' => Carbon::now('Asia/Manila')->subDays(10)->utc(),
        ]);
        ServiceTransaction::create([
            'ticket_id' => $t3->ticket_id,
            'staff_id' => $staff->user_id,
            'start_time' => Carbon::now('Asia/Manila')->subDays(10)->utc(),
            'end_time' => Carbon::now('Asia/Manila')->subDays(10)->addMinutes(5)->utc(),
            'duration_seconds' => 300,
        ]);

        Sanctum::actingAs($staff);

        // Filter: Today -> only 2 records
        $resToday = $this->getJson('/api/staff/queue/history?period=today');
        $resToday->assertOk()->assertJsonPath('total', 2);

        // Filter: All with pagination (per_page=2) -> page 1 has 2, total has 3
        $resPage1 = $this->getJson('/api/staff/queue/history?period=all&per_page=2&page=1');
        $resPage1->assertOk()
            ->assertJsonPath('total', 3)
            ->assertJsonPath('per_page', 2)
            ->assertJsonPath('current_page', 1)
            ->assertJsonPath('last_page', 2);

        // Search by name
        $resSearchName = $this->getJson('/api/staff/queue/history?period=all&search=Alice');
        $resSearchName->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.queue_number', 'C-010');

        // Search by queue number
        $resSearchQueue = $this->getJson('/api/staff/queue/history?period=all&search=C-030');
        $resSearchQueue->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.student_name', 'Charlie Day');
    }
}
