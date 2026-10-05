<?php

namespace Tests\Feature;

use App\Models\QueueTicket;
use App\Models\ServiceTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StaffCurrentTicketTest extends TestCase
{
    use RefreshDatabase;

    public function test_active_ticket_is_restored_and_call_next_returns_it_instead_of_calling_another(): void
    {
        $staff = User::create([
            'username' => 'cashier1',
            'password' => 'password',
            'full_name' => 'Staff A',
            'role' => 'staff',
            'position' => 'cashier',
            'status' => 'active',
        ]);

        $activeTicket = QueueTicket::create([
            'ticket_number' => 'C-R015',
            'service_type' => 'C',
            'priority_type' => 'R',
            'status' => 'serving',
            'window' => 1,
            'created_at' => now()->subMinutes(5),
            'called_at' => now()->subMinutes(4),
        ]);

        $activeTransaction = ServiceTransaction::create([
            'ticket_id' => $activeTicket->ticket_id,
            'staff_id' => $staff->user_id,
            'start_time' => now()->subMinutes(4),
        ]);

        $waitingTicket = QueueTicket::create([
            'ticket_number' => 'C-R016',
            'service_type' => 'C',
            'priority_type' => 'R',
            'status' => 'waiting',
            'created_at' => now(),
        ]);

        Sanctum::actingAs($staff);

        $this->getJson('/api/staff/current-ticket')
            ->assertOk()
            ->assertJsonPath('ticket.ticket_id', $activeTicket->ticket_id)
            ->assertJsonPath('transaction.transaction_id', $activeTransaction->transaction_id);

        $this->postJson('/api/queue/call')
            ->assertOk()
            ->assertJsonPath('already_active', true)
            ->assertJsonPath('ticket.ticket_id', $activeTicket->ticket_id);

        $this->assertDatabaseHas('queue_tickets', [
            'ticket_id' => $waitingTicket->ticket_id,
            'status' => 'waiting',
        ]);
        $this->assertSame(1, ServiceTransaction::where('staff_id', $staff->user_id)->whereNull('end_time')->count());

        $this->putJson("/api/queue/{$activeTicket->ticket_id}/complete")
            ->assertOk()
            ->assertJsonPath('ticket.status', 'done');

        $this->getJson('/api/staff/current-ticket')
            ->assertOk()
            ->assertJsonPath('ticket', null)
            ->assertJsonPath('transaction', null);
    }
}
