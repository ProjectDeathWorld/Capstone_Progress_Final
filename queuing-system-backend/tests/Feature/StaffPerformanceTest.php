<?php

namespace Tests\Feature;

use App\Models\QueueTicket;
use App\Models\ServiceTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StaffPerformanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_aggregates_staff_performance_by_transaction_staff_id_and_keeps_zero_rows(): void
    {
        $admin = $this->user('admin', 'admin');
        $cashier1 = $this->user('cashier1', 'cashier');
        $cashier2 = $this->user('cashier2', 'cashier');
        $cashier3 = $this->user('cashier3', 'cashier');
        $registrar1 = $this->user('registrar1', 'registrar');

        $this->completedTransaction($cashier1, 'C-R001', 2, 5);
        $this->completedTransaction($cashier2, 'C-R002', 3, 7);
        $this->skippedTransaction($cashier3, 'C-R003');
        $this->completedTransaction($registrar1, 'R-R001', 1, 4);

        Sanctum::actingAs($admin);
        $rows = collect($this->getJson('/api/analytics/dashboard')
            ->assertOk()
            ->json('staff_performance'));

        $this->assertSame(1, data_get($rows->firstWhere('user_id', $cashier1->user_id), 'transactions_served'));
        $this->assertSame(1, data_get($rows->firstWhere('user_id', $cashier2->user_id), 'transactions_served'));
        $this->assertSame(0, data_get($rows->firstWhere('user_id', $cashier3->user_id), 'transactions_served'));
        $this->assertSame(1, data_get($rows->firstWhere('user_id', $cashier3->user_id), 'skip_no_show'));
        $this->assertSame(1, data_get($rows->firstWhere('user_id', $registrar1->user_id), 'transactions_served'));
        $this->assertSame(0, data_get($rows->firstWhere('user_id', $cashier3->user_id), 'average_service_time'));
    }

    private function user(string $username, string $position): User
    {
        return User::create([
            'username' => $username,
            'password' => 'password',
            'full_name' => ucfirst($username),
            'role' => $username === 'admin' ? 'admin' : 'staff',
            'position' => $username === 'admin' ? null : $position,
            'status' => 'active',
        ]);
    }

    private function completedTransaction(User $staff, string $number, int $waitMinutes, int $serviceMinutes): void
    {
        $created = now()->subMinutes($waitMinutes + $serviceMinutes);
        $called = $created->copy()->addMinutes($waitMinutes);
        $ticket = QueueTicket::create([
            'ticket_number' => $number,
            'service_type' => $staff->position === 'cashier' ? 'C' : 'R',
            'priority_type' => 'R',
            'status' => 'done',
            'created_at' => $created,
            'called_at' => $called,
            'completed_at' => $called->copy()->addMinutes($serviceMinutes),
        ]);
        ServiceTransaction::create([
            'ticket_id' => $ticket->ticket_id,
            'staff_id' => $staff->user_id,
            'start_time' => $called,
            'end_time' => $ticket->completed_at,
            'duration_seconds' => $serviceMinutes * 60,
        ]);
    }

    private function skippedTransaction(User $staff, string $number): void
    {
        $ticket = QueueTicket::create([
            'ticket_number' => $number,
            'service_type' => 'C',
            'priority_type' => 'R',
            'status' => 'cancelled',
            'created_at' => now()->subMinutes(5),
        ]);
        ServiceTransaction::create([
            'ticket_id' => $ticket->ticket_id,
            'staff_id' => $staff->user_id,
            'start_time' => now()->subMinutes(4),
            'end_time' => now(),
            'duration_seconds' => 240,
            'remarks' => 'Skip / No Show',
        ]);
    }
}
