<?php

namespace Tests\Feature;

use App\Models\QueueTicket;
use App\Models\ServiceWindow;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class QueueServingPatternTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        \App\Models\DisplaySetting::create([
            'settings' => [
                'enabledDepartments' => ['Cashier', 'Registrar', 'ITM', 'Admission'],
            ],
        ]);
    }

    private function createStaff(string $department, int $windowNumber = 1): User
    {
        $serviceType = match ($department) {
            'cashier' => 'CS',
            'registrar' => 'RT',
            'itm' => 'ITM',
            'admission' => 'ADM',
        };

        $staff = User::create([
            'username' => $department . $windowNumber,
            'password' => bcrypt('password'),
            'full_name' => ucfirst($department) . ' Staff ' . $windowNumber,
            'role' => 'staff',
            'position' => $department,
            'status' => 'active',
        ]);

        ServiceWindow::create([
            'department' => $department,
            'window_number' => $windowNumber,
            'staff_id' => $staff->user_id,
            'service_type' => $serviceType,
            'service_scope' => 'department',
            'status' => 'open',
            'is_available' => true,
        ]);

        return $staff;
    }

    private function createWaitingTicket(string $serviceType, string $priorityType, ?int $window = null): QueueTicket
    {
        static $counter = 1;
        $num = str_pad($counter++, 3, '0', STR_PAD_LEFT);

        return QueueTicket::create([
            'ticket_number' => "{$serviceType}-{$priorityType}{$num}",
            'service_type' => $serviceType,
            'priority_type' => $priorityType,
            'status' => 'waiting',
            'window' => $window,
            'created_at' => now()->addSeconds($counter),
        ]);
    }

    public function test_cashier_follows_4_priority_2_regular_pattern(): void
    {
        $staff = $this->createStaff('cashier', 1);
        Sanctum::actingAs($staff);

        // Create 8 Priority and 4 Regular tickets
        for ($i = 0; $i < 8; $i++) {
            $this->createWaitingTicket('C', 'P');
        }
        for ($i = 0; $i < 4; $i++) {
            $this->createWaitingTicket('C', 'R');
        }

        // Cycle 1: 4 P, then 2 R
        $expectedOrder = ['P', 'P', 'P', 'P', 'R', 'R', 'P', 'P', 'P', 'P', 'R', 'R'];
        $actualOrder = [];

        for ($i = 0; $i < 12; $i++) {
            $response = $this->postJson('/api/queue/call');
            $response->assertOk();
            $ticket = $response->json('ticket');
            $actualOrder[] = $ticket['priority_type'];

            // Complete the ticket so staff can call the next one
            $this->putJson("/api/queue/{$ticket['ticket_id']}/complete");
        }

        $this->assertSame($expectedOrder, $actualOrder);
    }

    public function test_regular_queue_is_not_starved_when_priority_tickets_keep_waiting(): void
    {
        $staff = $this->createStaff('cashier', 1);
        Sanctum::actingAs($staff);

        // Create 10 Priority tickets and 2 Regular tickets
        for ($i = 0; $i < 10; $i++) {
            $this->createWaitingTicket('C', 'P');
        }
        for ($i = 0; $i < 2; $i++) {
            $this->createWaitingTicket('C', 'R');
        }

        $actualOrder = [];
        // Call 6 tickets: should be 4 Priority, then 2 Regular (even with 6 P still waiting!)
        for ($i = 0; $i < 6; $i++) {
            $response = $this->postJson('/api/queue/call');
            $response->assertOk();
            $ticket = $response->json('ticket');
            $actualOrder[] = $ticket['priority_type'];

            $this->putJson("/api/queue/{$ticket['ticket_id']}/complete");
        }

        $this->assertSame(['P', 'P', 'P', 'P', 'R', 'R'], $actualOrder);
    }

    public function test_serves_regular_when_not_enough_priority_available(): void
    {
        $staff = $this->createStaff('cashier', 1);
        Sanctum::actingAs($staff);

        // Only 2 Priority and 5 Regular tickets available
        for ($i = 0; $i < 2; $i++) {
            $this->createWaitingTicket('C', 'P');
        }
        for ($i = 0; $i < 5; $i++) {
            $this->createWaitingTicket('C', 'R');
        }

        $actualOrder = [];
        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/api/queue/call');
            $response->assertOk();
            $ticket = $response->json('ticket');
            $actualOrder[] = $ticket['priority_type'];

            $this->putJson("/api/queue/{$ticket['ticket_id']}/complete");
        }

        // Should serve 2 P, then continue serving R without getting stuck
        $this->assertSame(['P', 'P', 'R', 'R', 'R'], $actualOrder);
    }

    public function test_serves_priority_when_not_enough_regular_available(): void
    {
        $staff = $this->createStaff('cashier', 1);
        Sanctum::actingAs($staff);

        // 6 Priority and only 1 Regular ticket available
        for ($i = 0; $i < 6; $i++) {
            $this->createWaitingTicket('C', 'P');
        }
        $this->createWaitingTicket('C', 'R');

        $actualOrder = [];
        for ($i = 0; $i < 6; $i++) {
            $response = $this->postJson('/api/queue/call');
            $response->assertOk();
            $ticket = $response->json('ticket');
            $actualOrder[] = $ticket['priority_type'];

            $this->putJson("/api/queue/{$ticket['ticket_id']}/complete");
        }

        // First 4 P, then 1 R, then falls back to P since no more R available
        $this->assertSame(['P', 'P', 'P', 'P', 'R', 'P'], $actualOrder);
    }

    public function test_registrar_queue_follows_pattern_per_window(): void
    {
        $staffWindow9 = $this->createStaff('registrar', 9);
        Sanctum::actingAs($staffWindow9);

        // Tickets for Registrar Window 9: 5 P, 2 R
        for ($i = 0; $i < 5; $i++) {
            $this->createWaitingTicket('R', 'P', 9);
        }
        for ($i = 0; $i < 2; $i++) {
            $this->createWaitingTicket('R', 'R', 9);
        }

        $actualOrder = [];
        for ($i = 0; $i < 6; $i++) {
            $response = $this->postJson('/api/queue/call');
            $response->assertOk();
            $ticket = $response->json('ticket');
            $actualOrder[] = $ticket['priority_type'];

            $this->putJson("/api/queue/{$ticket['ticket_id']}/complete");
        }

        $this->assertSame(['P', 'P', 'P', 'P', 'R', 'R'], $actualOrder);
    }

    public function test_itm_queue_follows_4p_2r_pattern(): void
    {
        $staff = $this->createStaff('itm', 1);
        Sanctum::actingAs($staff);

        // ITM tickets: 4 P, 2 R
        for ($i = 0; $i < 4; $i++) {
            $this->createWaitingTicket('ITM', 'P');
        }
        for ($i = 0; $i < 2; $i++) {
            $this->createWaitingTicket('ITM', 'R');
        }

        $actualOrder = [];
        for ($i = 0; $i < 6; $i++) {
            $response = $this->postJson('/api/queue/call');
            $response->assertOk();
            $ticket = $response->json('ticket');
            $actualOrder[] = $ticket['priority_type'];

            $this->putJson("/api/queue/{$ticket['ticket_id']}/complete");
        }

        $this->assertSame(['P', 'P', 'P', 'P', 'R', 'R'], $actualOrder);
    }

    public function test_admission_queue_follows_4p_2r_pattern(): void
    {
        $staff = $this->createStaff('admission', 1);
        Sanctum::actingAs($staff);

        // Admission tickets: 4 P, 2 R
        for ($i = 0; $i < 4; $i++) {
            $this->createWaitingTicket('ADM', 'P');
        }
        for ($i = 0; $i < 2; $i++) {
            $this->createWaitingTicket('ADM', 'R');
        }

        $actualOrder = [];
        for ($i = 0; $i < 6; $i++) {
            $response = $this->postJson('/api/queue/call');
            $response->assertOk();
            $ticket = $response->json('ticket');
            $actualOrder[] = $ticket['priority_type'];

            $this->putJson("/api/queue/{$ticket['ticket_id']}/complete");
        }

        $this->assertSame(['P', 'P', 'P', 'P', 'R', 'R'], $actualOrder);
    }
}
