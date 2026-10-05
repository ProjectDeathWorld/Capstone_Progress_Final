<?php

namespace Tests\Feature;

use App\Models\QueueTicket;
use App\Models\ServiceLog;
use App\Models\ServiceTransaction;
use App\Models\ServiceWindow;
use App\Models\User;
use App\Services\ResetTestData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ResetTestDataTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Live API stays offline during maintenance; isolated in-memory HTTP tests may run.
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\PreventRequestsDuringMaintenance::class);
    }

    public function test_reset_preserves_configuration_and_authentication_and_new_operations_work(): void
    {
        $staff = User::create(['username' => 'cashier1', 'password' => 'test-password',
            'full_name' => 'Preserved Cashier', 'role' => 'staff', 'position' => 'cashier', 'status' => 'active']);
        User::create(['username' => 'security', 'password' => 'security-password', 'full_name' => 'Security',
            'role' => 'security', 'status' => 'active', 'security_code' => 'test-code']);
        $window = ServiceWindow::create(['department' => 'Cashier', 'window_number' => 1,
            'service_type' => 'CS', 'staff_id' => $staff->user_id, 'status' => 'open', 'is_available' => true]);
        DB::table('display_settings')->insert(['settings' => '{"title":"Keep this"}', 'published_by' => $staff->user_id]);
        DB::table('display_windows')->insert(['service_window_id' => $window->id, 'window_number' => 1,
            'display_name' => 'Cashier 1', 'department' => 'Cashier', 'sort_order' => 1]);
        $staff->createToken('preserved-token');
        DB::table('sessions')->insert(['id' => 'preserved-session', 'user_id' => $staff->user_id,
            'payload' => 'preserved', 'last_activity' => time()]);
        foreach (['waiting', 'serving', 'done', 'cancelled'] as $i => $status) {
            $ticket = QueueTicket::create(['ticket_number' => 'C-R00'.($i + 1), 'service_type' => 'C',
                'priority_type' => $i % 2 ? 'P' : 'R', 'status' => $status, 'created_at' => now()]);
            ServiceTransaction::create(['ticket_id' => $ticket->ticket_id, 'staff_id' => $staff->user_id]);
        }
        foreach (['Called ticket: C-R002', 'Completed ticket: C-R003 (Duration: 20s)',
            'Skipped / no show: C-R004', 'User logged in: cashier1', 'User registered: cashier1', 'Settings updated'] as $action) {
            ServiceLog::create(['user_id' => $staff->user_id, 'action' => $action]);
        }

        $reset = app(ResetTestData::class);
        $before = $reset->fingerprints();
        $deleted = $reset->clear();
        $this->assertSame(4, $deleted['queue_tickets']);
        $this->assertSame(4, $deleted['service_transactions']);
        $this->assertSame(3, $deleted['operational_service_logs']);
        $this->assertSame($before, $reset->fingerprints());
        $this->assertSame(0, array_sum($reset->counts()));
        $this->assertDatabaseCount('service_logs', 3);

        Sanctum::actingAs($staff);
        $this->getJson('/api/staff/current-ticket')->assertOk()->assertJsonPath('ticket', null);
        $this->getJson('/api/analytics/dashboard')->assertOk()->assertJsonPath('total_tickets', 0)
            ->assertJsonPath('average_waiting_time', 0)->assertJsonPath('longest_waiting_time', 0);
        $this->getJson('/api/analytics/peak-hours')->assertOk()->assertJsonPath('peak_hour', null)
            ->assertJsonPath('peak_hour_label', 'No data available');
        $this->getJson('/api/reports')->assertOk()->assertJsonPath('report_summary.tickets_issued', 0);
        $this->postJson('/api/login', ['username' => 'cashier1', 'password' => 'test-password'])->assertOk();
        $this->postJson('/api/queue/generate', ['service_type' => 'C', 'priority_type' => 'P', 'security_code' => 'wrong'])
            ->assertForbidden();
        $this->postJson('/api/queue/verify-security', ['security_code' => 'test-code'])->assertOk()->assertJsonPath('valid', true);
        $regular = $this->postJson('/api/queue/generate', ['service_type' => 'C', 'priority_type' => 'R', 'transaction_type' => 'Payment'])
            ->assertCreated()->assertJsonPath('ticket.ticket_number', 'C-R001')->json('ticket.ticket_id');
        $priority = $this->postJson('/api/queue/generate', ['service_type' => 'C', 'priority_type' => 'P',
            'transaction_type' => 'Payment', 'security_code' => 'test-code'])
            ->assertCreated()->assertJsonPath('ticket.ticket_number', 'C-P001')->json('ticket.ticket_id');
        $this->postJson('/api/queue/call')->assertOk()->assertJsonPath('ticket.ticket_id', $priority);
        $this->putJson('/api/queue/'.$priority.'/complete')->assertOk()->assertJsonPath('ticket.status', 'done');
        $this->postJson('/api/queue/call')->assertOk()->assertJsonPath('ticket.ticket_id', $regular);
        $this->putJson('/api/queue/'.$regular.'/cancel')->assertOk()->assertJsonPath('ticket.status', 'cancelled');
        $this->assertSame(4, $reset->operationalLogs()->count());
        $this->getJson('/api/analytics/dashboard')->assertOk()->assertJsonPath('completed_tickets_count', 1)
            ->assertJsonPath('cancelled_tickets', 1);
        $this->getJson('/api/reports')->assertOk()->assertJsonPath('report_summary.tickets_issued', 2);
    }

    public function test_dry_run_and_declining_confirmation_do_not_delete_data(): void
    {
        QueueTicket::create(['ticket_number' => 'C-R099', 'service_type' => 'C', 'priority_type' => 'R', 'status' => 'waiting']);
        $this->artisan('qms:reset-test-data', ['--dry-run' => true])->assertSuccessful();
        $this->artisan('qms:reset-test-data')
            ->expectsConfirmation('Back up this database, then permanently delete these test operations?', 'no')->assertSuccessful();
        $this->assertDatabaseCount('queue_tickets', 1);
    }

    public function test_unknown_schema_is_rejected_before_deletion(): void
    {
        QueueTicket::create(['ticket_number' => 'C-R099', 'service_type' => 'C', 'priority_type' => 'R', 'status' => 'waiting']);
        DB::statement('CREATE TABLE unexpected_operations (id INTEGER PRIMARY KEY)');
        try {
            app(ResetTestData::class)->clear();
            $this->fail('Unexpected schema must be inspected before deleting.');
        } catch (\RuntimeException $exception) {
            $this->assertStringContainsString('differ from the inspected schema', $exception->getMessage());
            $this->assertDatabaseCount('queue_tickets', 1);
        }
    }
}
