<?php

namespace Tests\Feature;

use App\Models\DisplaySetting;
use App\Models\QueueTicket;
use App\Models\ServiceWindow;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class IntelligencePredictionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        DisplaySetting::create([
            'settings' => [
                'enabledDepartments' => ['Cashier', 'Registrar', 'ITM', 'Admission'],
            ],
        ]);
    }

    private function createHeadAdmin(): User
    {
        return User::firstOrCreate(['username' => 'headadmin'], [
            'password' => 'admin123',
            'full_name' => 'System Administrator',
            'role' => 'admin',
            'position' => null,
            'status' => 'active',
        ]);
    }

    private function createDeptAdmin(string $username, string $position): User
    {
        return User::firstOrCreate(['username' => $username], [
            'password' => 'admin123',
            'full_name' => ucfirst($position) . ' Admin',
            'role' => 'dept_admin',
            'position' => $position,
            'status' => 'active',
        ]);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/intelligence/predicted-wait');
        $response->assertStatus(401);
    }

    public function test_head_admin_can_retrieve_predictions_for_all_departments(): void
    {
        $admin = $this->createHeadAdmin();
        Sanctum::actingAs($admin);

        // Create windows
        ServiceWindow::create([
            'department' => 'Cashier',
            'window_number' => 1,
            'service_type' => 'CS',
            'is_available' => true,
            'status' => 'open',
        ]);

        ServiceWindow::create([
            'department' => 'registrar',
            'window_number' => 9,
            'service_type' => 'RT',
            'is_available' => true,
            'status' => 'open',
        ]);

        $response = $this->getJson('/api/intelligence/predicted-wait');
        $response->assertStatus(200);
        $response->assertJsonStructure([
            'success',
            'predictions' => [
                '*' => [
                    'department_name',
                    'waiting_count',
                    'active_windows',
                    'average_service_time_minutes',
                    'predicted_wait_minutes',
                    'predicted_wait_formatted',
                    'queue_status',
                ],
            ],
        ]);

        $deptNames = collect($response->json('predictions'))->pluck('department_name')->all();
        $this->assertContains('Cashier', $deptNames);
        $this->assertContains('Registrar', $deptNames);
    }

    public function test_department_admin_only_retrieves_their_assigned_department(): void
    {
        $registrarAdmin = $this->createDeptAdmin('regadmin', 'registrar');
        Sanctum::actingAs($registrarAdmin);

        ServiceWindow::create([
            'department' => 'Cashier',
            'window_number' => 1,
            'service_type' => 'CS',
            'is_available' => true,
            'status' => 'open',
        ]);

        ServiceWindow::create([
            'department' => 'registrar',
            'window_number' => 9,
            'service_type' => 'RT',
            'is_available' => true,
            'status' => 'open',
        ]);

        $response = $this->getJson('/api/intelligence/predicted-wait');
        $response->assertStatus(200);

        $predictions = $response->json('predictions');
        $this->assertCount(1, $predictions);
        $this->assertEquals('Registrar', $predictions[0]['department_name']);
    }

    public function test_department_admin_cannot_access_other_departments_via_query_param(): void
    {
        $registrarAdmin = $this->createDeptAdmin('regadmin', 'registrar');
        Sanctum::actingAs($registrarAdmin);

        $response = $this->getJson('/api/intelligence/predicted-wait?department=Cashier');
        $response->assertStatus(403);
    }

    public function test_no_waiting_queue_returns_zero_wait_and_low_status(): void
    {
        $admin = $this->createHeadAdmin();
        Sanctum::actingAs($admin);

        ServiceWindow::create([
            'department' => 'Cashier',
            'window_number' => 1,
            'service_type' => 'CS',
            'is_available' => true,
            'status' => 'open',
        ]);

        $response = $this->getJson('/api/intelligence/predicted-wait?department=Cashier');
        $response->assertStatus(200);

        $data = $response->json('predictions')[0];
        $this->assertEquals(0, $data['waiting_count']);
        $this->assertEquals(0, $data['predicted_wait_minutes']);
        $this->assertEquals('No waiting time', $data['predicted_wait_formatted']);
        $this->assertEquals('LOW', $data['queue_status']);
    }

    public function test_waiting_queue_with_zero_active_windows_returns_unavailable(): void
    {
        $admin = $this->createHeadAdmin();
        Sanctum::actingAs($admin);

        ServiceWindow::create([
            'department' => 'Cashier',
            'window_number' => 1,
            'service_type' => 'CS',
            'is_available' => false,
            'status' => 'closed',
        ]);

        QueueTicket::create([
            'ticket_number' => 'C-0001',
            'service_type' => 'C',
            'transaction_type' => 'Payment',
            'status' => 'waiting',
            'created_at' => now(),
        ]);

        $response = $this->getJson('/api/intelligence/predicted-wait?department=Cashier');
        $response->assertStatus(200);

        $data = $response->json('predictions')[0];
        $this->assertEquals(1, $data['waiting_count']);
        $this->assertEquals(0, $data['active_windows']);
        $this->assertEquals('Unavailable', $data['predicted_wait_formatted']);
        $this->assertEquals('No active service window', $data['status_reason']);
    }

    public function test_calculation_formula_and_range(): void
    {
        $admin = $this->createHeadAdmin();
        Sanctum::actingAs($admin);

        // 3 active windows for Registrar
        for ($w = 9; $w <= 11; $w++) {
            ServiceWindow::create([
                'department' => 'registrar',
                'window_number' => $w,
                'service_type' => 'RT',
                'is_available' => true,
                'status' => 'open',
            ]);
        }

        // 3 completed transactions with 5-minute duration (300 seconds)
        for ($i = 1; $i <= 3; $i++) {
            $called = Carbon::now()->subMinutes(20 + ($i * 5));
            $completed = $called->copy()->addMinutes(5);
            QueueTicket::create([
                'ticket_number' => "R-000{$i}",
                'service_type' => 'R',
                'transaction_type' => 'Document Request',
                'status' => 'done',
                'created_at' => $called->copy()->subMinutes(10),
                'called_at' => $called,
                'completed_at' => $completed,
            ]);
        }

        // 24 waiting tickets
        for ($j = 1; $j <= 24; $j++) {
            QueueTicket::create([
                'ticket_number' => "R-W0{$j}",
                'service_type' => 'R',
                'transaction_type' => 'Document Request',
                'status' => 'waiting',
                'created_at' => now(),
            ]);
        }

        // Predicted = (24 * 5) / 3 = 40 minutes
        // Range = approximately 35-45 minutes (CRITICAL)
        $response = $this->getJson('/api/intelligence/predicted-wait?department=Registrar');
        $response->assertStatus(200);

        $data = $response->json('predictions')[0];
        $this->assertEquals(24, $data['waiting_count']);
        $this->assertEquals(3, $data['active_windows']);
        $this->assertEquals(5.0, $data['average_service_time_minutes']);
        $this->assertEquals(40.0, $data['predicted_wait_minutes']);
        $this->assertEquals(35, $data['predicted_wait_min']);
        $this->assertEquals(45, $data['predicted_wait_max']);
        $this->assertEquals('35–45 minutes', $data['predicted_wait_formatted']);
        $this->assertEquals('CRITICAL', $data['queue_status']);
    }

    public function test_head_admin_can_retrieve_peak_hour_predictions_for_all_departments(): void
    {
        $admin = $this->createHeadAdmin();
        Sanctum::actingAs($admin);

        ServiceWindow::create([
            'department' => 'Cashier',
            'window_number' => 1,
            'service_type' => 'CS',
            'is_available' => true,
            'status' => 'open',
        ]);

        ServiceWindow::create([
            'department' => 'registrar',
            'window_number' => 9,
            'service_type' => 'RT',
            'is_available' => true,
            'status' => 'open',
        ]);

        $response = $this->getJson('/api/intelligence/peak-hours');
        $response->assertStatus(200);
        $response->assertJsonStructure([
            'success',
            'peak_predictions' => [
                '*' => [
                    'department_name',
                    'predicted_peak_formatted',
                    'expected_arrivals_formatted',
                    'peak_risk',
                    'confidence_text',
                    'historical_pattern',
                ],
            ],
        ]);

        $deptNames = collect($response->json('peak_predictions'))->pluck('department_name')->all();
        $this->assertContains('Cashier', $deptNames);
        $this->assertContains('Registrar', $deptNames);
    }

    public function test_department_admin_only_retrieves_their_assigned_department_peak_prediction(): void
    {
        $registrarAdmin = $this->createDeptAdmin('regadmin', 'registrar');
        Sanctum::actingAs($registrarAdmin);

        ServiceWindow::create([
            'department' => 'Cashier',
            'window_number' => 1,
            'service_type' => 'CS',
            'is_available' => true,
            'status' => 'open',
        ]);

        ServiceWindow::create([
            'department' => 'registrar',
            'window_number' => 9,
            'service_type' => 'RT',
            'is_available' => true,
            'status' => 'open',
        ]);

        $response = $this->getJson('/api/intelligence/peak-hours');
        $response->assertStatus(200);

        $predictions = $response->json('peak_predictions');
        $this->assertCount(1, $predictions);
        $this->assertEquals('Registrar', $predictions[0]['department_name']);
    }

    public function test_department_admin_cannot_access_other_departments_peak_prediction_via_query_param(): void
    {
        $registrarAdmin = $this->createDeptAdmin('regadmin', 'registrar');
        Sanctum::actingAs($registrarAdmin);

        $response = $this->getJson('/api/intelligence/peak-hours?department=Cashier');
        $response->assertStatus(403);
    }

    public function test_insufficient_data_returns_unavailable_peak_prediction(): void
    {
        $admin = $this->createHeadAdmin();
        Sanctum::actingAs($admin);

        ServiceWindow::firstOrCreate([
            'department' => 'Admission',
            'window_number' => 1,
        ], [
            'service_type' => 'ADM',
            'is_available' => true,
            'status' => 'open',
        ]);

        $response = $this->getJson('/api/intelligence/peak-hours?department=Admission');
        $response->assertStatus(200);

        $data = $response->json('peak_predictions')[0];
        $this->assertEquals('Peak prediction unavailable — insufficient historical data', $data['predicted_peak_formatted']);
        $this->assertEquals('Unavailable', $data['expected_arrivals_formatted']);
        $this->assertEquals('Limited data', $data['confidence_text']);
        $this->assertFalse($data['is_available']);
    }

    public function test_peak_hour_calculation_identifies_busiest_hour_with_upcoming_weighting(): void
    {
        $testNow = Carbon::parse('2026-10-05 08:30:00'); // Monday 8:30 AM
        Carbon::setTestNow($testNow);

        try {
            $admin = $this->createHeadAdmin();
            Sanctum::actingAs($admin);

            ServiceWindow::create([
                'department' => 'registrar',
                'window_number' => 9,
                'service_type' => 'RT',
                'is_available' => true,
                'status' => 'open',
            ]);

            // Create 20 tickets at 10:00 AM on past Mondays
            $pastDate = $testNow->copy()->subWeeks(1)->startOfWeek(); // Monday
            for ($i = 1; $i <= 20; $i++) {
                QueueTicket::create([
                    'ticket_number' => "R-P{$i}",
                    'service_type' => 'R',
                    'status' => 'done',
                    'created_at' => $pastDate->copy()->setHour(10)->setMinute(15),
                ]);
            }

            // Create 5 tickets at 8:00 AM on the same Monday
            for ($j = 1; $j <= 5; $j++) {
                QueueTicket::create([
                    'ticket_number' => "R-M{$j}",
                    'service_type' => 'R',
                    'status' => 'done',
                    'created_at' => $pastDate->copy()->setHour(8)->setMinute(10),
                ]);
            }

            $response = $this->getJson('/api/intelligence/peak-hours?department=Registrar');
            $response->assertStatus(200);

            $data = $response->json('peak_predictions')[0];
            $this->assertTrue($data['is_available']);
            $this->assertStringContainsString('10:00 AM – 11:00 AM', $data['predicted_peak_formatted']);
            $this->assertGreaterThanOrEqual(15, $data['expected_arrivals']);
            $this->assertNotEmpty($data['expected_arrivals_formatted']);
            $this->assertNotEmpty($data['peak_risk']);
        } finally {
            Carbon::setTestNow(); // Reset test time
        }
    }


    public function test_congestion_risk_endpoint_rejects_unauthenticated_requests(): void
    {
        $response = $this->getJson('/api/intelligence/congestion-risk');
        $response->assertStatus(401);
    }

    public function test_head_admin_can_retrieve_congestion_risks_for_all_departments(): void
    {
        $admin = $this->createHeadAdmin();
        Sanctum::actingAs($admin);

        ServiceWindow::create([
            'department' => 'Cashier',
            'window_number' => 1,
            'service_type' => 'CS',
            'is_available' => true,
            'status' => 'open',
        ]);

        ServiceWindow::create([
            'department' => 'registrar',
            'window_number' => 9,
            'service_type' => 'RT',
            'is_available' => true,
            'status' => 'open',
        ]);

        $response = $this->getJson('/api/intelligence/congestion-risk');
        $response->assertStatus(200);
        $response->assertJsonStructure([
            'success',
            'congestion_predictions' => [
                '*' => [
                    'department_name',
                    'risk_score',
                    'risk_level',
                    'waiting_count',
                    'active_windows',
                    'arrival_rate_per_hour',
                    'service_rate_per_hour',
                    'queue_trend',
                    'reason',
                    'recommended_action',
                ],
            ],
        ]);

        $deptNames = collect($response->json('congestion_predictions'))->pluck('department_name')->all();
        $this->assertContains('Cashier', $deptNames);
        $this->assertContains('Registrar', $deptNames);
    }

    public function test_department_admin_only_retrieves_their_assigned_department_congestion_risk(): void
    {
        $registrarAdmin = $this->createDeptAdmin('regadmin', 'registrar');
        Sanctum::actingAs($registrarAdmin);

        ServiceWindow::create([
            'department' => 'Cashier',
            'window_number' => 1,
            'service_type' => 'CS',
            'is_available' => true,
            'status' => 'open',
        ]);

        ServiceWindow::create([
            'department' => 'registrar',
            'window_number' => 9,
            'service_type' => 'RT',
            'is_available' => true,
            'status' => 'open',
        ]);

        $response = $this->getJson('/api/intelligence/congestion-risk');
        $response->assertStatus(200);

        $predictions = $response->json('congestion_predictions');
        $this->assertCount(1, $predictions);
        $this->assertEquals('Registrar', $predictions[0]['department_name']);
    }

    public function test_department_admin_cannot_access_other_departments_congestion_risk_via_query_param(): void
    {
        $registrarAdmin = $this->createDeptAdmin('regadmin', 'registrar');
        Sanctum::actingAs($registrarAdmin);

        $response = $this->getJson('/api/intelligence/congestion-risk?department=Cashier');
        $response->assertStatus(403);
    }

    public function test_zero_waiting_queue_returns_low_congestion_risk(): void
    {
        $admin = $this->createHeadAdmin();
        Sanctum::actingAs($admin);

        ServiceWindow::create([
            'department' => 'Cashier',
            'window_number' => 1,
            'service_type' => 'CS',
            'is_available' => true,
            'status' => 'open',
        ]);

        $response = $this->getJson('/api/intelligence/congestion-risk?department=Cashier');
        $response->assertStatus(200);

        $data = $response->json('congestion_predictions')[0];
        $this->assertEquals('LOW', $data['risk_level']);
        $this->assertLessThanOrEqual(24, $data['risk_score']);
        $this->assertEquals(0, $data['waiting_count']);
        $this->assertStringContainsString('clear', strtolower($data['reason']));
    }

    public function test_zero_active_windows_with_waiting_queue_returns_critical_congestion_risk(): void
    {
        $admin = $this->createHeadAdmin();
        Sanctum::actingAs($admin);

        // Window exists but is unavailable/closed
        ServiceWindow::create([
            'department' => 'Cashier',
            'window_number' => 1,
            'service_type' => 'CS',
            'is_available' => false,
            'status' => 'closed',
        ]);

        QueueTicket::create([
            'ticket_number' => 'C-001',
            'service_type' => 'CS',
            'status' => 'waiting',
            'created_at' => Carbon::now(),
        ]);

        $response = $this->getJson('/api/intelligence/congestion-risk?department=Cashier');
        $response->assertStatus(200);

        $data = $response->json('congestion_predictions')[0];
        $this->assertEquals('CRITICAL', $data['risk_level']);
        $this->assertGreaterThanOrEqual(75, $data['risk_score']);
        $this->assertEquals(0, $data['active_windows']);
        $this->assertStringContainsString('no active service window', strtolower($data['reason']));
        $this->assertStringContainsString('immediately open', strtolower($data['recommended_action']));
    }

    public function test_high_arrival_rate_exceeding_service_rate_increases_congestion_risk(): void
    {
        $admin = $this->createHeadAdmin();
        Sanctum::actingAs($admin);

        ServiceWindow::create([
            'department' => 'registrar',
            'window_number' => 9,
            'service_type' => 'RT',
            'is_available' => true,
            'status' => 'open',
        ]);

        // Historical service data so predicted wait time is calculable
        for ($k = 1; $k <= 5; $k++) {
            QueueTicket::create([
                'ticket_number' => "R-HIST{$k}",
                'service_type' => 'RT',
                'status' => 'done',
                'called_at' => Carbon::today()->startOfDay()->addHours(8),
                'completed_at' => Carbon::today()->startOfDay()->addHours(8)->addMinutes(5),
                'created_at' => Carbon::today()->startOfDay()->addHours(8),
            ]);
        }

        // 30 waiting customers created in last 45 minutes
        for ($i = 1; $i <= 30; $i++) {
            QueueTicket::create([
                'ticket_number' => "R-W{$i}",
                'service_type' => 'RT',
                'status' => 'waiting',
                'created_at' => Carbon::now()->subMinutes(20),
            ]);
        }

        // Only 2 completed in the last hour
        for ($j = 1; $j <= 2; $j++) {
            QueueTicket::create([
                'ticket_number' => "R-D{$j}",
                'service_type' => 'RT',
                'status' => 'done',
                'called_at' => Carbon::now()->subMinutes(40),
                'completed_at' => Carbon::now()->subMinutes(35),
                'created_at' => Carbon::now()->subMinutes(50),
            ]);
        }

        $response = $this->getJson('/api/intelligence/congestion-risk?department=Registrar');
        $response->assertStatus(200);

        $data = $response->json('congestion_predictions')[0];
        $this->assertEquals('CRITICAL', $data['risk_level']);
        $this->assertGreaterThanOrEqual(75, $data['risk_score']);
        $this->assertGreaterThan(2, $data['arrival_rate_per_hour']);
        $this->assertStringContainsString('faster', strtolower($data['reason']));
        $this->assertNotEmpty($data['recommended_action']);
    }
}

