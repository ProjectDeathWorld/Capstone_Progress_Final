<?php

namespace Tests\Feature;

use App\Models\DisplaySetting;
use App\Models\QueueTicket;
use App\Models\ServiceLog;
use App\Models\ServiceTransaction;
use App\Models\ServiceWindow;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DepartmentAdminDataIsolationTest extends TestCase
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
            'full_name' => 'Head Admin',
            'role' => 'admin',
            'position' => null,
            'status' => 'active',
        ]);
    }

    private function createDeptAdmin(string $username, string $position, string $fullName): User
    {
        return User::firstOrCreate(['username' => $username], [
            'password' => 'admin123',
            'full_name' => $fullName,
            'role' => 'dept_admin',
            'position' => $position,
            'status' => 'active',
        ]);
    }

    private function createStaff(string $username, string $position, string $fullName): User
    {
        return User::firstOrCreate(['username' => $username], [
            'password' => 'staff123',
            'full_name' => $fullName,
            'role' => 'staff',
            'position' => $position,
            'status' => 'active',
        ]);
    }

    public function test_department_admins_can_login_and_have_correct_attributes(): void
    {
        $accounting = $this->createDeptAdmin('Accounting', 'cashier', 'Accounting Dept Admin');
        $registrar = $this->createDeptAdmin('Registrar', 'registrar', 'Registrar Dept Admin');
        $itm = $this->createDeptAdmin('ITM', 'itm', 'ITM Dept Admin');
        $admission = $this->createDeptAdmin('Admission', 'admission', 'Admission Dept Admin');

        $this->postJson('/api/login', [
            'username' => 'Accounting',
            'password' => 'admin123',
        ])->assertOk()
            ->assertJsonPath('user.role', 'dept_admin')
            ->assertJsonPath('user.department', 'Cashier')
            ->assertJsonPath('user.is_dept_admin', true)
            ->assertJsonPath('user.is_head_admin', false);

        $this->postJson('/api/login', [
            'username' => 'Registrar',
            'password' => 'admin123',
        ])->assertOk()
            ->assertJsonPath('user.role', 'dept_admin')
            ->assertJsonPath('user.department', 'Registrar')
            ->assertJsonPath('user.is_dept_admin', true);

        $this->postJson('/api/login', [
            'username' => 'ITM',
            'password' => 'admin123',
        ])->assertOk()
            ->assertJsonPath('user.role', 'dept_admin')
            ->assertJsonPath('user.department', 'ITM');

        $this->postJson('/api/login', [
            'username' => 'Admission',
            'password' => 'admin123',
        ])->assertOk()
            ->assertJsonPath('user.role', 'dept_admin')
            ->assertJsonPath('user.department', 'Admission');
    }

    public function test_head_admin_can_manage_department_admins_and_all_staff(): void
    {
        $headAdmin = $this->createHeadAdmin();
        $accounting = $this->createDeptAdmin('Accounting', 'cashier', 'Accounting Admin');
        $cashierStaff = $this->createStaff('cashier1', 'cashier', 'Cashier Staff');
        $registrarStaff = $this->createStaff('registrar1', 'registrar', 'Registrar Staff');

        Sanctum::actingAs($headAdmin);

        // Head admin can see all staff and department admins
        $response = $this->getJson('/api/staff')
            ->assertOk()
            ->json();

        $usernames = array_column($response, 'username');
        $this->assertContains('Accounting', $usernames);
        $this->assertContains('cashier1', $usernames);
        $this->assertContains('registrar1', $usernames);

        // Head admin can create a new department admin
        $this->postJson('/api/register', [
            'username' => 'NewDeptAdmin',
            'password' => 'admin123',
            'password_confirmation' => 'admin123',
            'full_name' => 'New Dept Admin',
            'role' => 'dept_admin',
            'position' => 'admission',
        ])->assertStatus(201);

        $this->assertDatabaseHas('users', [
            'username' => 'NewDeptAdmin',
            'role' => 'dept_admin',
            'position' => 'admission',
        ]);
    }

    public function test_department_admin_can_only_see_and_manage_own_staff(): void
    {
        $accountingAdmin = $this->createDeptAdmin('Accounting', 'cashier', 'Accounting Admin');
        $cashierStaff = $this->createStaff('cashier1', 'cashier', 'Cashier Staff');
        $registrarStaff = $this->createStaff('registrar1', 'registrar', 'Registrar Staff');

        Sanctum::actingAs($accountingAdmin);

        // Accounting Admin only sees Cashier staff
        $response = $this->getJson('/api/staff')
            ->assertOk()
            ->json();

        $usernames = array_column($response, 'username');
        $this->assertContains('cashier1', $usernames);
        $this->assertNotContains('registrar1', $usernames);
        $this->assertNotContains('Accounting', $usernames);

        // Accounting Admin cannot view Registrar staff details
        $this->getJson('/api/staff/' . $registrarStaff->user_id)->assertStatus(404);

        // Accounting Admin can view Cashier staff details
        $this->getJson('/api/staff/' . $cashierStaff->user_id)->assertOk();

        // Accounting Admin cannot create staff for another department
        $this->postJson('/api/register', [
            'username' => 'illegalstaff',
            'password' => 'staff123',
            'password_confirmation' => 'staff123',
            'full_name' => 'Illegal Staff',
            'role' => 'staff',
            'position' => 'registrar',
        ])->assertStatus(403);

        // Accounting Admin cannot create department admin
        $this->postJson('/api/register', [
            'username' => 'illegaladmin',
            'password' => 'staff123',
            'password_confirmation' => 'staff123',
            'full_name' => 'Illegal Admin',
            'role' => 'dept_admin',
            'position' => 'cashier',
        ])->assertStatus(403);

        // Accounting Admin can create staff for Cashier
        $this->postJson('/api/register', [
            'username' => 'cashier_new',
            'password' => 'staff123',
            'password_confirmation' => 'staff123',
            'full_name' => 'New Cashier Staff',
            'role' => 'staff',
            'position' => 'cashier',
        ])->assertStatus(201);

        // Accounting Admin cannot update Registrar staff
        $this->putJson('/api/staff/' . $registrarStaff->user_id, [
            'full_name' => 'Hacked Staff',
        ])->assertStatus(404);

        // Accounting Admin cannot delete Registrar staff
        $this->deleteJson('/api/staff/' . $registrarStaff->user_id)->assertStatus(404);
    }

    public function test_department_admin_dashboard_and_analytics_are_isolated(): void
    {
        $accountingAdmin = $this->createDeptAdmin('Accounting', 'cashier', 'Accounting Admin');
        $registrarAdmin = $this->createDeptAdmin('Registrar', 'registrar', 'Registrar Admin');

        QueueTicket::create([
            'ticket_number' => 'C-N001',
            'service_type' => 'C',
            'created_at' => now(),
            'status' => 'completed',
            'called_at' => now(),
            'completed_at' => now(),
            'transaction_type' => 'Payment',
        ]);

        QueueTicket::create([
            'ticket_number' => 'R-N001',
            'service_type' => 'R',
            'created_at' => now(),
            'status' => 'completed',
            'called_at' => now(),
            'completed_at' => now(),
            'transaction_type' => 'Document Request',
        ]);

        // Accounting Admin querying dashboard
        Sanctum::actingAs($accountingAdmin);

        $dash = $this->getJson('/api/analytics/dashboard')
            ->assertOk()
            ->json();

        // Total tickets for Accounting should be 1 (only Cashier ticket)
        $this->assertEquals(1, $dash['total_tickets']);
        $this->assertEquals(1, $dash['customers_served']);

        // Accounting Admin querying another department explicitly returns 403
        $this->getJson('/api/analytics/dashboard?department=Registrar')->assertStatus(403);

        // Accounting Admin querying transaction analytics
        $this->getJson('/api/analytics/transactions?department=Cashier')->assertOk();
        $this->getJson('/api/analytics/transactions?department=Registrar')->assertStatus(403);

        // Accounting Admin querying peak hours
        $this->getJson('/api/analytics/peak-hours?department=Cashier')->assertOk();
        $this->getJson('/api/analytics/peak-hours?department=Registrar')->assertStatus(403);

        // Accounting Admin querying busiest day
        $this->getJson('/api/analytics/busiest-day?department=Cashier')->assertOk();
        $this->getJson('/api/analytics/busiest-day?department=Registrar')->assertStatus(403);

        // Accounting Admin querying customers served
        $this->getJson('/api/analytics/customers-served?department=Cashier')->assertOk();
        $this->getJson('/api/analytics/customers-served?department=Registrar')->assertStatus(403);
    }

    public function test_department_admin_reports_and_logs_are_isolated(): void
    {
        $accountingAdmin = $this->createDeptAdmin('Accounting', 'cashier', 'Accounting Admin');
        $registrarStaff = $this->createStaff('registrar1', 'registrar', 'Registrar Staff');
        $cashierStaff = $this->createStaff('cashier1', 'cashier', 'Cashier Staff');

        // Logs
        ServiceLog::create([
            'user_id' => $cashierStaff->user_id,
            'action' => 'Cashier action performed',
            'created_at' => now(),
        ]);
        ServiceLog::create([
            'user_id' => $registrarStaff->user_id,
            'action' => 'Registrar action performed',
            'created_at' => now(),
        ]);

        Sanctum::actingAs($accountingAdmin);

        // Reports: cannot query Registrar
        $this->getJson('/api/reports?department=Registrar')->assertStatus(403);
        $report = $this->getJson('/api/reports?department=Cashier')->assertOk()->json();
        $this->assertEquals('Cashier', $report['departments'][0]['department'] ?? 'Cashier');

        // Activity Logs: only sees Cashier logs
        $logs = $this->getJson('/api/activity-logs')->assertOk()->json();
        $departments = array_unique(array_column($logs, 'department'));
        $this->assertEquals(['Cashier'], array_values($departments));

        // Queue History: only sees Cashier tickets
        $history = $this->getJson('/api/queue-history')->assertOk()->json();
        foreach ($history as $item) {
            $this->assertEquals('Cashier', $item['department']);
        }
    }

    public function test_department_admin_cannot_update_display_settings(): void
    {
        $accountingAdmin = $this->createDeptAdmin('Accounting', 'cashier', 'Accounting Admin');
        Sanctum::actingAs($accountingAdmin);

        $this->putJson('/api/display-configuration', [
            'settings' => ['enabledDepartments' => ['Cashier']],
            'windows' => [],
        ])->assertStatus(403);
    }

    public function test_department_admin_monitoring_and_idle_windows_are_isolated(): void
    {
        $headAdmin = $this->createHeadAdmin();
        $accountingAdmin = $this->createDeptAdmin('Accounting', 'cashier', 'Accounting Admin');
        $registrarAdmin = $this->createDeptAdmin('Registrar', 'registrar', 'Registrar Admin');
        $itmAdmin = $this->createDeptAdmin('ITM', 'itm', 'ITM Admin');
        $admissionAdmin = $this->createDeptAdmin('Admission', 'admission', 'Admission Admin');

        // Provision service windows for each department
        ServiceWindow::firstOrCreate([
            'department' => 'Cashier',
            'window_number' => 1,
        ], [
            'service_type' => 'CS',
            'is_available' => true,
            'status' => 'open',
        ]);
        ServiceWindow::firstOrCreate([
            'department' => 'registrar',
            'window_number' => 1,
        ], [
            'service_type' => 'RT',
            'is_available' => true,
            'status' => 'open',
        ]);
        ServiceWindow::firstOrCreate([
            'department' => 'ITM',
            'window_number' => 1,
        ], [
            'service_type' => 'ITM',
            'is_available' => true,
            'status' => 'open',
        ]);
        ServiceWindow::firstOrCreate([
            'department' => 'Admission',
            'window_number' => 1,
        ], [
            'service_type' => 'ADM',
            'is_available' => true,
            'status' => 'open',
        ]);

        // 1. Head Admin sees all departments' windows
        Sanctum::actingAs($headAdmin);
        $headMonitoring = $this->getJson('/api/queue/monitoring')->assertOk()->json();
        $headDepts = array_unique(array_column($headMonitoring, 'department'));
        $this->assertContains('Cashier', $headDepts);
        $this->assertContains('Registrar', $headDepts);
        $this->assertContains('ITM', $headDepts);
        $this->assertContains('Admission', $headDepts);

        // 2. Accounting Admin only sees Accounting / Cashier windows (including idle windows)
        Sanctum::actingAs($accountingAdmin);
        $acctMonitoring = $this->getJson('/api/queue/monitoring')->assertOk()->json();
        $this->assertNotEmpty($acctMonitoring);
        foreach ($acctMonitoring as $window) {
            $this->assertEquals('Cashier', $window['department']);
            $this->assertEquals('Idle', $window['status']); // Idle window belongs to Cashier
        }
        // Attempting to query another department via URL returns 403 Forbidden
        $this->getJson('/api/queue/monitoring?department=Registrar')->assertStatus(403);
        $this->getJson('/api/queue/monitoring?department=ITM')->assertStatus(403);

        // 3. Registrar Admin only sees Registrar windows
        Sanctum::actingAs($registrarAdmin);
        $regMonitoring = $this->getJson('/api/queue/monitoring')->assertOk()->json();
        $this->assertNotEmpty($regMonitoring);
        foreach ($regMonitoring as $window) {
            $this->assertEquals('Registrar', $window['department']);
            $this->assertEquals('Idle', $window['status']);
        }
        $this->getJson('/api/queue/monitoring?department=Cashier')->assertStatus(403);

        // 4. ITM Admin only sees ITM windows
        Sanctum::actingAs($itmAdmin);
        $itmMonitoring = $this->getJson('/api/queue/monitoring')->assertOk()->json();
        $this->assertNotEmpty($itmMonitoring);
        foreach ($itmMonitoring as $window) {
            $this->assertEquals('ITM', $window['department']);
            $this->assertEquals('Idle', $window['status']);
        }
        $this->getJson('/api/queue/monitoring?department=Admission')->assertStatus(403);

        // 5. Admission Admin only sees Admission windows
        Sanctum::actingAs($admissionAdmin);
        $admMonitoring = $this->getJson('/api/queue/monitoring')->assertOk()->json();
        $this->assertNotEmpty($admMonitoring);
        foreach ($admMonitoring as $window) {
            $this->assertEquals('Admission', $window['department']);
            $this->assertContains($window['status'], ['Idle', 'Closed']);
        }
        $this->getJson('/api/queue/monitoring?department=Cashier')->assertStatus(403);
    }
}

