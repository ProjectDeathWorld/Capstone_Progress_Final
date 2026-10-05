<?php

namespace Tests\Feature;

use App\Models\QueueTicket;
use App\Models\ServiceWindow;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RegistrarWindowStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_monitoring_uses_real_assignment_status_and_queue_changes(): void
    {
        ServiceWindow::query()->delete();
        $staff = $this->staff('custom-assignee', 'registrar');
        $window = $this->window(9, $staff);
        $ticket = $this->ticket('R-R001', 'waiting', 9);
        $this->getJson('/api/queue/monitoring')->assertOk()
            ->assertJsonPath('0.staffName', $staff->full_name)
            ->assertJsonPath('0.queue', 1)->assertJsonPath('0.status', 'Idle');
        $ticket->update(['status' => 'serving']);
        $this->getJson('/api/queue/monitoring')->assertOk()
            ->assertJsonPath('0.ticket', 'R-R001')->assertJsonPath('0.queue', 0)
            ->assertJsonPath('0.status', 'Serving');
        $ticket->update(['status' => 'completed']);
        $window->update(['status' => 'closed', 'is_available' => false]);
        $this->getJson('/api/queue/monitoring')->assertOk()
            ->assertJsonPath('0.status', 'Closed')->assertJsonPath('0.ticket', 'None');
        $window->update(['status' => 'open', 'is_available' => true]);
        $ticket->update(['status' => 'cancelled']);
        $this->getJson('/api/queue/monitoring')->assertOk()->assertJsonPath('0.status', 'Idle');
    }

    public function test_each_registrar_account_loads_its_database_assigned_window(): void
    {
        foreach (range(1, 5) as $number) {
            $staff = $this->staff("registrar{$number}", 'registrar');
            ServiceWindow::create([
                'department' => 'registrar',
                'window_number' => $number + 8,
                'service_type' => 'RT',
                'staff_id' => $staff->user_id,
                'is_available' => true,
                'status' => 'open',
            ]);

            Sanctum::actingAs($staff);
            $this->getJson('/api/staff/current-window')
                ->assertOk()
                ->assertJsonPath('window_number', $number + 8)
                ->assertJsonPath('department', 'registrar');
        }
    }

    public function test_registrar_queue_and_call_next_are_isolated_to_the_assigned_window(): void
    {
        $staffByWindow = [];

        foreach (range(9, 13) as $windowNumber) {
            $staff = $this->staff("registrar{$windowNumber}", 'registrar');
            $this->window($windowNumber, $staff);
            $staffByWindow[$windowNumber] = $staff;

            $this->ticket("R-R{$windowNumber}1", 'waiting', $windowNumber);
            $this->ticket("R-P{$windowNumber}1", 'waiting', $windowNumber, 'P');
        }

        foreach ($staffByWindow as $windowNumber => $staff) {
            Sanctum::actingAs($staff);

            $this->getJson('/api/staff/queue/waiting')
                ->assertOk()
                ->assertJsonCount(2)
                ->assertJsonPath('0.window', $windowNumber)
                ->assertJsonPath('0.priority_type', 'P')
                ->assertJsonPath('1.window', $windowNumber)
                ->assertJsonPath('1.priority_type', 'R');

            $this->postJson('/api/queue/call')
                ->assertOk()
                ->assertJsonPath('ticket.window', $windowNumber)
                ->assertJsonPath('ticket.priority_type', 'P');
        }

        $window10Ticket = QueueTicket::where('window', 10)->where('status', 'serving')->firstOrFail();
        Sanctum::actingAs($staffByWindow[9]);
        $this->putJson("/api/queue/{$window10Ticket->ticket_id}/complete")
            ->assertForbidden();
        $this->putJson("/api/queue/{$window10Ticket->ticket_id}/cancel")
            ->assertForbidden();
    }

    public function test_registrar_can_only_close_its_assigned_window_without_affecting_existing_tickets(): void
    {
        $registrar = $this->staff('registrar1', 'registrar');
        $window9 = $this->window(9, $registrar);
        $window10 = $this->window(10);

        $waiting = $this->ticket('R-R001', 'waiting', 9);
        $serving = $this->ticket('R-R002', 'serving', 9);

        Sanctum::actingAs($registrar);
        $this->postJson('/api/windows/toggle', [
            'department' => 'registrar',
            'window_number' => 10,
            'is_available' => false,
        ])->assertForbidden();

        $this->patchJson('/api/staff/window/status', ['status' => 'closed'])
            ->assertOk()
            ->assertJsonPath('window.window_number', 9)
            ->assertJsonPath('window.status', 'closed');

        $this->assertDatabaseHas('service_windows', ['id' => $window9->id, 'status' => 'closed', 'is_available' => false]);
        $this->assertDatabaseHas('service_windows', ['id' => $window10->id, 'status' => 'open', 'is_available' => true]);
        $this->assertDatabaseHas('queue_tickets', ['ticket_id' => $waiting->ticket_id, 'status' => 'waiting']);
        $this->assertDatabaseHas('queue_tickets', ['ticket_id' => $serving->ticket_id, 'status' => 'serving']);

        $this->postJson('/api/queue/generate', [
            'service_type' => 'RT',
            'student_number' => 'Guest',
            'transaction_type' => 'Document Request',
            'priority_type' => 'R',
            'window' => 9,
        ])->assertStatus(409)->assertJsonPath('message', 'This Registrar window is currently unavailable.');

        $this->patchJson('/api/staff/window/status', ['status' => 'open'])
            ->assertOk()
            ->assertJsonPath('window.status', 'open');

        $this->postJson('/api/queue/generate', [
            'service_type' => 'RT',
            'student_number' => 'Guest',
            'transaction_type' => 'Document Request',
            'priority_type' => 'R',
            'window' => 9,
        ])->assertCreated();
    }

    public function test_cashier_and_itm_cannot_use_registrar_window_toggle_and_their_ticket_flows_ignore_window_status(): void
    {
        $cashier = $this->staff('cashier1', 'cashier');
        // SQLite retains the original enum check used by the first migration;
        // keep the persisted fixture valid and set the authenticated model's
        // current position to ITM for this authorization regression check.
        $itm = $this->staff('itm1', 'cashier');
        $itm->position = 'itm';

        ServiceWindow::create([
            'department' => 'Cashier',
            'window_number' => 1,
            'service_type' => 'CS',
            'is_available' => false,
            'status' => 'closed',
        ]);
        ServiceWindow::whereRaw('LOWER(department) = ?', ['itm'])
            ->where('window_number', 1)
            ->update(['service_type' => 'ITM', 'is_available' => false, 'status' => 'closed']);

        Sanctum::actingAs($cashier);
        $this->patchJson('/api/staff/window/status', ['status' => 'closed'])->assertForbidden();
        $this->postJson('/api/queue/generate', [
            'service_type' => 'CS',
            'transaction_type' => 'Payment',
            'priority_type' => 'R',
        ])->assertCreated();

        Sanctum::actingAs($itm);
        $this->patchJson('/api/staff/window/status', ['status' => 'closed'])->assertForbidden();
    }

    public function test_public_availability_endpoint_returns_persisted_closed_status(): void
    {
        $registrar = $this->staff('registrar1', 'registrar');
        $this->window(9, $registrar, 'closed');

        $this->getJson('/api/windows/availability')
            ->assertOk()
            ->assertJsonFragment([
                'department' => 'registrar',
                'window_number' => 9,
                'status' => 'closed',
                'is_available' => false,
            ]);
    }

    private function staff(string $username, string $position): User
    {
        return User::create([
            'username' => $username,
            'password' => 'password',
            'full_name' => $username,
            'role' => 'staff',
            'position' => $position,
            'status' => 'active',
        ]);
    }

    private function window(int $number, ?User $staff = null, string $status = 'open'): ServiceWindow
    {
        return ServiceWindow::create([
            'department' => 'registrar',
            'window_number' => $number,
            'service_type' => 'RT',
            'staff_id' => $staff?->user_id,
            'is_available' => $status === 'open',
            'status' => $status,
        ]);
    }

    private function ticket(string $number, string $status, int $window, string $priority = 'R'): QueueTicket
    {
        return QueueTicket::create([
            'ticket_number' => $number,
            'service_type' => 'R',
            'transaction_type' => 'Document Request',
            'priority_type' => $priority,
            'status' => $status,
            'window' => $window,
            'created_at' => now(),
        ]);
    }
}
